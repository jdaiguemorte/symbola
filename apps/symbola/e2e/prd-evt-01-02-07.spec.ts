// PRD-EVT-01/02/07 — liste des événements, étapes d'un événement et source du
// prospect : parcours complet d'une planner, en taille ordinateur et en
// 375 px (les deux projets Playwright), avec contrôle axe-core par écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { clickMenuLink, readyOrganization, changeEventStatus } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(
    provisioningUri!.replace("otpauth://totp/", "https://x/"),
  ).searchParams.get("secret")!;
  await page
    .getByLabel("Code")
    .fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function createPlanner(page: Page) {
  const email = `planner-evt-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

test("PRD-EVT-07 — la planner paramètre ses sources et motifs de perte, puis la source est obligatoire à la création", async ({
  page,
}) => {
  await createPlanner(page);

  await clickMenuLink(page, "Événements");
  await expect(page).toHaveURL(/\/events$/);
  await expectNoAxeViolation(page);

  await page.getByRole("link", { name: "Paramètres des événements" }).first().click();
  await expect(page).toHaveURL(/\/events\/parametres$/);
  // Lot 13 (L13-HUB-16) : sources et motifs ont leur rubrique.
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name: "Sources et motifs", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/parametres\/sources$/);
  await page.getByLabel("Nouvelle source").fill("Instagram");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Instagram" })).toBeVisible();

  await page.getByLabel("Nouveau motif").fill("Autre");
  await page.getByLabel("Demander une précision").check();
  await page.getByRole("button", { name: "Ajouter le motif" }).click();
  await expect(page.getByText("Motif ajouté.")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Autre (précision demandée)" }),
  ).toBeVisible();
  await expectNoAxeViolation(page);

  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Camille");
  // Sans source, le formulaire ne part pas : le champ est signalé manquant.
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  const source = page.getByLabel("Source du prospect");
  expect(await source.evaluate((element: HTMLSelectElement) => element.validity.valueMissing)).toBe(
    true,
  );
  await expectNoAxeViolation(page);

  await source.selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Camille" })).toBeVisible();
  // PRD-EVT-07 : la source est visible dans la fiche.
  await expect(page.getByText("Source du prospect : Instagram")).toBeVisible();
  await expectNoAxeViolation(page);
});

test("PRD-EVT-01/02 — un prospect apparaît dans la liste, passe en Confirmé puis en Perdu avec un motif obligatoire", async ({
  page,
}) => {
  await createPlanner(page);
  const firstName = `Alix${randomUUID().slice(0, 8)}`;

  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.getByLabel("Nouveau motif").fill("Autre");
  await page.getByLabel("Demander une précision").check();
  await page.getByRole("button", { name: "Ajouter le motif" }).click();
  await expect(page.getByText("Motif ajouté.")).toBeVisible();

  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill(firstName);
  await page.getByLabel("Prénom du second marié (facultatif)", { exact: true }).fill("Sacha");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();

  // PRD-EVT-01 : le prospect sans date est listé « Date à définir », avec son statut.
  await page.goto("/events");
  // L13-EVT-18 : une ligne du tableau par événement.
  const item = page.getByRole("row", { name: new RegExp(`${firstName} & Sacha`) });
  await expect(item).toContainText("Date à définir");
  await expect(item).toContainText("Prospect");
  // L13-EVT-18 : l'année se choisit dans une liste (jamais 1 ni −1) et les
  // filtres ont tous la même hauteur.
  const years = await page.getByLabel("Année").locator("option").allTextContents();
  expect(years).toContain(String(new Date().getFullYear()));
  expect(years).not.toContain("1");
  const heights = await Promise.all(
    ["search", "status", "source", "year"].map(
      async (name) => (await page.getByRole("search", { name: "Filtrer les événements" }).locator(`[name="${name}"]`).boundingBox())!.height,
    ),
  );
  expect(new Set(heights.map((height) => Math.round(height))).size).toBe(1);
  // PRD-EVT-07 : filtrable par source.
  // L13-EVT-18 : les filtres s'appliquent à la saisie, sans bouton.
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await expect(page).toHaveURL(/source=/);
  await expect(item).toBeVisible();
  await page.getByLabel("Rechercher un nom").fill(firstName);
  await expect(page).toHaveURL(/search=/);
  await expect(item).toBeVisible();

  // PRD-EVT-02 : changement de statut à la main.
  await page.goto(detailUrl);
  // Attend l'hydratation : un envoi avant elle partirait sans retour d'erreur.
  await page.waitForLoadState("networkidle");
  // Lot 12 (L12-EVT-12) : statut en boutons d'étapes, un clic suffit.
  await changeEventStatus(page, "Confirmé");
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();
  await page.goto("/events");
  await expect(item).toContainText("Confirmé");

  // PRD-EVT-02 : Perdu exige un motif, et une précision pour le motif « Autre ».
  await page.goto(detailUrl);
  // Attend l'hydratation : un envoi avant elle partirait sans retour d'erreur.
  await page.waitForLoadState("networkidle");
  // « Perdu… » ouvre le choix du motif (obligatoire) ; le motif « Autre »
  // demande une précision avant de confirmer.
  await page.getByRole("button", { name: "Marquer perdu…" }).click();
  await expect(page.getByLabel("Motif de perte")).toHaveAttribute("required", "");
  await page.getByLabel("Motif de perte").selectOption({ label: "Autre" });
  await expect(page.getByLabel("Précision sur le motif")).toHaveAttribute("required", "");
  await expectNoAxeViolation(page);

  await page.getByLabel("Précision sur le motif").fill("Le couple a choisi un autre lieu.");
  await page.getByRole("button", { name: "Confirmer « Perdu »" }).click();
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();
  await expect(page.locator("form p[role=alert]")).toHaveCount(0);

  // Les événements perdus sont dans l'onglet séparé « Terminés ».
  await page.goto("/events");
  await expect(item).toHaveCount(0);
  await page.getByRole("link", { name: "Terminés" }).click();
  await expect(page).toHaveURL(/tab=termines/);
  await expect(item).toContainText("Perdu");
  await expectNoAxeViolation(page);
});
