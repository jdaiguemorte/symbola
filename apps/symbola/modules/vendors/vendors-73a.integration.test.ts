// Lot 73a (PRE-01, PRE-05, PRE-08, BUD-01 ; spécification du lot 73, § 5.1, critères 4, 5, 11 et 12 ;
// P3, P4, P9) — le carnet contre un vrai PostgreSQL (RLS) : « Pièces à régler » et son compte, le tri, les
// mariages faits ensemble, le montant juste de l'historique (C-48), les natures de départ (nom court,
// demandées d'habitude) ; tests d'isolation entre organisations.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { vendorDocuments } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import type { VendorSlotBookedPayload } from "@symbola/contracts";
import { addBudgetLine, applyVendorSlotBookedToBudget, listBudgetLines, updateBudgetLine } from "@/modules/budget/service";
import { addDefaultVendorSlots, addVendorToEventSlot, createProspect, createProspectSource, listEventVendorSlots, listVendorCandidates, updateVendorCandidate } from "@/modules/events/service";
import {
  createVendor,
  createVendorType,
  findVendors,
  getVendorHistory,
  listVendorDocumentKinds,
  listVendorDocuments,
  requestUsualVendorDocuments,
  requestVendorDocument,
  setVendorDocumentAlertDays,
  setVendorDocumentKindUsage,
  summarizeVendorDocuments,
  setVendorLocation,
} from "./service";

const plannerId = randomUUID();
const NOW = new Date("2027-03-10T10:00:00.000Z");

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function newOrganization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

// Une pièce déposée (fichier fictif, jamais lu) ou à vérifier, posée directement en base.
async function deposit(organizationId: string, vendorId: string, kindId: string, values: { status: "verified" | "to_verify"; validUntil: string | null }) {
  await withDb((db) =>
    withOrganization(db, organizationId, (tx) =>
      tx.insert(vendorDocuments).values({
        organizationId,
        vendorId,
        kindId,
        status: values.status,
        fileName: "piece.pdf",
        fileKey: `test/${randomUUID()}.pdf`,
        mime: "application/pdf",
        sizeBytes: 10,
        validUntil: values.validUntil,
        uploadedAt: NOW,
        ...(values.status === "verified" ? { verifiedAt: NOW } : {}),
      }),
    ),
  );
}

async function kindsOf(organizationId: string) {
  const kinds = await listVendorDocumentKinds(organizationId);
  return { insurance: kinds.find((kind) => kind.starterKey === "insurance")!, registration: kinds.find((kind) => kind.starterKey === "registration")!, plan: kinds.find((kind) => kind.starterKey === "venue_plan")! };
}

async function wedding(organizationId: string, eventDate: string) {
  await addDefaultVendorSlots(organizationId, ["Traiteur"]);
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate });
  const slot = (await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.label === "Traiteur")!;
  return { eventId, slotId: slot.id };
}

const retain = (organizationId: string, eventId: string, slotId: string, vendor: { id: string; name: string }) =>
  addVendorToEventSlot({ organizationId, userId: plannerId, eventId, slotId, vendors: [{ vendorId: vendor.id, vendorName: vendor.name }], mode: "retain_also" });

