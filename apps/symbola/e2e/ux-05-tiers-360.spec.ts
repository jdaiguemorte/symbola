// Lot 30b (UX-05, décision D9) — le portail du client et l'espace du prestataire,
// conçus à 360 px : aucun défilement horizontal, chaque bouton, lien hors d'une phrase et
// case à cocher mesure au moins 44 px, axe-core. Portail ouvert avec toutes ses rubriques
// (tâches, programme, choix de prestataires, budget, devis) ; espace d'un traiteur retenu.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import {
  addEventPlace,
  addEventTask,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createProspect,
  createProspectSource,
  selectVendorCandidate,
  updateVendorCandidate,
} from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { expectTouchTargets, readyOrganization } from "./helpers";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectFitsIn360(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectTouchTargets(page, 44);
  await expectNoAxeViolation(page);
}

async function wedding() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const owner = await createUser(db, { organizationId, email: `planner-ux05-${randomUUID()}@symbola.test`, password: "mot-de-passe-tiers-e2e", role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: addDays(parisToday(), 200) });
    await addEventTask(organizationId, event.id, { label: "Choisir les alliances", dueDate: addDays(parisToday(), 5), responsible: "clients" });
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    const photographer = await addEventVendorSlot(organizationId, event.id, "Photographe");
    const { vendor } = await createVendor(organizationId, { name: "Maison Haddad", typeId: null, contactName: "Karim Haddad", email: `traiteur-${randomUUID()}@symbola.test` });
    const retained = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: vendor.name, vendorId: vendor.id });
    await selectVendorCandidate({ organizationId, candidateId: retained.id, changedByUserId: owner.id });
    for (const [name, cents] of [["Studio Lumière", 280000], ["Atelier Photo du Sud", 240000]] as const) {
      const option = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: photographer.id, vendorName: name });
      await updateVendorCandidate({ organizationId, candidateId: option.id, shownToClients: true, quoteAmountCents: cents });
    }
    await addEventPlace(organizationId, event.id, { label: "Domaine des Tilleuls", address: "1 allée des Tilleuls, Sarlat" });
    await addProgramItem(organizationId, event.id, { startTime: "15:30", endTime: "16:15", label: "Cérémonie laïque", responsible: "Camille", vendorSlotIds: [], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "17:00", endTime: "19:00", label: "Vin d'honneur", vendorSlotIds: [caterer.id], freeParticipants: [] });
    const couple = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Léa", email: `${randomUUID()}@symbola.test`, rights: { rubrics: ["tasks", "program", "vendor_options", "budget", "quotes"], budgetScope: "all", sharedSlotIds: [] } },
    });
    const caterersLink = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "vendor",
      vendorCandidateId: retained.id,
      locale: "fr",
      link: { personName: "Karim Haddad", email: `karim-${randomUUID()}@symbola.test`, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { coupleUrl: couple.url, vendorUrl: caterersLink.url };
  } finally {
    await sql.end();
  }
}

test.use({ viewport: { width: 360, height: 800 } });

test("UX-05 (D9) — portail du client à 360 px : rien ne déborde, cibles de 44 px, axe-core", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await page.goto(setup.coupleUrl);
  await expect(page).toHaveURL(/\/portail$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Toutes les rubriques sur une page : tâches, programme, prestataires proposés, budget.
  await expect(page.getByRole("region", { name: "Photographe" })).toContainText("Studio Lumière");
  await expectFitsIn360(page);
});

test("UX-05 (D9) — espace du prestataire à 360 px : rien ne déborde, cibles de 44 px, axe-core", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await page.goto(setup.vendorUrl);
  await expect(page).toHaveURL(/\/prestataire$/);
  await expect(page.getByRole("list", { name: "Vos horaires" })).toContainText("Vin d'honneur");
  await expectFitsIn360(page);
});
