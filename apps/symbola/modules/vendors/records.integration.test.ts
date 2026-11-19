// Lot 48a (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; ADR 0093) — pièces à échéance, contraintes du lieu,
// IBAN chiffré et contrôle de ses changements, note confidentielle, contre un vrai PostgreSQL (RLS),
// le stockage privé et l'antivirus. Horloge simulée pour les alertes.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { vendorBankChanges, vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { eq } from "drizzle-orm";
import {
  addVendorDocument,
  checkProgramWithVenue,
  checkVenueCapacity,
  ConfidentialNoteForbiddenError,
  createVendor,
  createVendorType,
  addVendorTypeField,
  ensureVenueRuleFields,
  getVendor,
  getVendorRibFile,
  getVenueConstraints,
  InvalidBankDetailsError,
  listPendingBankChecks,
  listRequestedVendorDocuments,
  listVendorBankChanges,
  listVendorDocumentKinds,
  listVendorDocumentNotices,
  listVendorDocuments,
  readVendorBankDetails,
  readVendorConfidentialNote,
  receiveVendorDocumentByLink,
  requestVendorDocument,
  saveVendorNote,
  seedStarterVendorCatalog,
  setVendorBankDetails,
  updateVendor,
  VendorDocumentNotFoundError,
  verifyVendorBankDetails,
  verifyVendorDocument,
  VendorFileNotFoundError,
  attachVendorFile,
} from "./service";
import { vendorCatalogInput } from "@/lib/vendors/catalog";

const { sql, db } = createAppConnection();
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const IBAN_A = "FR7630006000011234567890189";
const IBAN_B = "DE89370400440532013000";

afterAll(async () => {
  await sql.end();
});

async function planner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `owner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const member = await createUser(db, { organizationId: organization.id, email: `member-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" });
  return { organizationId: organization.id, ownerId: owner.id, memberId: member.id };
}

