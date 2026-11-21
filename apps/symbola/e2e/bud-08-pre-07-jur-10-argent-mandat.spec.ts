// Lot 48b (BUD-08, PRE-07, JUR-10 ; D6 ; ADR 0093) — honoraires à part du budget, commissions
// affichées d'office à un particulier (devis, portail), modes intermédiaire et revendeur sur le devis ;
// en taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventVendorSlot, addVendorCandidate, createEventLink, createProspect, createProspectSource, updateVendorCandidate } from "../modules/events/service";
import { addQuoteLine, createQuote } from "../modules/quotes/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { createVendor } from "../modules/vendors/service";
import AxeBuilder from "./axe";
import { readyOrganization, signIn } from "./helpers";
import { openQuoteRubric } from "./devis-rubriques";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const email = `planner-48b-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const organizationId = organization.id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000 });
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-48b", role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-09-04" });
    const { vendor } = await createVendor(organizationId, { name: "Fleurs d'Élodie", typeId: null });
    const slot = await addEventVendorSlot(organizationId, event.id, "Fleuriste");
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot.id, vendorName: vendor.name, vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: owner.id });
    const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150_000, vatRateBasisPoints: 2000 });
    await addQuoteLine(organizationId, quote.id, { label: "Fleurs de la cérémonie", unit: "forfait", quantityMilli: 1000, unitPriceCents: 285_000, vatRateBasisPoints: 2000, supplyMode: "intermediary" });
    const link = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: owner.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Léa", email: `lea-${randomUUID()}@symbola.test`, rights: { rubrics: ["quotes", "budget"], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, eventId: event.id, quoteId: quote.id, clientUrl: link.url };
  } finally {
    await sql.end();
  }
}

test("BUD-08 / PRE-07 / JUR-10 — honoraires à part, commission montrée d'office à Léa, prestation intermédiaire hors du total", async ({ page, browser }) => {
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);

  // Honoraires et commission de l'évènement.
  await page.goto(`/devis/argent/${setup.eventId}`);
  const fees = page.getByRole("region", { name: "Vos honoraires" });
  await fees.getByLabel("Forme").selectOption("flat");
  await fees.getByLabel("Forfait (€ HT)").fill("1500");
  await fees.getByRole("button", { name: "Enregistrer les honoraires" }).click();
  await expect(fees.getByText("Honoraires : 1 500,00 € HT")).toBeVisible();
  const commissions = page.getByRole("region", { name: "Commissions et apports d'affaires" });
  await expect(commissions.getByText("Client particulier : chaque commission lui est montrée").first()).toBeVisible();
  await commissions.getByLabel("Montant (€ HT)").fill("200");
  await commissions.getByRole("button", { name: "Tracer la commission" }).click();
  await expect(commissions.getByText(/Fleurs d'Élodie · 200,00/)).toBeVisible();
  await expectNoAxeViolation(page);

  // Le devis : la prestation intermédiaire est hors du total ; la commission est listée.
  await page.goto(`/devis/${setup.quoteId}?rubrique=honoraires`);
  const money = page.getByRole("region", { name: "Vos honoraires, vos commissions et vos modes" });
  await expect(money).toContainText("Facturé par les prestataires (pour information)");
  await expect(money).toContainText("2 850,00");
  await expect(money).toContainText("Fleurs d'Élodie : 200,00 € (commission)");
  await expectNoAxeViolation(page);
  await openQuoteRubric(page, "lignes");
  await expect(page.getByText("facturée par le prestataire, hors total")).toBeVisible();
  await expectNoAxeViolation(page);

  // Le budget : les honoraires forment une ligne à part.
  await page.goto(`/budget/${setup.eventId}/detail`);
  await expect(page.getByRole("region", { name: "Honoraires de la planner" })).toContainText("1 500,00");

  // Léa, particulière, voit la commission dans son portail, sans case pour la masquer.
  const clientContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const client = await clientContext.newPage();
  await client.goto(setup.clientUrl);
  await expect(client).toHaveURL(/\/portail$/);
  await expect(client.getByRole("region", { name: "Commissions perçues par votre organisatrice" })).toContainText("Fleurs d'Élodie : 200,00 € (commission)");
  await expectNoAxeViolation(client);
  await clientContext.close();
});
