// Lot 50 — INV-05 (plan de table) et INV-06 (synthèse pour le traiteur), scénario SC-07 étape 6
// (persona SU-01, Camille), en taille ordinateur et en 375 px (projets de playwright.config.ts) :
// - placer un invité au clavier seul (« Déplacer », liste des tables, annonce, focus qui suit), placer
//   tout un foyer d'un geste, glisser-déposer à la souris (ordinateur) ; les non placés restent
//   visibles avec leur nombre (colonne, ou onglet à 375 px) ; aucun défilement horizontal ; axe-core ;
// - tables en série, contrainte « séparés » signalée sans bloquer, synthèse pour le traiteur en un
//   clic (tableur nominatif pour la titulaire) ;
// - ARC-07 : sans le module Invités, la page répond « indisponible », jamais une erreur.
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { addKeyMoment, createProspect, createProspectSource } from "../modules/events/service";
import { setModuleEnabled } from "../modules/hub/service";
import { addSeatingTables, confirmImpactAssessment, createSeatingPlan, listHouseholds, recordHouseholdAnswers, saveGuestEventSettings, saveHousehold } from "../modules/guests/service";
import { readyOrganization, signIn } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function organization(options: { guests: boolean }) {
  const email = `owner-plan-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Org PLAN ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
    if (options.guests) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "guests", enabled: true });
  } finally {
    await sql.end();
  }
  if (options.guests) await confirmImpactAssessment(organizationId, ownerId);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Petit" }], eventDate: "2027-06-12" });
  return { organizationId, ownerId, email, eventId: event.id };
}

// Le dîner du mariage de référence : Jeanne et Paul Durand, Antoine Leroy présents ; Claire Morel
// n'a pas répondu.
async function dinner(options: { plan: boolean }) {
  const org = await organization({ guests: true });
  const moment = await addKeyMoment(org.organizationId, org.eventId, { name: "Dîner", date: "2027-06-12", startTime: "19:30" });
  await saveGuestEventSettings(org.organizationId, org.eventId, { responsesCloseOn: "2027-05-13", askDiet: true, askAccommodation: false, askTransport: false, reminderDays: [21, 7] });
  const households = [
    { displayName: "Famille Durand", people: [{ kind: "adult" as const, firstName: "Jeanne", lastName: "Durand", phone: "06 12 34 56 78" }, { kind: "adult" as const, firstName: "Paul", lastName: "Durand" }] },
    { displayName: "Antoine Leroy", people: [{ kind: "adult" as const, firstName: "Antoine", lastName: "Leroy", email: `antoine-${randomUUID().slice(0, 6)}@example.test` }] },
    { displayName: "Claire Morel", people: [{ kind: "adult" as const, firstName: "Claire", lastName: "Morel", email: `claire-${randomUUID().slice(0, 6)}@example.test` }] },
  ];
  for (const input of households) await saveHousehold(org.organizationId, org.eventId, null, input);
  for (const household of await listHouseholds(org.organizationId, org.eventId, { kind: "owner" })) {
    if (household.displayName === "Claire Morel") continue;
    await recordHouseholdAnswers(org.organizationId, org.eventId, household.id, household.people.map((person) => ({ guestId: person.id, keyMomentId: moment.id, attending: true })), "planner");
  }
  if (options.plan) {
    const planId = await createSeatingPlan(org.organizationId, org.eventId, moment.id);
    await addSeatingTables(org.organizationId, org.eventId, planId, { count: 2, shape: "round", capacity: 10, namePrefix: "Table" });
  }
  return { ...org, momentId: moment.id };
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

test("INV-05 (SU-01) — Camille place un invité au clavier seul, puis tout un foyer ; les non placés restent visibles ; accessible", async ({ page }) => {
  const org = await dinner({ plan: true });
  await signIn(page, org.email);
  await page.goto(`/events/${org.eventId}/invites/plan?temps=${org.momentId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Plan de table" })).toBeVisible();
  await expect(page.getByText("3 présents non placés · 1 en attente de réponse")).toBeVisible();
  // À 375 px, les non placés sont un onglet qui porte leur nombre ; sur ordinateur, une colonne.
  if (isMobile(page)) {
    await page.getByRole("button", { name: "Non placés (3)" }).click();
    await expectNoHorizontalScroll(page);
  }
  await expect(page.getByRole("heading", { name: "Non placés (3)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "En attente de réponse (1)" })).toBeVisible();
  await expectAccessible(page);

  // Au clavier seul : « Déplacer Antoine Leroy », la liste des tables, Entrée.
  await page.getByRole("button", { name: "Déplacer Antoine Leroy" }).focus();
  await page.keyboard.press("Enter");
  const list = page.getByRole("list", { name: "Où déplacer Antoine Leroy" });
  await expect(list).toBeVisible();
  await expect(list.getByRole("button", { name: "Table 1", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Antoine Leroy déplacé vers « Table 1 »." })).toBeAttached();
  // Le focus suit l'invité dans sa table ; à 375 px, la table est dans l'autre onglet : il revient au
  // titre des non placés, jamais perdu.
  if (isMobile(page)) await expect(page.getByRole("heading", { name: "Non placés (2)" })).toBeFocused();
  else await expect(page.getByRole("button", { name: "Déplacer Antoine Leroy" })).toBeFocused();
  await expect(page.getByText("2 présents non placés · 1 en attente de réponse")).toBeVisible();

  // Tout le foyer Durand d'un geste, à la Table 2.
  await page.getByRole("button", { name: "Déplacer tout le foyer Famille Durand" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("list", { name: "Où déplacer tout le foyer Famille Durand" }).getByRole("button", { name: "Table 2", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Foyer Famille Durand : 2 personnes placées à « Table 2 »." })).toBeAttached();
  await expect(page.getByText("Tous les présents sont placés · 1 en attente de réponse")).toBeVisible();

  // Enregistré côté serveur : après rechargement, les tables le montrent.
  await page.reload();
  if (isMobile(page)) {
    await expect(page.getByRole("button", { name: "Non placés (0)" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
  const table2 = page.locator(".seating-table").filter({ has: page.getByRole("heading", { name: "Table 2", exact: true }) });
  await expect(table2.getByText("Jeanne Durand", { exact: true })).toBeVisible();
  await expect(table2.getByText("2 sur 10 places", { exact: false })).toBeVisible();
  await expectAccessible(page);
});

test("INV-05 — glisser-déposer à la souris (ordinateur)", async ({ page }) => {
  test.skip(isMobile(page), "le glisser-déposer est une voie de la souris ; à 375 px, le bouton « Déplacer » sert au doigt");
  const org = await dinner({ plan: true });
  await signIn(page, org.email);
  await page.goto(`/events/${org.eventId}/invites/plan?temps=${org.momentId}`);
  const antoine = page.locator("[data-move-item]").filter({ hasText: "Antoine Leroy" });
  const table1 = page.locator(".seating-table").filter({ has: page.getByRole("heading", { name: "Table 1", exact: true }) });
  await antoine.dragTo(table1);
  await expect(page.getByRole("status").filter({ hasText: "Antoine Leroy déplacé vers « Table 1 »." })).toBeAttached();
  await page.reload();
  await expect(page.locator(".seating-table").filter({ has: page.getByRole("heading", { name: "Table 1", exact: true }) }).getByText("Antoine Leroy", { exact: true })).toBeVisible();
});

test("INV-05, INV-06 — tables en série, contrainte signalée sans bloquer, synthèse pour le traiteur en un clic", async ({ page }) => {
  const org = await dinner({ plan: false });
  await signIn(page, org.email);
  await page.goto(`/events/${org.eventId}?onglet=invites`);
  await page.getByRole("link", { name: "Plan de table et synthèse pour le traiteur" }).click();
  await page.getByRole("button", { name: "Composer le plan de « Dîner »" }).click();

  // « 12 tables rondes de 10 ».
  await page.getByText("Ajouter des tables", { exact: true }).click();
  await page.getByLabel("Nombre de tables").fill("12");
  await expect(page.getByLabel("Places par table")).toHaveValue("10");
  await page.getByRole("button", { name: "Ajouter les tables" }).click();
  await expect(page.getByRole("heading", { name: "Tables (12)" })).toBeAttached();

  // « Séparés » entre Jeanne et Paul, puis tout le foyer à la Table 1 : signalé, pas refusé.
  await page.getByText("Ajouter une contrainte", { exact: true }).click();
  await page.getByLabel("Séparés", { exact: true }).check();
  await page.getByLabel("Jeanne Durand", { exact: true }).check();
  await page.getByLabel("Paul Durand", { exact: true }).check();
  await page.getByRole("button", { name: "Ajouter la contrainte" }).click();
  await expect(page.getByText("Séparés : Jeanne Durand, Paul Durand", { exact: true })).toBeVisible();
  if (isMobile(page)) await page.getByRole("button", { name: /Non placés/ }).click();
  await page.getByRole("button", { name: "Déplacer tout le foyer Famille Durand" }).click();
  await page.getByRole("list", { name: "Où déplacer tout le foyer Famille Durand" }).getByRole("button", { name: "Table 1", exact: true }).click();
  await expect(page.getByText("« Séparés » non tenu : Jeanne Durand, Paul Durand sont ensemble à Table 1.")).toBeVisible();
  await expectAccessible(page);
  if (isMobile(page)) await expectNoHorizontalScroll(page);

  // Un clic : le tableur nominatif (la titulaire), tel qu'Excel l'ouvre.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tableur nominatif" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("synthese-traiteur-nominative-diner-2027-06-12.csv");
  const csv = await readFile((await file.path())!, "utf-8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.slice(1).trimEnd().split("\r\n");
  expect(lines[0]).toBe("Table;Nom;Type de repas;Régimes et allergies;Nombre;Réponse");
  expect(lines).toContain("Table 1;Jeanne Durand;Adulte;;1;Présent");
  expect(lines).toContain("Sans table;Antoine Leroy;Adulte;;1;Présent");
  expect(lines).toContain(";Claire Morel;Adulte;;1;En attente de réponse");
  // Les contraintes ne sortent jamais.
  expect(csv).not.toContain("Séparés");
});

test("ARC-07 (lot 50) — sans le module Invités, le plan de table répond « indisponible », jamais une erreur", async ({ page }) => {
  const org = await organization({ guests: false });
  await signIn(page, org.email);
  const response = await page.goto(`/events/${org.eventId}/invites/plan`);
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Le plan de table est indisponible : le module Invités n'est pas ouvert pour votre organisation.")).toBeVisible();
  const download = await page.request.get(`/events/${org.eventId}/invites/plan/synthese?temps=${randomUUID()}&format=csv&version=nominative`);
  expect(download.status()).toBe(404);
  await page.goto("/events/parametres/repas");
  await expect(page.getByText("Les types de repas sont indisponibles : le module Invités n'est pas ouvert pour votre organisation.")).toBeVisible();
  await expectAccessible(page);
});
