// Lot 60 — L60-PLA-01 à L60-PLA-05 (prolongement de PRE-06), scénario SC-60 proposé (persona SU-01,
// Camille ; Karim, le traiteur), en taille ordinateur et en 375 px (projets de playwright.config.ts) :
// - placer, déplacer et tourner une table au clavier seul (Tab, flèches, R), chaque action annoncée ;
//   la liste des éléments, équivalente au dessin ; enregistré côté serveur ; axe-core ;
// - à 375 px : la modification passe par le panneau des propriétés, sans défilement horizontal ;
// - le prestataire retenu voit, par son lien, son emplacement en évidence et sa prise ; le client lit
//   le plan par sa rubrique « Plan de salle », fermée par défaut ;
// - ARC-07 : sans le module Plans de salle, « indisponible », jamais une erreur, et aucune entrée.
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { addEventPlace, addEventVendorSlot, addVendorCandidate, createEventLink, createProspect, createProspectSource, selectVendorCandidate } from "../modules/events/service";
import { setModuleEnabled } from "../modules/hub/service";
import { createVendor, listVendorTypes } from "../modules/vendors/service";
import { copyVenueLayoutToEvent, createLayout, createVenueSpace, getLayoutEditor, getSpace, publishEventLayout, saveFixtures, saveLayoutElements } from "../modules/floorplans/service";
import { readyOrganization, signIn } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