describe("PRE-05 — Pièces à échéance, alerte avant expiration (lot 48a, D3)", () => {
  it("les natures de départ sont posées une fois ; une pièce déposée par la planner est vérifiée d'office", async () => {
    const { organizationId, ownerId } = await planner();
    const kinds = await listVendorDocumentKinds(organizationId, "fr");
    expect(kinds.map((kind) => kind.starterKey)).toEqual(["insurance", "registration", "venue_plan", "other"]);
    expect(await listVendorDocumentKinds(organizationId, "fr")).toHaveLength(4);
    const { vendor } = await createVendor(organizationId, { name: "Fleurs d'Élodie", typeId: null });
    const document = await addVendorDocument({ organizationId, vendorId: vendor.id, kindId: kinds[0]!.id, fileName: "assurance.pdf", content: PDF, validUntil: "2027-06-30", userId: ownerId, now: new Date("2027-05-01T10:00:00Z") });
    expect(document).toMatchObject({ status: "verified", uploadedBy: "planner", validUntil: "2027-06-30", alert: "valid", kindLabel: kinds[0]!.label });
  });

  it("alerte à J-30 (horloge simulée) ; une pièce expirant avant l'évènement est signalée", async () => {
    const { organizationId, ownerId } = await planner();
    const [insurance] = await listVendorDocumentKinds(organizationId, "fr");
    const { vendor } = await createVendor(organizationId, { name: "DJ Nova", typeId: null });
    await addVendorDocument({ organizationId, vendorId: vendor.id, kindId: insurance!.id, fileName: "rc.pdf", content: PDF, validUntil: "2027-06-30", userId: ownerId });
    expect(await listVendorDocumentNotices(organizationId, { vendorIds: [vendor.id], now: new Date("2027-05-30T10:00:00Z") })).toEqual([]);
    expect((await listVendorDocumentNotices(organizationId, { vendorIds: [vendor.id], now: new Date("2027-05-31T10:00:00Z") })).map((notice) => notice.reason)).toEqual(["expiring"]);
    expect((await listVendorDocumentNotices(organizationId, { vendorIds: [vendor.id], now: new Date("2027-07-01T10:00:00Z") })).map((notice) => notice.reason)).toEqual(["expired"]);
    // Critère : l'évènement du 4 septembre tombe après la fin de validité.
    const notices = await listVendorDocumentNotices(organizationId, { vendorIds: [vendor.id], eventDate: "2027-09-04", now: new Date("2027-04-01T10:00:00Z") });
    expect(notices).toEqual([expect.objectContaining({ vendorId: vendor.id, vendorName: "DJ Nova", reason: "lapses_before_event", validUntil: "2027-06-30" })]);
    expect(await listVendorDocumentNotices(organizationId, { vendorIds: [vendor.id], eventDate: "2027-06-30", now: new Date("2027-04-01T10:00:00Z") })).toEqual([]);
  });

  it("D3 : une pièce demandée se dépose par le lien du prestataire et arrive « à vérifier » ; la planner la vérifie", async () => {
    const { organizationId, ownerId } = await planner();
    const [insurance] = await listVendorDocumentKinds(organizationId, "fr");
    const { vendor } = await createVendor(organizationId, { name: "Studio Lumière", typeId: null });
    const requested = await requestVendorDocument({ organizationId, vendorId: vendor.id, kindId: insurance!.id });
    expect(requested).toMatchObject({ status: "requested", fileName: null });
    expect((await listRequestedVendorDocuments(organizationId, vendor.id)).map((document) => document.id)).toEqual([requested.id]);
    const linkId = randomUUID();
    const received = await receiveVendorDocumentByLink({ organizationId, vendorId: vendor.id, documentId: requested.id, linkId, fileName: "rc-2027.pdf", content: PDF, validUntil: "2028-01-31" });
    expect(received).toMatchObject({ status: "to_verify", uploadedBy: "vendor", validUntil: "2028-01-31" });
    expect((await listVendorDocumentNotices(organizationId, { vendorIds: [vendor.id] })).map((notice) => notice.reason)).toEqual(["to_verify"]);
    await verifyVendorDocument(organizationId, requested.id, ownerId);
    expect((await listVendorDocuments(organizationId, vendor.id))[0]).toMatchObject({ status: "verified" });
  });

  it("abus : un lien ne dépose que dans une pièce demandée à son prestataire, jamais deux fois, jamais dans une autre organisation", async () => {
    const { organizationId } = await planner();
    const other = await planner();
    const [insurance] = await listVendorDocumentKinds(organizationId, "fr");
    const { vendor } = await createVendor(organizationId, { name: "Traiteur A", typeId: null });
    const { vendor: neighbour } = await createVendor(organizationId, { name: "Traiteur B", typeId: null });
    const requested = await requestVendorDocument({ organizationId, vendorId: vendor.id, kindId: insurance!.id });
    const linkId = randomUUID();
    await expect(receiveVendorDocumentByLink({ organizationId, vendorId: neighbour.id, documentId: requested.id, linkId, fileName: "x.pdf", content: PDF })).rejects.toBeInstanceOf(VendorDocumentNotFoundError);
    await expect(receiveVendorDocumentByLink({ organizationId: other.organizationId, vendorId: vendor.id, documentId: requested.id, linkId, fileName: "x.pdf", content: PDF })).rejects.toBeInstanceOf(VendorDocumentNotFoundError);
    await receiveVendorDocumentByLink({ organizationId, vendorId: vendor.id, documentId: requested.id, linkId, fileName: "x.pdf", content: PDF });
    await expect(receiveVendorDocumentByLink({ organizationId, vendorId: vendor.id, documentId: requested.id, linkId, fileName: "y.pdf", content: PDF })).rejects.toBeInstanceOf(VendorDocumentNotFoundError);
    expect(await listVendorDocuments(other.organizationId, vendor.id)).toEqual([]);
  });
});

