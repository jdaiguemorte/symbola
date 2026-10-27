// EVT-04 — rétroplanning : modèles (dont le modèle de départ), application
// à un événement daté, événement sans date, recalcul proposé au changement
// de date, ajout, coche et réordonnancement des tâches. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
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
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Modèles : le modèle de départ se charge, un modèle se compose à la main.
  await page.goto("/events");
  await page.getByRole("link", { name: "Modèles de rétroplanning" }).click();
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
  await page.goto("/events/parametres");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Ajoutez une date à l'événement pour appliquer un modèle de rétroplanning.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Appliquer le modèle" })).toHaveCount(0);

  // Avec une date, le modèle crée les tâches, regroupées par mois.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Date de l'événement").fill("2027-06-12");
  await page.getByRole("button", { name: "Changer la date" }).click();
  await expect(page.getByText("Date mise à jour.")).toBeVisible();
  await page.getByLabel("Modèle à appliquer").selectOption({ label: "Mariage court" });
  await page.getByRole("button", { name: "Appliquer le modèle" }).click();
  await expect(page.getByText("Modèle appliqué : les tâches ont été créées.")).toBeVisible();
  const june2026 = page.getByRole("region", { name: "juin 2026" });
  await expect(june2026.getByRole("listitem")).toContainText("Réserver le lieu — 12 juin 2026 — Planner");
  const february = page.getByRole("region", { name: "février 2027" });
  await expect(february.getByRole("listitem")).toContainText("Envoyer les faire-part — 12 février 2027 — Mariés");
  await expectNoAxeViolation(page);

  // Une tâche faite n'est pas décalée ; les autres le sont si la planner accepte.
  await page.getByRole("button", { name: "Cocher la tâche Réserver le lieu" }).click();
  await expect(page.getByRole("button", { name: "Décocher la tâche Réserver le lieu" })).toBeVisible();
  await page.getByLabel("Date de l'événement").fill("2027-06-19");
  await page.getByRole("button", { name: "Changer la date" }).click();
  const proposal = page.getByRole("region", { name: "Recalcul des échéances" });
  await expect(proposal).toContainText("repoussée de 7 jours. Décaler d'autant la tâche non faite ?");
  await expectNoAxeViolation(page);
  await proposal.getByRole("button", { name: "Décaler les échéances" }).click();
  await expect(proposal).toHaveCount(0);
  await expect(february.getByRole("listitem")).toContainText("Envoyer les faire-part — 19 février 2027");
  await expect(june2026.getByRole("listitem")).toContainText("Réserver le lieu — 12 juin 2026");

  // Ajout d'une tâche des mariés, puis réordonnancement dans le mois.
  const newTask = page.getByRole("group", { name: "Nouvelle tâche" });
  await newTask.getByLabel("Intitulé de la tâche").fill("Essayage");
  await newTask.getByLabel("Échéance").fill("2027-02-25");
  await newTask.getByLabel("Responsable").selectOption("clients");
  await newTask.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(page.getByText("Tâche ajoutée.")).toBeVisible();
  await expect(february.getByRole("listitem")).toHaveCount(2);
  await expect(february.getByRole("listitem").nth(1)).toContainText("Essayage");
  await page.getByRole("button", { name: "Monter la tâche Essayage" }).click();
  await expect(february.getByRole("listitem").first()).toContainText("Essayage — 25 février 2027 — Mariés");
  await expectNoAxeViolation(page);
});
