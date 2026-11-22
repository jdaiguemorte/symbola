// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — « Choisir un prestataire… » depuis la ligne du budget,
// contre un vrai PostgreSQL (RLS) : le métier du poste d'abord, retenir comme dans la consultation,
// créer puis retenir ; tests d'abus entre organisations.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { addDefaultVendorSlots, countWorkedWithByVendor, createProspect, createProspectSource, EventNotFoundError, listEventVendorSlots, listVendorCandidates } from "@/modules/events/service";
import { createVendor, createVendorType, VendorNotFoundError } from "@/modules/vendors/service";
import { compareVendorForSlot, createAndRetainVendor, retainVendorForSlot, searchSlotVendors } from "./slot-retention";

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
    const found = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, term: "a", locale: "fr" });
    expect(found.choices.map((vendor) => [vendor.name, vendor.matchesSlot])).toEqual([
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

  it("L65-PRE-02 — sans rien taper, la liste montre tout le carnet du métier du poste, et compte ses fiches", async () => {
    const context = await wedding();
    for (const name of ["Bouquet d'Été", "Côté Jardin", "Dahlia", "Églantine", "Fleur de Sel", "Glycine", "Hortensia", "Iris", "Jasmin"]) {
      await createVendor(context.organizationId, { name, typeId: context.florist.id });
    }
    const found = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, term: "", locale: "fr" });
    expect(found.choices).toHaveLength(10);
    expect(found.choices.every((vendor) => vendor.matchesSlot)).toBe(true);
    expect(found.matchingCount).toBe(10);
  });

  it("L65-PRE-02 — « Comparer » l'ajoute à la comparaison sans le retenir ; la liste le dit « Dans la comparaison »", async () => {
    const context = await wedding();
    await compareVendorForSlot({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, vendorId: context.floreal.id });
    await compareVendorForSlot({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, vendorId: context.floreal.id });
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorId, candidate.status])).toEqual([[context.floreal.id, "shortlisted"]]);
    expect((await listEventVendorSlots(context.organizationId, context.eventId))[0]!.retainedVendors).toEqual([]);
    const found = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, term: "", locale: "fr" });
    expect(found.choices.find((vendor) => vendor.id === context.floreal.id)?.onSlot).toBe("compared");
    await retainVendorForSlot({ organizationId: context.organizationId, userId, eventId: context.eventId, slotId: context.slotId, vendorId: context.floreal.id });
    const after = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, term: "", locale: "fr" });
    expect(after.choices.find((vendor) => vendor.id === context.floreal.id)?.onSlot).toBe("retained");
  });

  it("L65-PRE-02 — « Déjà travaillé ensemble · N évènements » compte les évènements où la fiche a été retenue", async () => {
    const context = await wedding();
    const source = await createProspectSource(context.organizationId, "Bouche-à-oreille");
    const { id: secondEventId } = await createProspect({ organizationId: context.organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2027-09-04" });
    const [secondSlot] = await listEventVendorSlots(context.organizationId, secondEventId);
    await retainVendorForSlot({ organizationId: context.organizationId, userId, eventId: context.eventId, slotId: context.slotId, vendorId: context.floreal.id });
    await retainVendorForSlot({ organizationId: context.organizationId, userId, eventId: secondEventId, slotId: secondSlot!.id, vendorId: context.floreal.id });
    const found = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.slotId, term: "", locale: "fr" });
    expect(found.choices.find((vendor) => vendor.id === context.floreal.id)?.workedWithCount).toBe(2);
    expect((await countWorkedWithByVendor(context.organizationId)).get(context.amarante.id)).toBeUndefined();
  });

  it("L65-PRE-02 — « Créer et comparer » : la fiche créée entre dans la comparaison, sans être retenue", async () => {
    const context = await wedding();
    const { vendorId } = await createAndRetainVendor({ organizationId: context.organizationId, userId, eventId: context.eventId, slotId: context.slotId, retain: false, vendor: { name: "Flore et Sens", typeId: context.florist.id, email: null, phone: null, city: null } });
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorId, candidate.status])).toEqual([[vendorId, "shortlisted"]]);
  });

  it("abus : un poste, un prestataire ou un type d'une autre organisation est refusé, sans rien écrire", async () => {
    const mine = await wedding();
    const other = await wedding();
    await expect(searchSlotVendors({ organizationId: other.organizationId, eventId: mine.eventId, slotId: mine.slotId, term: "", locale: "fr" })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(retainVendorForSlot({ organizationId: mine.organizationId, userId, eventId: mine.eventId, slotId: mine.slotId, vendorId: other.floreal.id })).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(retainVendorForSlot({ organizationId: other.organizationId, userId, eventId: mine.eventId, slotId: mine.slotId, vendorId: other.floreal.id })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(createAndRetainVendor({ organizationId: mine.organizationId, userId, eventId: mine.eventId, slotId: mine.slotId, vendor: { name: "Intrus", typeId: other.florist.id, email: null, phone: null, city: null } })).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(compareVendorForSlot({ organizationId: mine.organizationId, eventId: mine.eventId, slotId: mine.slotId, vendorId: other.floreal.id })).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(compareVendorForSlot({ organizationId: other.organizationId, eventId: mine.eventId, slotId: mine.slotId, vendorId: other.floreal.id })).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await listVendorCandidates(mine.organizationId, mine.eventId)).toEqual([]);
  });
});