describe("PRE-05 — « Pièces à régler » dans le carnet (lot 73a, critère 4)", () => {
  it("rend les fiches à renouveler, bientôt, à recevoir, à vérifier, dans cet ordre puis par date ; le compte est juste", async () => {
    const organizationId = await newOrganization();
    const kinds = await kindsOf(organizationId);
    const make = async (name: string) => (await createVendor(organizationId, { name })).vendor;
    const expiredOld = await make("Ancienne Expirée");
    const expiredRecent = await make("Récente Expirée");
    const soon = await make("Bientôt");
    const awaited = await make("À recevoir");
    const toVerify = await make("À vérifier");
    const upToDate = await make("À jour");
    await make("Sans pièce");
    await deposit(organizationId, expiredOld.id, kinds.insurance.id, { status: "verified", validUntil: "2026-12-31" });
    await deposit(organizationId, expiredRecent.id, kinds.insurance.id, { status: "verified", validUntil: "2027-02-28" });
    await deposit(organizationId, soon.id, kinds.registration.id, { status: "verified", validUntil: "2027-03-25" });
    await requestVendorDocument({ organizationId, vendorId: awaited.id, kindId: kinds.registration.id, now: NOW });
    await deposit(organizationId, toVerify.id, kinds.insurance.id, { status: "to_verify", validUntil: "2028-01-01" });
    await deposit(organizationId, upToDate.id, kinds.insurance.id, { status: "verified", validUntil: "2028-01-01" });

    const all = await findVendors({ organizationId, now: NOW });
    expect(all).toHaveLength(7);
    const toSettle = await findVendors({ organizationId, documents: "to_settle", now: NOW });
    expect(toSettle.map((vendor) => [vendor.name, vendor.documentState.state])).toEqual([
      ["Ancienne Expirée", "expired"],
      ["Récente Expirée", "expired"],
      ["Bientôt", "expiring"],
      ["À recevoir", "requested"],
      ["À vérifier", "to_verify"],
    ]);
    // « 5 fiches sur 7 ».
    expect(`${toSettle.length} sur ${all.length}`).toBe("5 sur 7");
    expect((await findVendors({ organizationId, documents: "up_to_date", now: NOW })).map((vendor) => vendor.name)).toEqual(["À jour"]);
    expect((await findVendors({ organizationId, documents: "expired_or_soon", now: NOW })).map((vendor) => vendor.name)).toEqual(["Ancienne Expirée", "Récente Expirée", "Bientôt"]);
    // Le nom court en tête de l'état (« Assurance · à renouveler »).
    expect(toSettle[0]!.documentState.document).toMatchObject({ shortLabel: "Assurance", validUntil: "2026-12-31" });
    expect(all.find((vendor) => vendor.name === "Sans pièce")!.documentState.state).toBe("none_requested");
  });

  it("un filtre ou un tri inconnu est ignoré, sans erreur", async () => {
    const organizationId = await newOrganization();
    await createVendor(organizationId, { name: "Seul" });
    expect(await findVendors({ organizationId, documents: "nimporte" as never, sort: "pirate" as never, now: NOW })).toHaveLength(1);
  });

  it("le délai d'alerte de l'organisation compte (15 jours) ; une pièce qui finit avant un mariage où il est retenu est « bientôt »", async () => {
    const organizationId = await newOrganization();
    const kinds = await kindsOf(organizationId);
    const vendor = (await createVendor(organizationId, { name: "Maison Haddad" })).vendor;
    await deposit(organizationId, vendor.id, kinds.insurance.id, { status: "verified", validUntil: "2027-03-30" });
    expect((await findVendors({ organizationId, now: NOW }))[0]!.documentState.state).toBe("expiring");
    await setVendorDocumentAlertDays(organizationId, 15);
    expect((await findVendors({ organizationId, now: NOW }))[0]!.documentState.state).toBe("up_to_date");
    const { eventId, slotId } = await wedding(organizationId, "2027-06-12");
    await retain(organizationId, eventId, slotId, vendor);
    const [item] = await findVendors({ organizationId, now: NOW });
    expect(item!.documentState).toMatchObject({ state: "expiring", reason: { code: "before_event", eventId, eventDate: "2027-06-12", couple: null } });
    // Le nom du mariage, quand l'appelant le donne (la personne le voit).
    const named = await summarizeVendorDocuments(organizationId, [vendor.id], { now: NOW, retainedEventsByVendor: new Map([[vendor.id, [{ eventId, eventDate: "2027-06-12" }]]]), eventNames: { [eventId]: "Léa & Maxime" } });
    expect(named.get(vendor.id)!.reason).toEqual({ code: "before_event", eventId, eventDate: "2027-06-12", couple: "Léa & Maxime" });
  });
});

