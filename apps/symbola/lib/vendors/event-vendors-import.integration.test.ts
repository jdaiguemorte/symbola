// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — reprendre d'un PDF les prestataires
// retenus d'un évènement, contre un vrai PostgreSQL (RLS) : aperçu sans rien écrire, fiches du carnet
// retrouvées ou créées, prestataires retenus sur la ligne du budget de leur métier, ligne de la
// planner écartée, reprise rejouée sans doublon ; date d'un autre évènement à confirmer ; abus d'une
// autre organisation. PDF fabriqué aux noms inventés
// (packages/testing/import-corpus/generate_prestataires.py).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { addEventVendorSlot, createProspect, createProspectSource, EventNotFoundError, listEventVendorSlots, listVendorCandidates } from "@/modules/events/service";
import { createVendor, findVendors, getVendor } from "@/modules/vendors/service";
import { importEventVendors } from "./event-vendors-import";

const userId = randomUUID();
const bytes = readImportCorpusFile("logiciel-tiers/prestataires-evenement.pdf");

async function wedding(eventDate = "2027-06-12", organizationId = randomUUID()) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: source.id, clients: [{ firstName: "Clémence", lastName: "Martin" }], eventDate });
  const photo = await addEventVendorSlot(organizationId, event.id, "Photographe");
  const venue = await addEventVendorSlot(organizationId, event.id, "Lieu de réception");
  return { organizationId, userId, eventId: event.id, photoSlotId: photo.id, venueSlotId: venue.id };
}

const retainedOf = async (organizationId: string, eventId: string) =>
  (await listVendorCandidates(organizationId, eventId)).filter((candidate) => candidate.status === "retained").map((candidate) => candidate.vendorName).sort((a, b) => a.localeCompare(b, "fr"));