describe("PRE-10 / SEC-27 — Changement d'IBAN journalisé, signalé, « à vérifier par un autre canal » (lot 48a, D5)", () => {
  it("le changement est journalisé et masqué ; le bandeau reste jusqu'à la levée nominative et horodatée", async () => {
    const { organizationId, ownerId } = await planner();
    const { vendor } = await createVendor(organizationId, { name: "Fleurs d'Élodie", typeId: null });
    expect(await setVendorBankDetails(organizationId, vendor.id, { iban: IBAN_A, bic: "AGRIFRPP" }, { kind: "user", userId: ownerId })).toEqual({ changed: true });
    expect(await setVendorBankDetails(organizationId, vendor.id, { iban: "FR76 3000 6000 0112 3456 7890 189", bic: "agrifrpp" }, { kind: "user", userId: ownerId })).toEqual({ changed: false });
    await verifyVendorBankDetails(organizationId, vendor.id, ownerId);
    const linkId = randomUUID();
    await setVendorBankDetails(organizationId, vendor.id, { iban: IBAN_B, bic: null }, { kind: "link", linkId });
    const changes = await listVendorBankChanges(organizationId, vendor.id);
    expect(changes[0]).toMatchObject({ previousMasked: "FR76 •••• •••• 0189", nextMasked: "DE89 •••• •••• 3000", changedBy: { kind: "vendor" }, verifiedAt: null });
    expect(changes[1]).toMatchObject({ previousMasked: null, nextMasked: "FR76 •••• •••• 0189", changedBy: { kind: "user", userId: ownerId } });
    // Critère : l'alerte reste visible tant que la planner ne l'a pas levée.
    expect((await getVendor(organizationId, vendor.id))!.bank).toMatchObject({ ibanMasked: "DE89 •••• •••• 3000", hasBic: false, pendingCheck: { changedBy: "vendor" } });
    expect((await listPendingBankChecks(organizationId)).has(vendor.id)).toBe(true);
    const lifted = new Date("2027-03-01T09:30:00Z");
    expect(await verifyVendorBankDetails(organizationId, vendor.id, ownerId, lifted)).toBe(1);
    expect((await getVendor(organizationId, vendor.id))!.bank.pendingCheck).toBeNull();
    expect((await listVendorBankChanges(organizationId, vendor.id))[0]).toMatchObject({ verifiedAt: lifted.toISOString(), verifiedByUserId: ownerId });
  });

  it("DAT-08 : la base ne contient aucun IBAN en clair ; la lecture par le service le rend", async () => {
    const { organizationId, ownerId } = await planner();
    const { vendor } = await createVendor(organizationId, { name: "DJ Nova", typeId: null });
    await setVendorBankDetails(organizationId, vendor.id, { iban: IBAN_A, bic: "AGRIFRPP" }, { kind: "user", userId: ownerId });
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(vendors).where(eq(vendors.id, vendor.id)));
    const stored = JSON.stringify(row);
    expect(stored).not.toContain("30006000011234567890189");
    expect(stored).not.toContain("AGRIFRPP");
    expect(row!.ibanSealed).toMatch(/^f1:/);
    const changes = await withOrganization(db, organizationId, (tx) => tx.select().from(vendorBankChanges).where(eq(vendorBankChanges.vendorId, vendor.id)));
    expect(JSON.stringify(changes)).not.toContain("1234567890");
    expect(await readVendorBankDetails(organizationId, vendor.id)).toEqual({ iban: IBAN_A, bic: "AGRIFRPP" });
  });

  it("un IBAN invalide est refusé sans rien changer", async () => {
    const { organizationId, ownerId } = await planner();
    const { vendor } = await createVendor(organizationId, { name: "X", typeId: null });
    await expect(setVendorBankDetails(organizationId, vendor.id, { iban: "FR7630006000011234567890188", bic: null }, { kind: "user", userId: ownerId })).rejects.toBeInstanceOf(InvalidBankDetailsError);
    expect(await listVendorBankChanges(organizationId, vendor.id)).toEqual([]);
  });

  it("jamais montré au client avant la levée : le RIB partagé répond comme absent tant que le changement attend", async () => {
    const { organizationId, ownerId } = await planner();
    const { vendor } = await createVendor(organizationId, { name: "Traiteur", typeId: null });
    await attachVendorFile({ organizationId, vendorId: vendor.id, kind: "rib", fileName: "rib.pdf", content: PDF, uploadedByUserId: ownerId });
    await expect(getVendorRibFile(organizationId, vendor.id)).resolves.toMatchObject({ fileName: "rib.pdf" });
    await setVendorBankDetails(organizationId, vendor.id, { iban: IBAN_B, bic: null }, { kind: "link", linkId: randomUUID() });
    await expect(getVendorRibFile(organizationId, vendor.id)).rejects.toBeInstanceOf(VendorFileNotFoundError);
    await verifyVendorBankDetails(organizationId, vendor.id, ownerId);
    await expect(getVendorRibFile(organizationId, vendor.id)).resolves.toMatchObject({ fileName: "rib.pdf" });
  });

  it("abus : une autre organisation ne lit ni ne change l'IBAN, ni ne lève le bandeau", async () => {
    const { organizationId, ownerId } = await planner();
    const other = await planner();
    const { vendor } = await createVendor(organizationId, { name: "X", typeId: null });
    await setVendorBankDetails(organizationId, vendor.id, { iban: IBAN_A, bic: null }, { kind: "user", userId: ownerId });
    expect(await readVendorBankDetails(other.organizationId, vendor.id)).toEqual({ iban: null, bic: null });
    await expect(setVendorBankDetails(other.organizationId, vendor.id, { iban: IBAN_B, bic: null }, { kind: "user", userId: other.ownerId })).rejects.toThrow();
    expect(await verifyVendorBankDetails(other.organizationId, vendor.id, other.ownerId)).toBe(0);
    expect((await getVendor(organizationId, vendor.id))!.bank.pendingCheck).not.toBeNull();
  });
});

