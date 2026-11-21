// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — « Choisir un prestataire… » depuis la ligne du budget,
// contre un vrai PostgreSQL (RLS) : le métier du poste d'abord, retenir comme dans la consultation,
// créer puis retenir ; tests d'abus entre organisations.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { addDefaultVendorSlots, createProspect, createProspectSource, EventNotFoundError, listEventVendorSlots, listVendorCandidates } from "@/modules/events/service";
import { createVendor, createVendorType, VendorNotFoundError } from "@/modules/vendors/service";
import { createAndRetainVendor, retainVendorForSlot, searchSlotVendors } from "./slot-retention";

const userId = randomUUID();

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function wedding() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await addDefaultVendorSlots(organizationId, ["Fleurs"]);
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate: "2027-06-12" });
  const [slot] = await listEventVendorSlots(organizationId, eventId);
  const florist = await createVendorType(organizationId, `Fleuriste ${randomUUID().slice(0, 4)}`, "#2f6f5e");
  const caterer = await createVendorType(organizationId, `Traiteur ${randomUUID().slice(0, 4)}`, "#7a4b2a");
  const amarante = (await createVendor(organizationId, { name: "Amarante", typeId: caterer.id })).vendor;
  const floreal = (await createVendor(organizationId, { name: "Atelier Floréal", typeId: florist.id, city: "Lyon" })).vendor;
  return { organizationId, eventId, slotId: slot!.id, amarante, floreal, florist };
}

describe("BUD-04, PRE-02 — Rattacher un prestataire depuis la ligne du budget (lot 63c, #39)", () => {
  it("la recherche propose d'abord le métier du poste", async () => {
    const context = await wedding();
    const found = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, term: "", locale: "fr" });
    expect(found.map((vendor) => [vendor.name, vendor.matchesSlot])).toEqual([
      ["Atelier Floréal", true],
      ["Amarante", false],
    ]);
  });

  it("le choisir le retient pour ce poste, comme « Retenir » dans la consultation ; deux fois ne le double pas", async () => {
    const context = await wedding();
    await retainVendorForSlot({ organizationId: context.organizationId, userId, eventId: context.eventId, slotId: context.slotId, vendorId: context.floreal.id });
    await retainVendorForSlot({ organizationId: context.organizationId, userId, eventId: context.eventId, slotId: context.slotId, vendorId: context.floreal.id });
    const candidates = await listVendorCandidates(context.organizationId, context.eventId);
    expect(candidates.map((candidate) => [candidate.vendorName, candidate.vendorId, candidate.status])).toEqual([["Atelier Floréal", context.floreal.id, "retained"]]);
    expect((await listEventVendorSlots(context.organizationId, context.eventId))[0]!.retainedVendors.map((vendor) => vendor.vendorName)).toEqual(["Atelier Floréal"]);
  });

  it("« + Nouveau prestataire » crée la fiche et la retient, sans quitter le budget", async () => {
    const context = await wedding();
    const { vendorId } = await createAndRetainVendor({ organizationId: context.organizationId, userId, eventId: context.eventId, slotId: context.slotId, vendor: { name: "Flore et Sens", typeId: context.florist.id, email: null, phone: null, city: "Villeurbanne" } });
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorId, candidate.status])).toEqual([[vendorId, "retained"]]);
  });

  it("abus : un poste, un prestataire ou un type d'une autre organisation est refusé, sans rien écrire", async () => {
    const mine = await wedding();
    const other = await wedding();
    await expect(searchSlotVendors({ organizationId: other.organizationId, eventId: mine.eventId, slotId: mine.slotId, term: "", locale: "fr" })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(retainVendorForSlot({ organizationId: mine.organizationId, userId, eventId: mine.eventId, slotId: mine.slotId, vendorId: other.floreal.id })).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(retainVendorForSlot({ organizationId: other.organizationId, userId, eventId: mine.eventId, slotId: mine.slotId, vendorId: other.floreal.id })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(createAndRetainVendor({ organizationId: mine.organizationId, userId, eventId: mine.eventId, slotId: mine.slotId, vendor: { name: "Intrus", typeId: other.florist.id, email: null, phone: null, city: null } })).rejects.toBeInstanceOf(VendorNotFoundError);
    expect(await listVendorCandidates(mine.organizationId, mine.eventId)).toEqual([]);
  });
});
