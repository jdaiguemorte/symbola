// Lot 20 — retours de la recette des lots 18 et 19 (Julien, 10/11/2026) :
// bouton du centre d'aide décollé de la barre (HUB-26), une aide sur chaque
// écran de réglage (AIDE-14), une image pour chaque fiche du centre d'aide
// (AIDE-16), cartes du rétroplanning alignées (EVT-20), archivage d'un
// prestataire depuis le carnet avec confirmation (PRE-17), étiquettes par
// famille avec paliers (décision 5), vocabulaire des écrans qui mêlent les
// événements (décision 6). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { starterEventTypes } from "@symbola/starter-templates";
import { addEventTask, addStarterEventTypes, createProspect, createProspectSource, listEventTypes } from "../modules/events/service";
import { createVendor, createVendorFamily, createVendorTag, createVendorType } from "../modules/vendors/service";
import { landmarksPanel, readyOrganization } from "./helpers";

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

async function newPlanner(page: Page, vendors: string[] = []) {
  const email = `planner-lot20-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot20-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    for (const name of vendors) await createVendor(organization.id, { name, typeId: null, city: "Lille" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

test("Lot 20 — centre d'aide, aide des écrans de réglage, rétroplanning", async ({ page }) => {
  test.setTimeout(120_000);
  await newPlanner(page);

  // HUB-26 : le bouton « Voir le parcours des tutoriels » est sous la barre de progression.
  await page.goto("/aide");
  const progress = (await page.locator(".help-progress progress").boundingBox())!;
  const journey = (await page.getByRole("link", { name: "Voir le parcours des tutoriels" }).boundingBox())!;
  expect(journey.y).toBeGreaterThanOrEqual(progress.y + progress.height);

  // AIDE-16 : chaque fiche a une image, jamais un « ? ».
  expect(await page.locator(".help-tile").count()).toBeGreaterThan(10);
  await expect(page.locator(".help-tile:not(:has(img))")).toHaveCount(0);
  await expectNoAxeViolation(page);

  // AIDE-14 : le « ? » des écrans de réglage ouvre leur aide, sans quitter l'écran.
  for (const [path, title] of [
    ["/events/parametres/sources", "Sources et motifs"],
    ["/parametres/relances", "Délais de relance"],
    ["/prestataires/parametres", "Familles et types de prestataires"],
    ["/prestataires/parametres/etiquettes", "Étiquettes"],
    ["/prestataires/parametres/trajet", "Estimation des trajets"],
  ] as const) {
    await page.goto(path);
    await page.getByRole("button", { name: "Aide sur cet écran" }).click();
    await expect(landmarksPanel(page, title)).toBeVisible();
    await expect(page).toHaveURL(path);
  }

  // EVT-20 : la carte « Nouveau modèle » a les mêmes bords que celles des modèles.
  await page.goto("/events/modeles");
  await page.getByLabel("Nom du modèle").fill("Modèle de recette");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  const templateCard = page.locator("main > section", { has: page.getByRole("heading", { name: "Modèle de recette", level: 2 }) });
  await expect(templateCard).toBeVisible();
  const template = (await templateCard.boundingBox())!;
  const creation = (await page.locator("main > section", { has: page.getByRole("heading", { name: "Nouveau modèle", level: 2 }) }).boundingBox())!;
  expect(Math.abs(template.x - creation.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(template.width - creation.width)).toBeLessThanOrEqual(1);
  await expectNoAxeViolation(page);
});

test("PRE-17 — archiver un prestataire depuis le carnet, après confirmation", async ({ page }) => {
  test.setTimeout(90_000);
  await newPlanner(page, ["Domaine des Saules", "Fleurs de Lys"]);
  await page.goto("/prestataires");
  const results = page.locator(".vendor-results");
  await expect(results.getByRole("link", { name: "Domaine des Saules" })).toBeVisible();

  // Annuler ne change rien.
  await page.getByRole("button", { name: "Archiver Domaine des Saules" }).click();
  const dialog = page.getByRole("dialog", { name: "Archiver Domaine des Saules ?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Ses prestations restent sur vos événements et budgets.");
  await expectNoAxeViolation(page);
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
  await expect(results.getByRole("link", { name: "Domaine des Saules" })).toBeVisible();

  // Confirmer archive la fiche ; l'autre reste.
  await page.getByRole("button", { name: "Archiver Domaine des Saules" }).click();
  await dialog.getByRole("button", { name: "Archiver la fiche" }).click();
  await expect(results.getByRole("link", { name: "Domaine des Saules" })).toHaveCount(0);
  await expect(results.getByRole("link", { name: "Fleurs de Lys" })).toBeVisible();
  await expect(page).toHaveURL(/\/prestataires$/);
});

test("Décision 5 — étiquettes : paliers repérés puis rangés, choix unique sur la fiche, étiquettes de la famille seulement", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-lot20-tags-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot20-e2e";
  const { sql, db } = createAppConnection();
  let venueId: string;
  let floristId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    const venues = await createVendorFamily(organization.id, { label: "Lieux", color: "#4f6b5a", icon: "venue" });
    const flowers = await createVendorFamily(organization.id, { label: "Fleurs", color: "#a8553a", icon: "florist" });
    const domain = await createVendorType(organization.id, "Domaine", "#4f6b5a", { familyId: venues.id });
    const florist = await createVendorType(organization.id, "Fleuriste", "#a8553a", { familyId: flowers.id });
    for (const label of ["150 à 200 personnes", "100 à 150 personnes"]) await createVendorTag(organization.id, label);
    await createVendorTag(organization.id, "Accès PMR", { familyIds: [venues.id] });
    venueId = (await createVendor(organization.id, { name: "Domaine des Saules", typeId: domain.id, city: "Lille" })).vendor.id;
    floristId = (await createVendor(organization.id, { name: "Fleurs de Lys", typeId: florist.id, city: "Lille" })).vendor.id;
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Les deux tranches de « personnes » sont proposées ; rangées, elles forment un palier.
  await page.goto("/prestataires/parametres/etiquettes");
  const proposals = page.getByRole("region", { name: "Paliers repérés" });
  await expect(proposals).toContainText("100 à 150 personnes, 150 à 200 personnes");
  await expectNoAxeViolation(page);
  await proposals.getByLabel("Nom du groupe").fill("Capacité");
  await proposals.getByRole("button", { name: "Ranger en palier" }).click();
  await expect(page.getByRole("region", { name: "Paliers repérés" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Capacité/, level: 3 })).toContainText("Palier");

  // Sur la fiche d'un lieu : un seul palier à la fois, et l'étiquette des lieux.
  await page.goto(`/prestataires/${venueId}`);
  const capacity = page.getByRole("group", { name: "Capacité · un seul choix" });
  await capacity.getByText("100 à 150 personnes", { exact: true }).click();
  await capacity.getByText("150 à 200 personnes", { exact: true }).click();
  await expect(capacity.getByRole("radio", { name: "150 à 200 personnes" })).toBeChecked();
  await expect(capacity.getByRole("radio", { name: "100 à 150 personnes" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Accès PMR" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /enregistr/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "150 à 200 personnes" })).toBeChecked();

  // Sur la fiche d'une fleuriste : pas d'étiquette réservée aux lieux.
  await page.goto(`/prestataires/${floristId}`);
  await expect(page.getByRole("radio", { name: "100 à 150 personnes" })).toBeAttached();
  await expect(page.getByRole("checkbox", { name: "Accès PMR" })).toHaveCount(0);
});

test("Décision 6 — Tâches : vocabulaire neutre quand les événements sont de plusieurs types, celui de l'événement sur chaque ligne", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-lot20-vocab-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot20-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await addStarterEventTypes(organization.id, starterEventTypes("fr", "wedding_planner"));
    const types = await listEventTypes(organization.id);
    const typeOf = (key: string) => types.find((type) => type.starterKey === key)!.id;
    const source = await createProspectSource(organization.id, "Salon");
    const create = async (firstName: string, eventTypeId: string) =>
      (await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName, lastName: null }], eventTypeId })).id;
    const wedding = await create("Camille", typeOf("wedding"));
    const seminar = await create("Arteka", typeOf("seminar"));
    await addEventTask(organization.id, wedding, { label: "Choisir les alliances", dueDate: "2027-03-01", responsible: "clients" });
    await addEventTask(organization.id, seminar, { label: "Valider le traiteur", dueDate: "2027-03-02", responsible: "clients" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
  await page.goto("/taches");
  await expect(page.getByRole("columnheader", { name: "Événement" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Choisir les alliances/ })).toContainText("Mariés");
  await expect(page.getByRole("row", { name: /Valider le traiteur/ })).toContainText("Clients");
  await expectNoAxeViolation(page);
});