describe("PRE-01, PRE-08 — Trier le carnet (lot 73a, critère 5)", () => {
  it("« Avec vous » range par mariages faits ensemble (retenus), puis par nom ; le contact et le téléphone suivent", async () => {
    const organizationId = await newOrganization();
    const often = (await createVendor(organizationId, { name: "Zéphyr Traiteur", contactName: "Nadia", phone: "+33 5 49 00 00 00" })).vendor;
    const once = (await createVendor(organizationId, { name: "Bastide" })).vendor;
    const tie = (await createVendor(organizationId, { name: "Arlequin" })).vendor;
    await createVendor(organizationId, { name: "Jamais" });
    for (const date of ["2027-06-12", "2027-07-10"]) {
      const { eventId, slotId } = await wedding(organizationId, date);
      await retain(organizationId, eventId, slotId, often);
      if (date === "2027-06-12") await retain(organizationId, eventId, slotId, once);
      else await retain(organizationId, eventId, slotId, tie);
    }
    const sorted = await findVendors({ organizationId, sort: "worked_with", direction: "asc", now: NOW });
    expect(sorted.map((vendor) => [vendor.name, vendor.workedWithCount])).toEqual([
      ["Zéphyr Traiteur", 2],
      ["Arlequin", 1],
      ["Bastide", 1],
      ["Jamais", 0],
    ]);
    expect(sorted[0]).toMatchObject({ contactName: "Nadia", phone: "+33 5 49 00 00 00" });
    expect((await findVendors({ organizationId, sort: "worked_with", direction: "desc", now: NOW })).map((vendor) => vendor.name)).toEqual(["Jamais", "Arlequin", "Bastide", "Zéphyr Traiteur"]);
  });

  it("par nom, métier et évaluation, dans les deux sens, par la base ; sans métier ni note, à la fin", async () => {
    const organizationId = await newOrganization();
    const caterer = await createVendorType(organizationId, "Traiteur", "#7a4b2a");
    const florist = await createVendorType(organizationId, "Fleuriste", "#2f6f5e");
    await createVendor(organizationId, { name: "Bouquet", typeId: florist.id, rating: 3 });
    await createVendor(organizationId, { name: "Amarante", typeId: caterer.id, rating: 5 });
    await createVendor(organizationId, { name: "Cerise" });
    const names = async (sort: "name" | "type" | "rating", direction: "asc" | "desc") => (await findVendors({ organizationId, sort, direction, now: NOW })).map((vendor) => vendor.name);
    expect(await names("name", "asc")).toEqual(["Amarante", "Bouquet", "Cerise"]);
    expect(await names("name", "desc")).toEqual(["Cerise", "Bouquet", "Amarante"]);
    expect(await names("type", "asc")).toEqual(["Bouquet", "Amarante", "Cerise"]);
    expect(await names("type", "desc")).toEqual(["Amarante", "Bouquet", "Cerise"]);
    expect(await names("rating", "desc")).toEqual(["Amarante", "Bouquet", "Cerise"]);
    expect(await names("rating", "asc")).toEqual(["Bouquet", "Amarante", "Cerise"]);
  });

  it("autour d'un lieu, la distance trie par défaut, dans les deux sens", async () => {
    const organizationId = await newOrganization();
    const near = (await createVendor(organizationId, { name: "Près" })).vendor;
    const far = (await createVendor(organizationId, { name: "Loin" })).vendor;
    await setVendorLocation(organizationId, near.id, 46.58, 0.34);
    await setVendorLocation(organizationId, far.id, 46.32, -0.46);
    const around = { latitude: 46.58, longitude: 0.34, radiusKm: 200 };
    expect((await findVendors({ organizationId, around, now: NOW })).map((vendor) => vendor.name)).toEqual(["Près", "Loin"]);
    expect((await findVendors({ organizationId, around, sort: "distance", direction: "desc", now: NOW })).map((vendor) => vendor.name)).toEqual(["Loin", "Près"]);
  });
});