// Camille, son organisation (module Plans de salle ouvert ou non) et le Château des Essais : une salle
// de 20 × 12 m, une prise de deux prises 16 A, une configuration vide « Dîner ».
async function chateau(options: { floorplans: boolean }) {
  const email = `owner-l60-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await readyOrganization(db, `Org L60 ${randomUUID().slice(0, 6)}`)).id;
    ownerId = (await createUser(db, { organizationId, email, role: "owner" })).id;
    if (options.floorplans) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "floorplans", enabled: true });
  } finally {
    await sql.end();
  }
  const venueType = (await listVendorTypes(organizationId)).find((type) => type.starterKey === "venue") ?? null;
  const { vendor } = await createVendor(organizationId, { name: "Château des Essais", typeId: venueType?.id ?? null });
  const spaceId = await createVenueSpace(organizationId, vendor.id, { name: "Salle des fêtes", widthCm: 2000, depthCm: 1200 });
  await saveFixtures(organizationId, spaceId, [{ kind: "outlet", label: "Prise scène", xCm: 100, yCm: 20, widthCm: 40, depthCm: 20, rotationDeg: 0, outletCount: 2, amps: 16, threePhase: false, note: null }]);
  const layoutId = await createLayout(organizationId, spaceId, "Dîner");
  return { organizationId, ownerId, email, vendorId: vendor.id, spaceId, layoutId };
}

test("L60-PLA-02 (SU-01) — Camille pose, déplace et tourne une table au clavier seul ; la liste équivaut au dessin ; accessible", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await chateau({ floorplans: true });
  await signIn(page, setup.email);
  await page.goto(`/plans-de-salle/${setup.layoutId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Dîner" })).toBeVisible();
  await expectAccessible(page);
  if (isMobile(page)) await expectNoHorizontalScroll(page);

  const status = page.locator(".plan-status");
  // Au clavier seul : « Ajouter : Table ronde », Entrée ; le focus va sur la table posée.
  await page.getByRole("button", { name: "Ajouter : Table ronde" }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Table ronde ajouté à x 10,00 m, y 6,00 m.");
  const roundTable = page.getByRole("button", { name: /^Table ronde, à x/ });
  await expect(roundTable).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Table ronde déplacé à x 10,10 m, y 6,00 m.");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(status).toHaveText("Table ronde déplacé à x 10,10 m, y 7,00 m.");
  await page.keyboard.press("r");
  await expect(status).toHaveText("Table ronde tourné à 15°.");
  await expect(roundTable).toHaveAccessibleName("Table ronde, à x 10,10 m, y 7,00 m, tourné de 15°");

  // La liste des éléments, équivalente au dessin.
  const list = page.getByRole("region", { name: "Liste des éléments" });
  await expect(list).toContainText("Table ronde");
  await expect(list).toContainText("10 places");
  await expect(list).toContainText("x 10,10 m, y 7,00 m, 15°");
  await expect(page.getByRole("region", { name: "Contrôles" })).toContainText("10 places assises");

  // Enregistrer (clavier), puis relire depuis le serveur.
  await page.getByRole("button", { name: "Enregistrer", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Plan enregistré.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Liste des éléments" })).toContainText("x 10,10 m, y 7,00 m, 15°");

  // Le panneau des propriétés (la voie du téléphone) : nom et position x saisis au clavier.
  await page.getByRole("region", { name: "Liste des éléments" }).getByRole("button", { name: "Table ronde" }).click();
  const panel = page.getByRole("region", { name: "Propriétés" });
  await panel.getByLabel("Nom ou numéro").fill("Table 1");
  await panel.getByLabel("Position x (m)").fill("5");
  await panel.getByLabel("Position x (m)").press("Enter");
  await expect(page.getByRole("region", { name: "Liste des éléments" })).toContainText("x 5,00 m, y 7,00 m, 15°");
  await expect(page.getByRole("region", { name: "Liste des éléments" }).getByRole("button", { name: "Table 1" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(status).toHaveText("Plan enregistré.");
  const saved = await getLayoutEditor(setup.organizationId, setup.layoutId);
  expect(saved.layout.elements).toEqual([expect.objectContaining({ name: "Table 1", xCm: 500, yCm: 700, rotationDeg: 15, seats: 10 })]);
  if (isMobile(page)) await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("L60-PLA-01 — les plans d'un lieu : espaces, installations, configurations et leur capacité", async ({ page }) => {
  const setup = await chateau({ floorplans: true });
  const view = await getLayoutEditor(setup.organizationId, setup.layoutId);
  await saveLayoutElements(setup.organizationId, setup.layoutId, view.layout.revision, [
    { id: null, elementTypeId: null, typeStarterKey: "round_table", typeLabel: null, category: "table", shape: "circle", name: "Table 1", xCm: 500, yCm: 500, widthCm: 180, depthCm: 180, rotationDeg: 0, seats: 10, color: null, note: null, vendorCandidateId: null, powerOutlets: 0, powerAmps: null, needsWater: false, maxCableM: null, fixtureId: null },
  ]);
  await signIn(page, setup.email);
  await page.goto(`/prestataires/${setup.vendorId}`);
  await page.getByRole("link", { name: "Ouvrir les plans de salle du lieu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Plans de salle" })).toBeVisible();
  const space = page.getByRole("region", { name: "Salle des fêtes" });
  await expect(space).toContainText("20 × 12 m");
  await expect(space).toContainText("1 installation");
  await expect(space).toContainText("10 places assises · 1 élément");
  await expectAccessible(page);
  if (isMobile(page)) await expectNoHorizontalScroll(page);
  await space.getByRole("link", { name: "Dimensions, fond de plan et installations de Salle des fêtes" }).click();
  await expect(page.getByRole("region", { name: "Liste des installations" })).toContainText("Prise scène");
  await expectAccessible(page);
  if (isMobile(page)) await expectNoHorizontalScroll(page);
});

test("L60-PLA-04, L60-PLA-05 — Karim voit son emplacement en évidence par son lien ; le client lit le plan par sa rubrique, fermée par défaut", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const setup = await chateau({ floorplans: true });
  const { organizationId, ownerId } = setup;
  const fixtureId = (await getSpace(organizationId, setup.spaceId))!.fixtures[0]!.id;
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
  await addEventPlace(organizationId, event.id, { label: "Château des Essais", vendorId: setup.vendorId });
  const slot = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const karim = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot.id, vendorName: "Traiteur Karim" });
  await selectVendorCandidate({ organizationId, candidateId: karim.id, changedByUserId: ownerId });
  const layoutId = await copyVenueLayoutToEvent(organizationId, event.id, setup.layoutId);
  const view = await getLayoutEditor(organizationId, layoutId);
  await saveLayoutElements(organizationId, layoutId, view.layout.revision, [
    { id: null, elementTypeId: null, typeStarterKey: "buffet", typeLabel: null, category: "setup", shape: "rect", name: null, xCm: 600, yCm: 200, widthCm: 400, depthCm: 80, rotationDeg: 0, seats: 0, color: null, note: "Note interne", vendorCandidateId: karim.id, powerOutlets: 2, powerAmps: 16, needsWater: false, maxCableM: null, fixtureId },
    { id: null, elementTypeId: null, typeStarterKey: "dj", typeLabel: null, category: "setup", shape: "rect", name: null, xCm: 1500, yCm: 200, widthCm: 200, depthCm: 100, rotationDeg: 0, seats: 0, color: null, note: null, vendorCandidateId: null, powerOutlets: 0, powerAmps: null, needsWater: false, maxCableM: null, fixtureId: null },
  ]);
  const karimLink = await createEventLink({ organizationId, eventId: event.id, createdByUserId: ownerId, audience: "vendor", vendorCandidateId: karim.id, locale: "fr", link: { personName: "Karim", email: `${randomUUID()}@symbola.test`, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } } });
  const closed = await createEventLink({ organizationId, eventId: event.id, createdByUserId: ownerId, audience: "client", locale: "fr", link: { personName: "Léa", email: `${randomUUID()}@symbola.test`, rights: { rubrics: ["program"], budgetScope: "all", sharedSlotIds: [] } } });
  const open = await createEventLink({ organizationId, eventId: event.id, createdByUserId: ownerId, audience: "client", locale: "fr", link: { personName: "Hugo", email: `${randomUUID()}@symbola.test`, rights: { rubrics: ["floorplan"], budgetScope: "all", sharedSlotIds: [] } } });

  // La planner diffuse depuis l'écran du plan.
  await signIn(page, setup.email);
  await page.goto(`/plans-de-salle/${layoutId}`);
  await page.getByRole("button", { name: "Diffuser le plan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Plan diffusé au client et aux prestataires retenus." })).toBeVisible();
  await expectAccessible(page);

  const viewport = page.viewportSize();
  const caterer = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  await caterer.goto(karimLink.url);
  await expect(caterer).toHaveURL(/\/prestataire$/);
  await expect(caterer.getByText("Une nouvelle version du plan est diffusée.")).toBeVisible();
  await caterer.getByRole("link", { name: "Voir le plan de salle" }).click();
  const mine = caterer.getByRole("note").filter({ hasText: "Votre emplacement" });
  await expect(mine).toContainText("Buffet — x 6,00 m, y 2,00 m · 2 prises 16 A · sur Prise scène");
  await expect(caterer.getByRole("main")).not.toContainText("Traiteur Karim · ");
  await expect(caterer.getByRole("main")).not.toContainText("Note interne");
  await expect(caterer.getByRole("main")).toContainText("DJ");
  await expectAccessible(caterer);
  if (isMobile(caterer)) await expectNoHorizontalScroll(caterer);
  const pdf = await caterer.request.get(`/prestataire/plan-de-salle/${layoutId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Le client : rien sans la rubrique ; avec elle, le plan en lecture.
  const lea = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  await lea.goto(closed.url);
  await expect(lea.getByRole("link", { name: "Voir le plan de salle" })).toHaveCount(0);
  await lea.goto("/portail/plan-de-salle");
  await expect(lea.getByText("Le plan de salle n'est pas partagé avec ce lien.")).toBeVisible();
  expect((await lea.request.get(`/portail/plan-de-salle/${layoutId}/pdf`)).status()).toBe(404);
  const hugo = await (await browser.newContext({ locale: "fr-FR", viewport })).newPage();
  await hugo.goto(open.url);
  await hugo.getByRole("link", { name: "Voir le plan de salle" }).click();
  await expect(hugo.getByRole("heading", { level: 2, name: "Dîner" })).toBeVisible();
  await expect(hugo.getByRole("main")).not.toContainText("Note interne");
  await expectAccessible(hugo);
  if (isMobile(hugo)) await expectNoHorizontalScroll(hugo);
  await publishEventLayout(organizationId, layoutId, ownerId);
});

test("ARC-07 (lot 60) — sans le module Plans de salle, « indisponible », jamais une erreur, et aucune entrée", async ({ page }) => {
  const setup = await chateau({ floorplans: false });
  await signIn(page, setup.email);
  const response = await page.goto(`/prestataires/${setup.vendorId}/plans`);
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Les plans de salle ne sont pas ouverts pour votre organisation.", { exact: false })).toBeVisible();
  await page.goto(`/prestataires/${setup.vendorId}`);
  await expect(page.getByRole("link", { name: "Ouvrir les plans de salle du lieu" })).toHaveCount(0);
  expect((await page.goto(`/plans-de-salle/${setup.layoutId}`))?.status()).toBe(404);
  expect((await page.request.get(`/plans-de-salle/${setup.layoutId}/pdf`)).status()).not.toBe(200);
  await page.goto("/plans-de-salle/bibliotheque");
  await expect(page.getByText("Les plans de salle ne sont pas ouverts pour votre organisation.", { exact: false })).toBeVisible();
  await expectAccessible(page);
});
