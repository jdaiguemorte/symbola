// EVT-01/02/07 — liste des événements, étapes d'un événement et source du
// prospect : parcours complet d'une planner, en taille ordinateur et en
// 375 px (les deux projets Playwright), avec contrôle axe-core par écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

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
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

test("EVT-07 — la planner paramètre ses sources et motifs de perte, puis la source est obligatoire à la création", async ({
  page,
}) => {
  await createPlanner(page);

  await page.getByRole("link", { name: "Événements" }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expectNoAxeViolation(page);

  await page.getByRole("link", { name: "Sources et motifs de perte" }).first().click();
  await expect(page).toHaveURL(/\/events\/parametres$/);
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
  // EVT-07 : la source est visible dans la fiche.
  await expect(page.getByText("Source du prospect : Instagram")).toBeVisible();
  await expectNoAxeViolation(page);
});

test("EVT-01/02 — un prospect apparaît dans la liste, passe en Confirmé puis en Perdu avec un motif obligatoire", async ({
  page,
}) => {
  await createPlanner(page);
  const firstName = `Alix${randomUUID().slice(0, 8)}`;

  await page.goto("/events/parametres");
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

  // EVT-01 : le prospect sans date est listé « Date à définir », avec son statut.
  await page.goto("/events");
  const item = page.getByRole("link", { name: new RegExp(`${firstName} & Sacha`) });
  await expect(item).toContainText("Date à définir");
  await expect(item).toContainText("Prospect");
  // EVT-07 : filtrable par source.
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(item).toBeVisible();
  await page.getByLabel("Rechercher un nom").fill(firstName);
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(item).toBeVisible();

  // EVT-02 : changement de statut à la main.
  await page.goto(detailUrl);
  // Attend l'hydratation : un envoi avant elle partirait sans retour d'erreur.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Statut").selectOption("confirmed");
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();
  await page.goto("/events");
  await expect(item).toContainText("Confirmé");

  // EVT-02 : Perdu exige un motif, et une précision pour le motif « Autre ».
  await page.goto(detailUrl);
  // Attend l'hydratation : un envoi avant elle partirait sans retour d'erreur.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Statut").selectOption("lost");
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await expect(page.locator("form p[role=alert]")).toHaveText("Choisissez un motif de perte.");

  await page.getByLabel("Motif de perte").selectOption({ label: "Autre" });
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await expect(page.locator("form p[role=alert]")).toHaveText("Ce motif demande une précision.");
  await expectNoAxeViolation(page);

  await page.getByLabel("Précision sur le motif").fill("Le couple a choisi un autre lieu.");
  await page.getByRole("button", { name: "Changer le statut" }).click();
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