describe("PRE-08 — Le montant juste d'un mariage dans l'historique (lot 73a, critère 11 ; P9, C-48)", () => {
  it("un poste à deux lignes, 9 000,00 € et 600,00 € engagés, rend 9 600,00 €", async () => {
    const organizationId = await newOrganization();
    const vendor = (await createVendor(organizationId, { name: "Maison Haddad" })).vendor;
    const { eventId, slotId } = await wedding(organizationId, "2027-06-12");
    const added = await addVendorToEventSlot({ organizationId, userId: plannerId, eventId, slotId, vendors: [{ vendorId: vendor.id, vendorName: vendor.name }], mode: "compare" });
    const candidateId = (added as { candidateIds: string[] }).candidateIds[0]!;
    await updateVendorCandidate({ organizationId, candidateId, quoteAmountCents: 900000 });
    await addVendorToEventSlot({ organizationId, userId: plannerId, eventId, slotId, vendors: [{ vendorId: vendor.id, vendorName: vendor.name }], mode: "retain" });
    const payload: VendorSlotBookedPayload = { eventId, vendorSlotId: slotId, label: "Traiteur", amountCents: 900000, candidateId, currency: "EUR", bookedByUserId: plannerId };
    await applyVendorSlotBookedToBudget(organizationId, payload);
    const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slotId, label: "Brunch du lendemain", vendorCandidateId: candidateId });
    const second = view.lines.find((line) => line.label === "Brunch du lendemain")!;
    await updateBudgetLine({ organizationId, eventId, lineId: second.id, field: "committed", amountCents: 60000, changedByUserId: plannerId });
    expect((await listBudgetLines(organizationId, eventId)).lines.filter((line) => line.eventVendorSlotId === slotId).map((line) => line.committedAmountCents)).toEqual([900000, 60000]);

    const history = await getVendorHistory(organizationId, vendor.id);
    expect(history.entries.map((entry) => [entry.outcome, entry.finalCents])).toEqual([["selected", 960000]]);
    expect(history.averageFinalCents).toBe(960000);
  });

  it("soldé : le total réglé ; non retenu : aucun montant final (l'écran dit « devis … »)", async () => {
    const organizationId = await newOrganization();
    const paid = (await createVendor(organizationId, { name: "Soldé" })).vendor;
    const other = (await createVendor(organizationId, { name: "Pas retenu" })).vendor;
    const { eventId, slotId } = await wedding(organizationId, "2027-06-12");
    const added = await addVendorToEventSlot({ organizationId, userId: plannerId, eventId, slotId, vendors: [{ vendorId: paid.id, vendorName: paid.name }, { vendorId: other.id, vendorName: other.name }], mode: "compare" });
    const [paidCandidate, otherCandidate] = (added as { candidateIds: string[] }).candidateIds;
    await updateVendorCandidate({ organizationId, candidateId: otherCandidate!, quoteAmountCents: 980000 });
    await updateVendorCandidate({ organizationId, candidateId: paidCandidate!, quoteAmountCents: 500000 });
    await addVendorToEventSlot({ organizationId, userId: plannerId, eventId, slotId, vendors: [{ vendorId: paid.id, vendorName: paid.name }], mode: "retain" });
    await applyVendorSlotBookedToBudget(organizationId, { eventId, vendorSlotId: slotId, label: "Traiteur", amountCents: 500000, candidateId: paidCandidate!, currency: "EUR", bookedByUserId: plannerId });
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: slotId, field: "paid", amountCents: 520000, changedByUserId: plannerId });
    await updateVendorCandidate({ organizationId, candidateId: paidCandidate!, status: "paid_off", changedByUserId: plannerId });
    expect((await listVendorCandidates(organizationId, eventId)).find((candidate) => candidate.id === paidCandidate)!.status).toBe("paid_off");
    expect((await getVendorHistory(organizationId, paid.id)).entries.map((entry) => entry.finalCents)).toEqual([520000]);
    const notRetained = await getVendorHistory(organizationId, other.id);
    expect(notRetained.entries.map((entry) => [entry.outcome, entry.quotedCents, entry.finalCents])).toEqual([["not_selected", 980000, null]]);
  });
});