describe("DAT-08 — Note confidentielle d'une fiche (lot 48a, D5)", () => {
  it("chiffrée en base, lue par la titulaire et son auteur seuls ; le formulaire ordinaire ne l'écrase pas", async () => {
    const { organizationId, ownerId, memberId } = await planner();
    const intruder = await createUser(db, { organizationId, email: `other-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" });
    const { vendor } = await createVendor(organizationId, { name: "Fleurs", typeId: null, internalNote: "note ouverte" });
    await saveVendorNote(organizationId, vendor.id, { note: "Litige de paiement en 2026", confidential: true }, { userId: memberId, role: "member" });
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(vendors).where(eq(vendors.id, vendor.id)));
    expect(row!.internalNote).toBeNull();
    expect(JSON.stringify(row)).not.toContain("Litige");
    expect((await getVendor(organizationId, vendor.id))!).toMatchObject({ internalNote: null, internalNoteConfidential: { authorUserId: memberId } });
    expect(await readVendorConfidentialNote(organizationId, vendor.id, { userId: memberId, role: "member" })).toBe("Litige de paiement en 2026");
    expect(await readVendorConfidentialNote(organizationId, vendor.id, { userId: ownerId, role: "owner" })).toBe("Litige de paiement en 2026");
    await expect(readVendorConfidentialNote(organizationId, vendor.id, { userId: intruder.id, role: "member" })).rejects.toBeInstanceOf(ConfidentialNoteForbiddenError);
    await expect(saveVendorNote(organizationId, vendor.id, { note: "effacée", confidential: false }, { userId: intruder.id, role: "member" })).rejects.toBeInstanceOf(ConfidentialNoteForbiddenError);
    await updateVendor(organizationId, vendor.id, { name: "Fleurs", typeId: null, internalNote: "tentative" });
    expect(await readVendorConfidentialNote(organizationId, vendor.id, { userId: ownerId, role: "owner" })).toBe("Litige de paiement en 2026");
    await saveVendorNote(organizationId, vendor.id, { note: "Litige réglé", confidential: false }, { userId: ownerId, role: "owner" });
    expect(await getVendor(organizationId, vendor.id)).toMatchObject({ internalNote: "Litige réglé", internalNoteConfidential: null });
  });
});

describe("PRE-06 — Fiche lieu : les contraintes alimentent les contrôles du chrono (lot 48a, D4)", () => {
  it("les champs de lieu à règle sont posés une fois ; une séquence de musique après la fin de la musique est signalée", async () => {
    const { organizationId } = await planner();
    await seedStarterVendorCatalog(organizationId, vendorCatalogInput("fr"), { withTypes: true });
    expect(await ensureVenueRuleFields(organizationId, "fr")).toBe(0);
    const types = await (await import("./service")).listVendorTypes(organizationId);
    const venueType = types.find((type) => type.starterKey === "venue")!;
    const musicType = types.find((type) => type.starterKey === "music")!;
    const field = (rule: string) => venueType.fields.find((candidate) => candidate.ruleKey === rule)!.id;
    const { vendor: venue } = await createVendor(organizationId, {
      name: "Château de Lilas",
      typeId: venueType.id,
      fieldValues: { [field("music_end")]: "01:00", [field("capacity_seated")]: 120, [field("vendor_access_start")]: "08:00" },
    });
    const { vendor: dj } = await createVendor(organizationId, { name: "DJ Nova", typeId: musicType.id });
    const [constraints] = await getVenueConstraints(organizationId, [venue.id]);
    expect(constraints).toMatchObject({ name: "Château de Lilas", values: { music_end: "01:00", capacity_seated: 120, vendor_access_start: "08:00" } });
    const findings = await checkProgramWithVenue(organizationId, constraints!, [
      { id: "soiree", startTime: "22:30", endTime: "02:00", vendorIds: [dj.id], hasVendorSlot: true },
      { id: "diner", startTime: "20:00", endTime: "22:30", vendorIds: [], hasVendorSlot: false },
    ]);
    expect(findings).toEqual([{ itemId: "soiree", ruleKey: "music_end", venueName: "Château de Lilas", vendorId: venue.id, limit: "01:00" }]);
    expect(checkVenueCapacity(constraints!, 130)).toMatchObject({ ruleKey: "capacity_seated", limit: 120, guests: 130 });
  });

  it("une organisation d'avant le lot reçoit les champs à règle une fois, en reconnaissant ceux qu'elle a déjà", async () => {
    const { organizationId } = await planner();
    const type = await createVendorType(organizationId, "Lieu", "#3f6e4f");
    await addVendorTypeField(organizationId, type.id, { label: "Fin de soirée imposée", kind: "time" });
    await withOrganization(db, organizationId, (tx) => tx.execute(`update vendors.vendor_types set starter_key = 'venue' where id = '${type.id}'`));
    expect(await ensureVenueRuleFields(organizationId, "fr")).toBeGreaterThan(5);
    expect(await ensureVenueRuleFields(organizationId, "fr")).toBe(0);
    const fields = (await (await import("./service")).listVendorTypes(organizationId)).find((candidate) => candidate.id === type.id)!.fields;
    expect(fields.filter((candidate) => candidate.label === "Fin de soirée imposée")).toEqual([expect.objectContaining({ ruleKey: "guests_departure" })]);
    expect(fields.some((candidate) => candidate.ruleKey === "music_end")).toBe(true);
  });
});
