// Lot 35b (HUB-13 ; décisions D6 et D7 ; ADR 0098) — reprise d'un export Symbola dans un espace
// vide : la Propriétaire de l'atelier exporte ses données et télécharge l'archive ; la Propriétaire
// d'un nouvel espace vide la dépose dans « Reprendre un export », suit la reprise en arrière-plan,
// lit le bilan et retrouve le mariage. Un espace qui a des données ne propose pas le dépôt ; une
// Planner n'a ni la rubrique, ni l'écran, ni la route d'envoi. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { clickMenuLink, logout, openSettingsTab, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Un atelier avec un mariage (l'archive à reprendre), un nouvel espace vide et sa Planner.
async function ateliers() {
  const { sql, db } = createAppConnection();
  try {
    const marker = randomUUID().slice(0, 6);
    const sourceId = (await readyOrganization(db, `Atelier ${marker}`)).id;
    const sourceEmail = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId: sourceId, email: sourceEmail, password: "mot-de-passe-reprise-e2e", role: "owner" });
    const salon = await createProspectSource(sourceId, "Salon");
    await createProspect({ organizationId: sourceId, createdByUserId: owner.id, prospectSourceId: salon.id, clients: [{ firstName: `Léa ${marker}`, lastName: "Martin" }], eventDate: "2027-06-12" });
    const targetId = (await readyOrganization(db, `Nouvel atelier ${marker}`)).id;
    const targetEmail = `camille-nouvel-${randomUUID()}@symbola.test`;
    const plannerEmail = `planner-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: targetId, email: targetEmail, password: "mot-de-passe-reprise-e2e", role: "owner" });
    await createUser(db, { organizationId: targetId, email: plannerEmail, password: "mot-de-passe-reprise-e2e", role: "member" });
    return { marker, sourceEmail, targetEmail, plannerEmail };
  } finally {
    await sql.end();
  }
}

test("HUB-13 — exporter, télécharger, puis reprendre l'archive dans un espace vide : bilan et données retrouvées", async ({ page }) => {
  test.setTimeout(180_000);
  const { marker, sourceEmail, targetEmail } = await ateliers();

  // 1. L'atelier d'origine : export et téléchargement. Son espace a des données : pas de dépôt.
  await signIn(page, sourceEmail, /\/$/);
  await openSettingsTab(page, "Copie de toutes vos données");
  await page.waitForLoadState("networkidle");
  await page.getByRole("form", { name: "Préparer un export" }).getByRole("button", { name: "Préparer l'export" }).click();
  const history = page.getByRole("region", { name: "Vos derniers exports" });
  await expect(history.getByRole("link", { name: /^Télécharger l'archive/ })).toBeVisible({ timeout: 60_000 });
  const downloading = page.waitForEvent("download");
  await history.getByRole("link", { name: /^Télécharger l'archive/ }).click();
  const archive = (await (await downloading).path())!;
  await openSettingsTab(page, "Reprendre une copie Symbola");
  await expect(page.getByRole("note")).toContainText("Cet espace a déjà des données");
  await expect(page.getByRole("button", { name: "Reprendre l'archive" })).toHaveCount(0);
  await logout(page);

  // 2. Le nouvel espace, vide : dépôt de l'archive, reprise en arrière-plan, bilan.
  await signIn(page, targetEmail, /\/$/);
  await openSettingsTab(page, "Reprendre une copie Symbola");
  await expect(page).toHaveURL(/\/parametres\/reprise$/);
  await expect(page.getByRole("heading", { level: 1, name: "Reprendre un export Symbola" })).toBeVisible();
  await expect(page.getByText("Aucune reprise pour l'instant.")).toBeVisible();
  await expectNoAxeViolation(page);
  const form = page.getByRole("form", { name: "Déposer l'archive" });
  await form.getByLabel("Archive d'export Symbola (.zip)").setInputFiles(archive);
  await form.getByRole("button", { name: "Reprendre l'archive" }).click();
  const imports = page.getByRole("region", { name: "Reprises" });
  await expect(imports).toContainText("Reprise terminée", { timeout: 90_000 });
  await expect(imports).toContainText(/lignes reprises/);
  await expect(imports).toContainText("à inviter");
  await imports.getByText("Détail, table par table").click();
  await expect(imports.getByRole("row", { name: /events\/events/ })).toBeVisible();
  await expectNoAxeViolation(page);

  // 3. Le mariage est là.
  await clickMenuLink(page, "Évènements");
  await expect(page.getByRole("region", { name: "Liste des évènements" }).getByRole("link", { name: `Léa ${marker}` })).toBeVisible();
});

test("HUB-13 (D6) — une Planner n'a ni la rubrique, ni l'écran, ni la route d'envoi", async ({ page }) => {
  const { plannerEmail } = await ateliers();
  await signIn(page, plannerEmail, /\/$/);
  // Lot 74g : la reprise est dans « Vos données », réservée à la titulaire comme avant.
  await clickMenuLink(page, "Paramètres");
  await page.getByRole("link", { name: "Ouvrir « Vos données »" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vos données" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Ouvrir « Reprendre une copie Symbola »" })).toHaveCount(0);
  await page.goto("/parametres/reprise");
  await expect(page.getByText("Seule la Propriétaire du compte peut reprendre un export.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reprendre l'archive" })).toHaveCount(0);
  await expectNoAxeViolation(page);
  const response = await page.request.post("/parametres/reprise/envoi", {
    headers: { origin: "http://localhost:3000" },
    multipart: { archive: { name: "export.zip", mimeType: "application/zip", buffer: Buffer.from("PK") } },
  });
  expect(response.status()).toBe(403);
});