describe("PRE-05 — Les natures de pièces de départ (lot 73a, critère 12 ; P3, P4)", () => {
  it("une organisation neuve a l'assurance et le Kbis « demandés d'habitude », avec leur nom court ; le plan et l'autre pièce non", async () => {
    const organizationId = await newOrganization();
    const kinds = await listVendorDocumentKinds(organizationId);
    expect(kinds.map((kind) => [kind.starterKey, kind.shortLabel, kind.requestedByDefault])).toEqual([
      ["insurance", "Assurance", true],
      ["registration", "Kbis", true],
      ["venue_plan", "Plan", false],
      ["other", "Autre", false],
    ]);
    const english = await newOrganization();
    expect((await listVendorDocumentKinds(english, "en")).map((kind) => kind.shortLabel)).toEqual(["Insurance", "Registration", "Plan", "Other"]);
  });

  it("le nom court et « demandée d'habitude » se règlent ; vide, le libellé complet ; trop long ou avec un caractère de contrôle, refusé", async () => {
    const organizationId = await newOrganization();
    const { plan, insurance } = await kindsOf(organizationId);
    expect(await setVendorDocumentKindUsage(organizationId, plan.id, { shortLabel: " Plan d'accès ", requestedByDefault: true })).toMatchObject({ shortLabel: "Plan d'accès", requestedByDefault: true });
    expect(await setVendorDocumentKindUsage(organizationId, insurance.id, { shortLabel: "" })).toMatchObject({ shortLabel: null, requestedByDefault: true });
    await expect(setVendorDocumentKindUsage(organizationId, plan.id, { shortLabel: "x".repeat(41) })).rejects.toBeInstanceOf(RangeError);
    await expect(setVendorDocumentKindUsage(organizationId, plan.id, { shortLabel: "Plan\u0007" })).rejects.toBeInstanceOf(RangeError);
  });

  it("« Demander l'assurance et le Kbis » demande les natures habituelles qui ne sont ni demandées ni valables", async () => {
    const organizationId = await newOrganization();
    const { insurance, registration } = await kindsOf(organizationId);
    const vendor = (await createVendor(organizationId, { name: "Fiche neuve" })).vendor;
    await deposit(organizationId, vendor.id, insurance.id, { status: "verified", validUntil: "2099-01-01" });
    const requested = await requestUsualVendorDocuments({ organizationId, vendorId: vendor.id, now: NOW });
    expect(requested.map((document) => [document.kindId, document.status])).toEqual([[registration.id, "requested"]]);
    expect(await requestUsualVendorDocuments({ organizationId, vendorId: vendor.id, now: NOW })).toEqual([]);
    expect(await listVendorDocuments(organizationId, vendor.id, NOW)).toHaveLength(2);
  });
});

describe("SEC-10, SEC-11 — Isolation des pièces, compteurs et natures (lot 73a)", () => {
  it("l'organisation A ne lit ni l'état des pièces, ni les compteurs, ni les natures de B, et ne les modifie pas", async () => {
    const a = await newOrganization();
    const b = await newOrganization();
    const kindsB = await kindsOf(b);
    const vendorB = (await createVendor(b, { name: "Fiche de B" })).vendor;
    await deposit(b, vendorB.id, kindsB.insurance.id, { status: "verified", validUntil: "2026-01-01" });
    const { eventId, slotId } = await wedding(b, "2027-06-12");
    await retain(b, eventId, slotId, vendorB);

    expect((await summarizeVendorDocuments(a, [vendorB.id], { now: NOW })).get(vendorB.id)!.state).toBe("none_requested");
    expect(await findVendors({ organizationId: a, ids: [vendorB.id], now: NOW })).toEqual([]);
    expect((await listVendorDocumentKinds(a)).some((kind) => kind.id === kindsB.insurance.id)).toBe(false);
    await expect(setVendorDocumentKindUsage(a, kindsB.insurance.id, { shortLabel: "Piratée" })).rejects.toThrow();
    await expect(requestUsualVendorDocuments({ organizationId: a, vendorId: vendorB.id, now: NOW })).rejects.toThrow();
    expect((await listVendorDocumentKinds(b)).find((kind) => kind.id === kindsB.insurance.id)!.shortLabel).toBe("Assurance");
    expect(await listVendorDocuments(b, vendorB.id, NOW)).toHaveLength(1);
    // Le compteur « Avec vous » de B reste chez B.
    expect((await findVendors({ organizationId: b, now: NOW }))[0]!.workedWithCount).toBe(1);
  });
});