describe("HUB-14, PRE-02, BUD-04 — Prestataires retenus d'un évènement repris d'un PDF (lot 67e)", () => {
  it("l'aperçu propose la fiche du carnet et la ligne du budget de chaque prestataire ; rien n'est écrit avant « Reprendre »", async () => {
    const planner = await wedding();
    const { vendor: studio } = await createVendor(planner.organizationId, { name: "Studio Lumière" });
    const result = await importEventVendors({ ...planner, bytes, apply: null });
    if (result.status !== "preview") throw new Error(result.status);
    const { header, rows } = result.preview;
    expect(header).toEqual({ eventDate: "2027-06-12", clients: ["Clémence MARTIN", "Bastien LEROY"], check: "same" });
    expect(rows).toHaveLength(13);
    const byName = new Map(rows.map((row) => [row.name, row]));
    // Fiche existante retrouvée, ligne de son métier proposée.
    expect(byName.get("Studio Lumière")).toMatchObject({ vendor: { id: studio.id }, slotId: planner.photoSlotId, choice: { skip: false, vendor: studio.id, slot: planner.photoSlotId } });
    // « Lieu » va sur « Lieu de réception » ; un métier sans ligne en recevra une.
    expect(byName.get("Domaine des Tilleuls")).toMatchObject({ vendor: null, slotId: planner.venueSlotId, choice: { vendor: "new", slot: planner.venueSlotId } });
    expect(byName.get("Nuit Blanche Sono")).toMatchObject({ vendor: null, slotId: null, choice: { vendor: "new", slot: "new" } });
    // La planner elle-même n'est jamais reprise.
    expect(byName.get("Belle Journée")).toMatchObject({ planner: true, choice: { skip: true } });
    expect(await listVendorCandidates(planner.organizationId, planner.eventId)).toEqual([]);
    expect((await findVendors({ organizationId: planner.organizationId, limit: 60 })).map((vendor) => vendor.name)).toEqual(["Studio Lumière"]);
  });

  it("la reprise crée les fiches manquantes, les lignes manquantes (une par métier) et retient chaque prestataire sur sa ligne", async () => {
    const planner = await wedding();
    const { vendor: studio } = await createVendor(planner.organizationId, { name: "Studio Lumière" });
    const applied = await importEventVendors({ ...planner, bytes, apply: { confirmHeader: false } });
    // 12 prestataires (13 lignes moins la planner) ; 11 fiches créées (Studio Lumière existait) ;
    // 9 lignes créées pour 10 métiers sans ligne, les deux fleuristes partageant la leur.
    expect(applied).toEqual({ status: "applied", retained: 12, createdVendors: 11, createdSlots: 9, alreadyRetained: 0, skipped: 1 });
    const candidates = await listVendorCandidates(planner.organizationId, planner.eventId);
    expect(candidates.filter((candidate) => candidate.status === "retained")).toHaveLength(12);
    expect(candidates.find((candidate) => candidate.vendorName === "Studio Lumière")).toMatchObject({ vendorId: studio.id, vendorSlotId: planner.photoSlotId });
    const slots = await listEventVendorSlots(planner.organizationId, planner.eventId);
    const florists = slots.find((slot) => slot.label === "Fleuriste")!;
    expect(candidates.filter((candidate) => candidate.vendorSlotId === florists.id).map((candidate) => candidate.vendorName).sort()).toEqual(["Fleurs du Clain", "Pétales & Compagnie"]);
    expect(await retainedOf(planner.organizationId, planner.eventId)).not.toContain("Belle Journée");
    // La fiche créée porte le contact, l'e-mail et le téléphone du fichier.
    const found = (await findVendors({ organizationId: planner.organizationId, text: "Nuit Blanche", limit: 5 }))[0]!;
    const created = await getVendor(planner.organizationId, found.id);
    expect(created).toMatchObject({ name: "Nuit Blanche Sono", contactName: "Raphaël DUVAL", email: "nuitblanche@exemple.invalid" });
  });

  it("rejouée, la reprise n'écrit rien de plus : fiches retrouvées, prestataires déjà retenus", async () => {
    const planner = await wedding();
    await importEventVendors({ ...planner, bytes, apply: { confirmHeader: false } });
    const again = await importEventVendors({ ...planner, bytes, apply: { confirmHeader: false } });
    expect(again).toEqual({ status: "applied", retained: 0, createdVendors: 0, createdSlots: 0, alreadyRetained: 12, skipped: 1 });
    expect(await findVendors({ organizationId: planner.organizationId, limit: 60 })).toHaveLength(12);
    expect(await retainedOf(planner.organizationId, planner.eventId)).toHaveLength(12);
  });

  it("la planner écarte une ligne et choisit une autre ligne du budget : ses choix l'emportent", async () => {
    const planner = await wedding();
    const applied = await importEventVendors({ ...planner, bytes, choices: { 4: { skip: true }, 9: { slot: planner.photoSlotId } }, apply: { confirmHeader: false } });
    expect(applied).toMatchObject({ status: "applied", retained: 11, skipped: 2 });
    const candidates = await listVendorCandidates(planner.organizationId, planner.eventId);
    expect(candidates.some((candidate) => candidate.vendorName === "Nuit Blanche Sono")).toBe(false);
    expect(candidates.find((candidate) => candidate.vendorName === "FlashBooth")?.vendorSlotId).toBe(planner.photoSlotId);
  });

  it("un prestataire déjà retenu sur la ligne le reste : la reprise ajoute, elle ne remplace pas", async () => {
    const planner = await wedding();
    const { vendor: other } = await createVendor(planner.organizationId, { name: "Photo Martin" });
    const { retainVendorForSlot } = await import("./slot-retention");
    await retainVendorForSlot({ ...planner, slotId: planner.photoSlotId, vendorId: other.id });
    await importEventVendors({ ...planner, bytes, apply: { confirmHeader: false } });
    const onPhoto = (await listVendorCandidates(planner.organizationId, planner.eventId)).filter((candidate) => candidate.vendorSlotId === planner.photoSlotId && candidate.status === "retained");
    expect(onPhoto.map((candidate) => candidate.vendorName).sort()).toEqual(["Photo Martin", "Studio Lumière"]);
  });

  it("le fichier d'un évènement d'une autre date se signale, et ne s'écrit qu'après confirmation", async () => {
    const planner = await wedding("2027-09-04");
    const preview = await importEventVendors({ ...planner, bytes, apply: null });
    expect(preview).toMatchObject({ status: "preview", preview: { header: { check: "different" } } });
    expect(await importEventVendors({ ...planner, bytes, apply: { confirmHeader: false } })).toEqual({ status: "rejected", reason: "header_unconfirmed" });
    expect(await listVendorCandidates(planner.organizationId, planner.eventId)).toEqual([]);
    expect(await importEventVendors({ ...planner, bytes, apply: { confirmHeader: true } })).toMatchObject({ status: "applied", retained: 12 });
  });

  it("un fichier qui n'est pas cet export est refusé sans rien écrire", async () => {
    const planner = await wedding();
    expect(await importEventVendors({ ...planner, bytes: readImportCorpusFile("logiciel-tiers/programme-jour-j.pdf"), apply: { confirmHeader: true } })).toEqual({ status: "rejected", reason: "not_event_vendors_pdf" });
    expect(await importEventVendors({ ...planner, bytes: new TextEncoder().encode("Type;Nom\nDJ;Sono\n"), apply: { confirmHeader: true } })).toEqual({ status: "rejected", reason: "not_event_vendors_pdf" });
    expect(await importEventVendors({ ...planner, bytes: new Uint8Array(), apply: null })).toEqual({ status: "rejected", reason: "empty" });
    expect(await listVendorCandidates(planner.organizationId, planner.eventId)).toEqual([]);
  });

  it("abus : l'évènement d'une autre organisation n'existe pas ; sa fiche et sa ligne ne sont jamais choisies", async () => {
    const mine = await wedding();
    const theirs = await wedding();
    const { vendor: theirVendor } = await createVendor(theirs.organizationId, { name: "Fiche des autres" });
    await expect(importEventVendors({ ...mine, eventId: theirs.eventId, bytes, apply: { confirmHeader: true } })).rejects.toBeInstanceOf(EventNotFoundError);
    // Une fiche et une ligne d'une autre organisation, glissées dans les choix, sont ignorées.
    const applied = await importEventVendors({ ...mine, bytes, choices: { 4: { vendor: theirVendor.id, slot: theirs.photoSlotId } }, apply: { confirmHeader: false } });
    expect(applied).toMatchObject({ status: "applied", retained: 12 });
    expect(await listVendorCandidates(theirs.organizationId, theirs.eventId)).toEqual([]);
    expect((await findVendors({ organizationId: theirs.organizationId, limit: 60 })).map((vendor) => vendor.name)).toEqual(["Fiche des autres"]);
    const dj = (await listVendorCandidates(mine.organizationId, mine.eventId)).find((candidate) => candidate.vendorName === "Nuit Blanche Sono")!;
    expect(dj.vendorId).not.toBe(theirVendor.id);
  });
});
