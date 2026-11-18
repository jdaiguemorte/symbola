// Lot 48a (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; ADR 0093) — pièces à échéance, contraintes du lieu
// et contrôle du chrono, IBAN changé « à vérifier par un autre canal », note confidentielle ; en taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  addEventPlace,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createProspect,
  createProspectSource,
  updateVendorCandidate,
} from "../modules/events/service";
import { createVendor, ensureVenueRuleFields, listVendorDocumentKinds, listVendorTypes, requestVendorDocument, seedStarterVendorCatalog } from "../modules/vendors/service";
import { vendorCatalogInput } from "../lib/vendors/catalog";
import AxeBuilder from "./axe";
import { readyOrganization, signIn } from "./helpers";

const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const NO_RIGHTS = { rubrics: [], budgetScope: "all" as const, sharedSlotIds: [] };

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const email = `planner-48a-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const organizationId = organization.id;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-48a", role: "owner" });
    await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), { withTypes: true });
    await ensureVenueRuleFields(organizationId, "fr");
    const types = await listVendorTypes(organizationId);
    const venueType = types.find((type) => type.starterKey === "venue")!;
    const musicType = types.find((type) => type.starterKey === "music")!;
    const field = (rule: string) => venueType.fields.find((candidate) => candidate.ruleKey === rule)!.id;
    const { vendor: castle } = await createVendor(organizationId, {
      name: "Château de Lilas",
      typeId: venueType.id,
      phone: "03 20 00 00 00",
      fieldValues: { [field("music_end")]: "01:00", [field("capacity_seated")]: 100 },
    });
    const { vendor: dj } = await createVendor(organizationId, { name: "DJ Nova", typeId: musicType.id });
    const { vendor: florist } = await createVendor(organizationId, { name: "Fleurs d'Élodie", typeId: null, phone: "06 12 34 56 78" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: "2027-09-04" });
    await addEventPlace(organizationId, event.id, { label: "Château de Lilas", vendorId: castle.id });
    const musicSlot = await addEventVendorSlot(organizationId, event.id, "Musique");
    const djCandidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: musicSlot.id, vendorName: dj.name, vendorId: dj.id });
    await updateVendorCandidate({ organizationId, candidateId: djCandidate.id, status: "retained", changedByUserId: owner.id });
    await addProgramItem(organizationId, event.id, { startTime: "22:30", endTime: "02:00", label: "Soirée dansante", vendorSlotIds: [musicSlot.id], freeParticipants: [] });
    const flowersSlot = await addEventVendorSlot(organizationId, event.id, "Fleuriste");
    const floristCandidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: flowersSlot.id, vendorName: florist.name, vendorId: florist.id });
    await updateVendorCandidate({ organizationId, candidateId: floristCandidate.id, status: "retained", changedByUserId: owner.id });
    const [insurance] = await listVendorDocumentKinds(organizationId, "fr");
    await requestVendorDocument({ organizationId, vendorId: florist.id, kindId: insurance!.id });
    const link = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "vendor",
      vendorCandidateId: floristCandidate.id,
      locale: "fr",
      link: { personName: "Élodie", email: `elodie-${randomUUID()}@symbola.test`, rights: NO_RIGHTS },
    });
    return { email, eventId: event.id, floristId: florist.id, castleId: castle.id, vendorUrl: link.url, insuranceLabel: insurance!.label };
  } finally {
    await sql.end();
  }
}

test("PRE-05 / PRE-10 / SEC-27 — le fleuriste dépose sa pièce et change son IBAN par son lien ; la planner vérifie par téléphone", async ({ page, browser }) => {
  const setup = await atelier();

  // Le prestataire, par son lien : la pièce demandée, puis son IBAN.
  const vendorContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const vendor = await vendorContext.newPage();
  await vendor.goto(setup.vendorUrl);
  await expect(vendor).toHaveURL(/\/prestataire$/);
  const records = vendor.getByRole("region", { name: "Vos pièces et vos coordonnées bancaires" });
  await expect(records).toContainText(setup.insuranceLabel);
  await records.getByLabel(`Fichier : ${setup.insuranceLabel}`).setInputFiles({ name: "rc-2027.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
  await records.getByLabel("Valable jusqu'au (facultatif)").fill("2027-06-30");
  await records.getByRole("button", { name: "Envoyer la pièce" }).click();
  await expect(records.getByText("Pièce envoyée : l'organisatrice la vérifiera.")).toBeVisible();
  await records.getByLabel("IBAN", { exact: true }).fill("FR76 3000 6000 0112 3456 7890 189");
  await records.getByRole("button", { name: "Envoyer l'IBAN" }).click();
  await expect(records.getByText("IBAN envoyé : l'organisatrice vous appellera pour le vérifier.")).toBeVisible();
  await expectNoAxeViolation(vendor);
  await vendorContext.close();

  // La planner : bandeau « à vérifier par un autre canal », pièce à vérifier qui expire avant l'évènement.
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/prestataires/${setup.floristId}`);
  const banner = page.getByRole("alert").filter({ hasText: "IBAN changé : à vérifier par un autre canal" });
  await expect(banner).toContainText("Le prestataire a changé son IBAN par son lien");
  await expect(banner).toContainText("06 12 34 56 78");
  await expect(page.getByText("FR76 •••• •••• 0189")).toBeVisible();
  await expect(page.getByText("FR7630006000011234567890189")).toHaveCount(0);
  const documents = page.getByRole("region", { name: "Pièces" });
  await expect(documents).toContainText("déposée par le prestataire, à vérifier");
  await expectNoAxeViolation(page);
  await documents.getByRole("button", { name: `Marquer « ${setup.insuranceLabel} » comme vérifiée` }).click();
  await expect(documents).not.toContainText("déposée par le prestataire, à vérifier");

  // Critère : le bandeau reste jusqu'à la levée, nominative et horodatée.
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "IBAN changé" })).toBeVisible();
  await page.getByRole("button", { name: "J'ai vérifié par téléphone" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "IBAN changé" })).toHaveCount(0);
  await page.getByText(/Changements d'IBAN/).click();
  await expect(page.getByText(/Vérifié le .* par vous\./)).toBeVisible();

  // DAT-08 : la note confidentielle.
  const note = page.getByRole("region", { name: "Note interne" });
  await note.getByLabel("Note", { exact: true }).fill("Litige de paiement en 2026");
  await note.getByLabel("Confidentielle").check();
  await note.getByRole("button", { name: "Enregistrer la note" }).click();
  await expect(note.getByText("Note enregistrée.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Aujourd'hui : la pièce expire avant l'évènement du 4 septembre.
  await page.goto("/");
  await expect(page.getByText(`${setup.insuranceLabel} de Fleurs d'Élodie : expire avant l'évènement`).first()).toBeVisible();
});

test("PRE-06 — les contraintes du lieu signalent la soirée qui dépasse la fin de la musique, sans rien bloquer", async ({ page }) => {
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  const venue = page.getByRole("region", { name: "Contraintes du lieu" });
  await expect(venue).toContainText("Château de Lilas demande la fin de la musique à 01:00 : « Soirée dansante » finit plus tard.");
  await expect(venue).toContainText("rien n'est bloqué");
  await expectNoAxeViolation(page);
  // La fiche du lieu montre ses contraintes.
  await page.goto(`/prestataires/${setup.castleId}`);
  await expect(page.getByText("Fin de la musique")).toBeVisible();
});
