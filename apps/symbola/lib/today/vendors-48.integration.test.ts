// Lot 48a (PRE-05, PRE-10, SEC-27 ; ADR 0093) — « Aujourd'hui » signale la pièce d'un prestataire retenu
// qui expire avant l'évènement (critère de PRE-05), une pièce déposée « à vérifier » et un IBAN changé
// « à vérifier par un autre canal » ; rien sans le module des prestataires (ARC-06) ; rien pour une
// autre organisation.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { addEventVendorSlot, addVendorCandidate, createProspect, createProspectSource, updateVendorCandidate } from "@/modules/events/service";
import { addVendorDocument, createVendor, listVendorDocumentKinds, setVendorBankDetails, verifyVendorBankDetails } from "@/modules/vendors/service";
import { loadTodayItems, type TodayWords } from "./load";

const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const words: TodayWords = {
  clientTask: "Tâche confiée au client",
  amount: (label, amount) => `${label} · ${amount}`,
  decision: (title) => `Choix : ${title}`,
  paymentDeclaration: (label, amount) => `${label} · ${amount}`,
  quoteFollowUp: (number) => `Devis ${number}`,
  prospectFollowUp: "Prospect sans nouvelle",
  depositBlocked: (number) => `Acompte ${number}`,
  vendorContract: (vendorName, slotLabel) => `Contrat de ${vendorName} (${slotLabel})`,
  dateConflict: (count) => `${count} évènements`,
  linkRenewal: (personName) => `Lien ${personName}`,
  vendorDocument: (vendor, document, reason) => `${document} de ${vendor} : ${reason}`,
  vendorBankCheck: (vendor) => `IBAN de ${vendor} à vérifier`,
};

function plusDays(days: number): string {
  const date = new Date(`${parisToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("PRE-05 / PRE-10 — Aujourd'hui : pièces et IBAN des prestataires (lot 48a)", () => {
  it("la pièce d'un prestataire retenu qui expire avant l'évènement, et un IBAN changé, y sont signalés ; levés, ils disparaissent", async () => {
    const db = appDatabase();
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const planner = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const eventId = (await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: plusDays(120) })).id;
    const { vendor } = await createVendor(organizationId, { name: "Fleurs d'Élodie", typeId: null });
    const slot = await addEventVendorSlot(organizationId, eventId, "Fleuriste");
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName: vendor.name, vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: planner.id });
    const [insurance] = await listVendorDocumentKinds(organizationId, "fr");
    await addVendorDocument({ organizationId, vendorId: vendor.id, kindId: insurance!.id, fileName: "rc.pdf", content: PDF, validUntil: plusDays(90), userId: planner.id });
    await setVendorBankDetails(organizationId, vendor.id, { iban: "FR7630006000011234567890189", bic: null }, { kind: "link", linkId: randomUUID() });

    const { items } = await loadTodayItems(organizationId, { events: true, quotes: false, budget: false, vendors: true }, words, "fr");
    const titles = items.filter((item) => item.kind === "vendor_document" || item.kind === "vendor_bank_check").map((item) => [item.kind, item.title, item.eventId]);
    expect(titles).toContainEqual(["vendor_bank_check", "IBAN de Fleurs d'Élodie à vérifier", null]);
    expect(titles).toContainEqual(["vendor_document", `${insurance!.label} de Fleurs d'Élodie : lapses_before_event`, eventId]);

    // ARC-06 : sans le module des prestataires, rien.
    const closed = await loadTodayItems(organizationId, { events: true, quotes: false, budget: false, vendors: false }, words, "fr");
    expect(closed.items.some((item) => item.kind === "vendor_document" || item.kind === "vendor_bank_check")).toBe(false);
    // Une autre organisation ne voit rien.
    const other = await createOrganization(db, `Org ${randomUUID()}`);
    const foreign = await loadTodayItems(other.id, { events: true, quotes: false, budget: false, vendors: true }, words, "fr");
    expect(foreign.items).toEqual([]);

    await verifyVendorBankDetails(organizationId, vendor.id, planner.id);
    const after = await loadTodayItems(organizationId, { events: true, quotes: false, budget: false, vendors: true }, words, "fr");
    expect(after.items.some((item) => item.kind === "vendor_bank_check")).toBe(false);
  });
});

describe("PRE-05 — la pièce qui expire avant un évènement lointain reste visible dans « Aujourd'hui »", () => {
  it("elle est à traiter maintenant, pas cachée au-delà de l'horizon de quatorze jours", async () => {
    const { rankToday } = await import("./rank");
    const db = appDatabase();
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const planner = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const eventId = (await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: plusDays(300) })).id;
    const { vendor } = await createVendor(organizationId, { name: "DJ Nova", typeId: null });
    const slot = await addEventVendorSlot(organizationId, eventId, "Musique");
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName: vendor.name, vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: planner.id });
    const [insurance] = await listVendorDocumentKinds(organizationId, "fr");
    await addVendorDocument({ organizationId, vendorId: vendor.id, kindId: insurance!.id, fileName: "rc.pdf", content: PDF, validUntil: plusDays(200), userId: planner.id });
    const { items, today } = await loadTodayItems(organizationId, { events: true, quotes: false, budget: false, vendors: true }, words, "fr");
    expect(rankToday(items, today).all.map((item) => item.title)).toContain(`${insurance!.label} de DJ Nova : lapses_before_event`);
  });
});
