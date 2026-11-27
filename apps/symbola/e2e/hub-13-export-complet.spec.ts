// Lot 35a (HUB-13, DAT-13 ; décisions D4 et D5) — export complet des données : la Propriétaire
// ouvre « Exporter mes données » dans Paramètres, prépare l'export, suit sa préparation en
// arrière-plan, puis télécharge l'archive ZIP ; une Planner n'a ni l'écran, ni la rubrique, ni le
// téléchargement. En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { clickMenuLink, openSettingsTab, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Atelier de Camille : un mariage, pour que l'archive ait des données ; une Planner dans l'équipe.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const ownerEmail = `camille-${randomUUID()}@symbola.test`;
    const plannerEmail = `planner-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email: ownerEmail, password: "mot-de-passe-export-e2e", role: "owner" });
    await createUser(db, { organizationId, email: plannerEmail, password: "mot-de-passe-export-e2e", role: "member" });
    const source = await createProspectSource(organizationId, "Salon");
    await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
    return { ownerEmail, plannerEmail };
  } finally {
    await sql.end();
  }
}

test("HUB-13 — la Propriétaire prépare l'export complet, suit sa préparation et télécharge l'archive", async ({ page }) => {
  const { ownerEmail } = await atelier();
  await signIn(page, ownerEmail, /\/$/);

  // La rubrique est dans Paramètres, groupe « Prestataires et données ».
  await openSettingsTab(page, "Copie de toutes vos données");
  await expect(page).toHaveURL(/\/parametres\/export$/);
  await expect(page.getByRole("heading", { level: 1, name: "Exporter mes données" })).toBeVisible();
  await expect(page.getByText("Aucun export pour l'instant.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Le format" })).toContainText("Les secrets");
  await expectNoAxeViolation(page);

  await page.waitForLoadState("networkidle");
  const request = page.getByRole("form", { name: "Préparer un export" });
  await request.getByRole("button", { name: "Préparer l'export" }).click();
  await expect(request.getByRole("status")).toHaveText("Export demandé. Nous vous prévenons par e-mail dès qu'il est prêt.");
  // Une seconde demande pendant la préparation renvoie celle en cours.
  const history = page.getByRole("region", { name: "Vos derniers exports" });
  await expect(history.getByRole("listitem")).toHaveCount(1);

  // Préparé en arrière-plan : l'écran se met à jour de lui-même.
  await expect(history.getByRole("link", { name: /^Télécharger l'archive/ })).toBeVisible({ timeout: 60_000 });
  await expect(history).toContainText("Prêt");
  await expect(history).toContainText("Téléchargeable jusqu'au");
  await expectNoAxeViolation(page);

  const downloading = page.waitForEvent("download");
  await history.getByRole("link", { name: /^Télécharger l'archive/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^symbola-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const bytes = readFileSync((await download.path())!);
  // Une archive ZIP (signature « PK »), qui contient le manifeste.
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.includes(Buffer.from("manifest.json"))).toBe(true);
});

test("HUB-13 (D5) — une Planner n'a ni la rubrique, ni l'écran, ni le téléchargement", async ({ page }) => {
  const { plannerEmail } = await atelier();
  await signIn(page, plannerEmail, /\/$/);
  // Lot 74g : la copie des données est dans « Vos données », réservée à la titulaire comme avant.
  await clickMenuLink(page, "Paramètres");
  await page.getByRole("link", { name: "Ouvrir « Vos données »" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vos données" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Ouvrir « Copie de toutes vos données »" })).toHaveCount(0);

  await page.goto("/parametres/export");
  await expect(page.getByText("Cet écran est réservé à la Propriétaire du compte.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Préparer l'export" })).toHaveCount(0);
  await expectNoAxeViolation(page);

  const response = await page.request.get(`/parametres/export/${randomUUID()}`);
  expect(response.status()).toBe(403);
});
