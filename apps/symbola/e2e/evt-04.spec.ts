// EVT-04 — rétroplanning : modèles (dont le modèle de départ), application
// à un événement daté, événement sans date, recalcul proposé au changement
// de date, ajout, coche et réordonnancement des tâches. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openEventTab, readyOrganization, changeEventStatus } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("EVT-04 — modèle de rétroplanning appliqué, recalcul des échéances et gestion des tâches", async ({ page }) => {
  const email = `planner-evt04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Modèles : le modèle de départ se charge, un modèle se compose à la main.
  await page.goto("/events");
  // Lot 20 (décision 1) : par « Réglages », puis la rubrique.
  await page.getByRole("link", { name: /^Réglages/ }).click();
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name: "Rétroplanning", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/modeles$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByRole("heading", { name: "Rétroplanning mariage (modèle de départ)" })).toBeVisible();

  await page.getByLabel("Nom du modèle").fill("Mariage court");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByRole("heading", { name: "Mariage court" })).toBeVisible();
  const addItem = page.getByRole("group", { name: "Ajouter une tâche au modèle Mariage court" });
  await addItem.getByLabel("Intitulé de la tâche").fill("Réserver le lieu");
  await addItem.getByLabel(/Décalage en jours/).fill("-365");
  await addItem.getByRole("button", { name: "Ajouter la tâche au modèle" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "J-365 — Réserver le lieu — Planner" })).toBeVisible();
  await addItem.getByLabel("Intitulé de la tâche").fill("Envoyer les faire-part");
  await addItem.getByLabel(/Décalage en jours/).fill("-120");
  await addItem.getByLabel("Responsable").selectOption("clients");
  await addItem.getByRole("button", { name: "Ajouter la tâche au modèle" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "J-120 — Envoyer les faire-part — Mariés" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Un prospect sans date : l'app indique qu'un modèle demande une date.
  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  // Lot 12 (EVT-13) : le rétroplanning s'ouvre une fois l'événement confirmé.
  await page.waitForLoadState("networkidle");
  await changeEventStatus(page, "Confirmé");
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();
  await openEventTab(page, "Rétroplanning");
  await expect(page.getByText("Ajoutez une date à l'événement pour appliquer un modèle de rétroplanning.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Appliquer le modèle" })).toHaveCount(0);

  // Avec une date (onglet Vue d'ensemble), le modèle crée les tâches, regroupées par mois.
  await openEventTab(page, "Vue d'ensemble");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Date de l'événement").fill("2027-06-12");
  await page.getByRole("button", { name: "Changer la date" }).click();
  await expect(page.getByText("Date mise à jour.")).toBeVisible();
  await openEventTab(page, "Rétroplanning");
  await page.getByLabel("Modèle à appliquer").selectOption({ label: "Mariage court" });
  await page.getByRole("button", { name: "Appliquer le modèle" }).click();
  await expect(page.getByText("Modèle appliqué : les tâches ont été créées.")).toBeVisible();
  const row = (label: string) => page.getByRole("row", { name: new RegExp(label) });
  await expect(page.getByRole("columnheader", { name: "juin 2026" })).toBeVisible();
  await expect(row("Réserver le lieu")).toContainText("12 juin 2026");
  await expect(row("Réserver le lieu")).toContainText("Planner");
  await expect(page.getByRole("columnheader", { name: "février 2027" })).toBeVisible();
  await expect(row("Envoyer les faire-part")).toContainText("12 février 2027");
  await expect(row("Envoyer les faire-part")).toContainText("Mariés");
  await expectNoAxeViolation(page);

  // Une tâche faite n'est pas décalée ; les autres le sont si la planner accepte.
  await page.getByRole("button", { name: "Cocher la tâche Réserver le lieu" }).click();
  await expect(page.getByRole("button", { name: "Décocher la tâche Réserver le lieu" })).toBeVisible();
  await openEventTab(page, "Vue d'ensemble");
  await page.getByLabel("Date de l'événement").fill("2027-06-19");
  await page.getByRole("button", { name: "Changer la date" }).click();
  await expect(page.getByText("Date mise à jour.")).toBeVisible();
  await openEventTab(page, "Rétroplanning");
  const proposal = page.getByRole("region", { name: "Recalcul des échéances" });
  await expect(proposal).toContainText("repoussée de 7 jours. Décaler d'autant la tâche non faite ?");
  await expectNoAxeViolation(page);
  await proposal.getByRole("button", { name: "Décaler les échéances" }).click();
  await expect(proposal).toHaveCount(0);
  await expect(row("Envoyer les faire-part")).toContainText("19 février 2027");
  await expect(row("Réserver le lieu")).toContainText("12 juin 2026");

  // Ajout d'une tâche des mariés, puis réordonnancement dans le mois (panneau de la tâche).
  const newTask = page.getByRole("group", { name: "Nouvelle tâche" });
  await newTask.getByLabel("Intitulé de la tâche").fill("Essayage");
  await newTask.getByLabel("Échéance").fill("2027-02-25");
  await newTask.getByLabel("Responsable").selectOption("clients");
  await newTask.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(page.getByText("Tâche ajoutée.")).toBeVisible();
  const order = async () => (await page.getByRole("rowheader").allTextContents()).filter((text) => ["Essayage", "Envoyer les faire-part"].includes(text));
  await expect.poll(order).toEqual(["Envoyer les faire-part", "Essayage"]);
  await page.getByRole("link", { name: "Essayage", exact: true }).click();
  await page.getByRole("button", { name: "Monter la tâche Essayage" }).click();
  await expect.poll(order).toEqual(["Essayage", "Envoyer les faire-part"]);
  await expect(row("Essayage")).toContainText("25 février 2027");
  await expectNoAxeViolation(page);
});
