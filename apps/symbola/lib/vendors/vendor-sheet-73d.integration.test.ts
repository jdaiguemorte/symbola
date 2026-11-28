// Lot 73d (PRE-01, PRE-02, PRE-05, PRE-08, PRE-10, DAT-08, SEC-10 à SEC-13 ; spécification du lot 73,
// § 5.4, critères 5, 8 et 10 ; P4, P9, C-48) — créer une fiche (au carnet, depuis un poste avec le statut
// choisi), le montant d'un mariage sur la fiche (le même que la colonne « Réel » du budget), les pièces
// demandées d'habitude et leur « Annuler », le lien du prestataire qui les reçoit ; contre un vrai PostgreSQL
// (RLS). Tests d'abus : poste ou fiche d'une autre organisation, mariage annulé, note confidentielle, ce que
// voit le lien d'un prestataire.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import type { EventLinkRights, VendorSlotBookedPayload } from "@symbola/contracts";
import { addBudgetLine, applyVendorSlotBookedToBudget, listBudgetLines, updateBudgetLine } from "@/modules/budget/service";
import {
  addDefaultVendorSlots,
  cancelEvent,
  createEventLink,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
  listVendorCandidates,
  revokeEventLink,
  updateVendorCandidate,
} from "@/modules/events/service";
import {
  ConfidentialNoteForbiddenError,
  createVendor,
  createVendorType,
  findVendors,
  getVendor,
  getVendorBankSummary,
  getVendorHistory,
  listRequestedVendorDocuments,
  listVendorDocumentKinds,
  listVendorDocuments,
  readVendorConfidentialNote,
  saveVendorNote,
  setVendorBankDetails,
  setVendorDocumentKindUsage,
} from "@/modules/vendors/service";
import { buildBudgetVendorRows } from "@/app/events/[id]/budget-vendor-rows";
import type { AdditionAccess } from "./add-to-event";
import { createVendorRecord, requestUsualDocuments, slotCreationContext, undoRequestedDocuments, vendorRequestReach } from "./vendor-sheet";

const plannerId = randomUUID();
const TODAY = "2026-11-28";
const NO_RIGHTS: EventLinkRights = { rubrics: [], budgetScope: "all", sharedSlotIds: [] };

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function agency() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await addDefaultVendorSlots(organizationId, ["Traiteur", "Transport"]);
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }, { firstName: "Maxime", lastName: null }], eventDate: "2099-06-12" });
  const slots = await listEventVendorSlots(organizationId, eventId);
  const caterer = slots.find((slot) => slot.label === "Traiteur")!;
  const transport = slots.find((slot) => slot.label === "Transport")!;
  const traiteur = await createVendorType(organizationId, "Traiteur", "#b45309");
  const access: AdditionAccess = { organizationId, userId: plannerId, viewer: { userId: plannerId, role: "owner", allPlannersSeeAll: true }, budgetEnabled: true };
  return { organizationId, eventId, caterer, transport, traiteur, access };
}

const statusOf = async (context: { organizationId: string; eventId: string }, vendorId: string) => (await listVendorCandidates(context.organizationId, context.eventId)).find((candidate) => candidate.vendorId === vendorId)?.status ?? null;

describe("PRE-01, PRE-02 — Créer une fiche, au carnet ou depuis un poste (lot 73d, critères 1 et 5)", () => {
  it("depuis un poste, le métier est proposé d'après le poste et le mariage est nommé", async () => {
    const context = await agency();
    const proposed = await slotCreationContext(context.access, { eventId: context.eventId, slotId: context.caterer.id, today: TODAY });
    expect(proposed).toEqual({ eventId: context.eventId, slotId: context.caterer.id, slotLabel: "Traiteur", eventLabel: "Léa & Maxime", proposedTypeId: context.traiteur.id });
  });

  it("« Créer et ajouter » en comparaison : la fiche est au carnet et sur le poste, en comparaison", async () => {
    const context = await agency();
    const outcome = await createVendorRecord(context.access, { vendor: { name: "Les Calèches du Lac", typeIds: [], city: "Niort", phone: "06 00 00 12 96" }, slot: { eventId: context.eventId, slotId: context.transport.id, mode: "compare", today: TODAY } });
    expect(outcome.status).toBe("created_and_added");
    const vendorId = outcome.status === "created_and_added" ? outcome.result.vendor.id : "";
    expect((await findVendors({ organizationId: context.organizationId })).map((vendor) => vendor.id)).toContain(vendorId);
    expect(await statusOf(context, vendorId)).toBe("shortlisted");
  });

  it("« Créer et ajouter » retenu : la fiche est retenue sur le poste", async () => {
    const context = await agency();
    const outcome = await createVendorRecord(context.access, { vendor: { name: "Maison Haddad", typeIds: [context.traiteur.id], primaryTypeId: context.traiteur.id }, slot: { eventId: context.eventId, slotId: context.caterer.id, mode: "retain", today: TODAY } });
    expect(outcome.status).toBe("created_and_added");
    const vendorId = outcome.status === "created_and_added" ? outcome.result.vendor.id : "";
    expect(await statusOf(context, vendorId)).toBe("retained");
    expect((await getVendor(context.organizationId, vendorId))?.typeIds).toEqual([context.traiteur.id]);
  });

  it("retenu sur un poste déjà pourvu : la fiche est créée, l'ajout attend « Remplacer » ou « Retenir aussi » (P12)", async () => {
    const context = await agency();
    await createVendorRecord(context.access, { vendor: { name: "Premier traiteur" }, slot: { eventId: context.eventId, slotId: context.caterer.id, mode: "retain", today: TODAY } });
    const outcome = await createVendorRecord(context.access, { vendor: { name: "Second traiteur" }, slot: { eventId: context.eventId, slotId: context.caterer.id, mode: "retain", today: TODAY } });
    expect(outcome).toMatchObject({ status: "created_pending", addition: { status: "choice_required", retainedName: "Premier traiteur" } });
  });

  it("au carnet, « À classer » choisi exprès : la fiche est créée sans métier, sans poste", async () => {
    const context = await agency();
    const outcome = await createVendorRecord(context.access, { vendor: { name: "Douceurs Montées", typeIds: [] } });
    expect(outcome.status).toBe("created");
    expect(outcome.status === "created" ? outcome.result.vendor.typeIds : null).toEqual([]);
    expect(await listVendorCandidates(context.organizationId, context.eventId)).toEqual([]);
  });

  it("abus : un poste d'une autre organisation, ou d'un mariage annulé, est « introuvable » et aucune fiche n'est créée", async () => {
    const a = await agency();
    const b = await agency();
    expect(await createVendorRecord(a.access, { vendor: { name: "Intrus" }, slot: { eventId: b.eventId, slotId: b.caterer.id, mode: "compare", today: TODAY } })).toEqual({ status: "not_found" });
    expect(await createVendorRecord(a.access, { vendor: { name: "Intrus" }, slot: { eventId: a.eventId, slotId: b.caterer.id, mode: "compare", today: TODAY } })).toEqual({ status: "not_found" });
    await cancelEvent({ organizationId: a.organizationId, eventId: a.eventId, changedByUserId: plannerId, lossReasonId: null, lossReasonNote: null });
    expect(await createVendorRecord(a.access, { vendor: { name: "Intrus" }, slot: { eventId: a.eventId, slotId: a.caterer.id, mode: "compare", today: TODAY } })).toEqual({ status: "not_found" });
    expect(await findVendors({ organizationId: a.organizationId })).toEqual([]);
    expect(await findVendors({ organizationId: b.organizationId })).toEqual([]);
  });
});

describe("PRE-08 — Un seul montant par mariage, le même que la colonne « Réel » du budget (lot 73d, critère 8 ; P9, C-48)", () => {
  it("un poste à deux lignes : la fiche dit le total du poste, comme le budget, et non la dernière ligne", async () => {
    const context = await agency();
    const created = await createVendorRecord(context.access, { vendor: { name: "Maison Haddad" }, slot: { eventId: context.eventId, slotId: context.caterer.id, mode: "compare", today: TODAY } });
    const vendorId = created.status === "created_and_added" ? created.result.vendor.id : "";
    const candidateId = (await listVendorCandidates(context.organizationId, context.eventId)).find((candidate) => candidate.vendorId === vendorId)!.id;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId, quoteAmountCents: 900000 });
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId, status: "retained", changedByUserId: plannerId });
    const payload: VendorSlotBookedPayload = { eventId: context.eventId, vendorSlotId: context.caterer.id, label: "Traiteur", amountCents: 900000, candidateId, currency: "EUR", bookedByUserId: plannerId };
    await applyVendorSlotBookedToBudget(context.organizationId, payload);
    const view = await addBudgetLine({ organizationId: context.organizationId, eventId: context.eventId, eventVendorSlotId: context.caterer.id, label: "Brunch du lendemain", vendorCandidateId: candidateId });
    await updateBudgetLine({ organizationId: context.organizationId, eventId: context.eventId, lineId: view.lines.find((line) => line.label === "Brunch du lendemain")!.id, field: "committed", amountCents: 60000, changedByUserId: plannerId });

    const lines = (await listBudgetLines(context.organizationId, context.eventId)).lines;
    const slots = await listEventVendorSlots(context.organizationId, context.eventId);
    const budget = buildBudgetVendorRows(slots, [{ eventVendorSlotId: context.caterer.id, lines: lines.filter((line) => line.eventVendorSlotId === context.caterer.id) }], TODAY);
    const actual = budget.rows.find((row) => row.slotId === context.caterer.id)!.actualCents;
    const history = await getVendorHistory(context.organizationId, vendorId);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({ slotId: context.caterer.id, status: "retained", outcome: "selected", finalCents: 960000 });
    expect(history.entries[0]!.finalCents).toBe(actual);
  });
});

describe("PRE-05 — « Demander l'assurance et le Kbis » (lot 73d, critère 10 ; P4)", () => {
  it("demande chaque nature demandée d'habitude, une seule fois ; la demande paraît sur le lien du prestataire ; « Annuler » la retire", async () => {
    const context = await agency();
    const vendor = (await createVendor(context.organizationId, { name: "Les Calèches du Lac" })).vendor;
    const requested = await requestUsualDocuments(context.organizationId, vendor.id);
    expect(requested.vendorName).toBe("Les Calèches du Lac");
    expect(requested.documentIds).toHaveLength(2);
    const seenByLink = await listRequestedVendorDocuments(context.organizationId, vendor.id);
    expect(seenByLink.map((document) => document.kindLabel).sort()).toEqual(["Attestation d'assurance responsabilité civile", "Extrait Kbis ou avis de situation Insee"]);
    expect((await requestUsualDocuments(context.organizationId, vendor.id)).documentIds).toEqual([]);
    expect(await undoRequestedDocuments(context.organizationId, vendor.id, requested.documentIds)).toBe(2);
    expect(await listVendorDocuments(context.organizationId, vendor.id)).toEqual([]);
  });

  it("les réglages des natures décident : une nature décochée n'est plus demandée, une nature cochée l'est (P4, D7)", async () => {
    const context = await agency();
    const kinds = await listVendorDocumentKinds(context.organizationId);
    const kbis = kinds.find((kind) => kind.starterKey === "registration")!;
    const plan = kinds.find((kind) => kind.starterKey === "venue_plan")!;
    await setVendorDocumentKindUsage(context.organizationId, kbis.id, { requestedByDefault: false });
    await setVendorDocumentKindUsage(context.organizationId, plan.id, { shortLabel: "Plan", requestedByDefault: true });
    const vendor = (await createVendor(context.organizationId, { name: "Domaine des Aulnes" })).vendor;
    await requestUsualDocuments(context.organizationId, vendor.id);
    expect((await listVendorDocuments(context.organizationId, vendor.id)).map((document) => document.kindId).sort()).toEqual([kinds.find((kind) => kind.starterKey === "insurance")!.id, plan.id].sort());
  });

  it("la fenêtre dit vrai : sans lien, la demande l'attendra ; avec un lien ouvert, elle y arrive ; retiré, elle attend de nouveau", async () => {
    const context = await agency();
    const created = await createVendorRecord(context.access, { vendor: { name: "Maison Haddad" }, slot: { eventId: context.eventId, slotId: context.caterer.id, mode: "compare", today: TODAY } });
    const vendorId = created.status === "created_and_added" ? created.result.vendor.id : "";
    expect(await vendorRequestReach(context.organizationId, vendorId)).toBe("waiting");
    const candidateId = (await listVendorCandidates(context.organizationId, context.eventId)).find((candidate) => candidate.vendorId === vendorId)!.id;
    const link = await createEventLink({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: plannerId, audience: "vendor", vendorCandidateId: candidateId, locale: "fr", link: { personName: "Karim", email: `${randomUUID()}@example.test`, rights: NO_RIGHTS } });
    expect(await vendorRequestReach(context.organizationId, vendorId)).toBe("link");
    await revokeEventLink(context.organizationId, link.link.id);
    expect(await vendorRequestReach(context.organizationId, vendorId)).toBe("waiting");
  });

  it("abus : une fiche d'une autre organisation est refusée ; son lien n'est pas vu ; « Annuler » ne retire rien chez elle", async () => {
    const a = await agency();
    const b = await agency();
    const vendorB = (await createVendor(b.organizationId, { name: "Chez B" })).vendor;
    await expect(requestUsualDocuments(a.organizationId, vendorB.id)).rejects.toThrow();
    const requestedB = await requestUsualDocuments(b.organizationId, vendorB.id);
    expect(await undoRequestedDocuments(a.organizationId, vendorB.id, requestedB.documentIds)).toBe(0);
    expect(await listVendorDocuments(b.organizationId, vendorB.id)).toHaveLength(2);
    expect(await vendorRequestReach(a.organizationId, vendorB.id)).toBe("waiting");
    expect(await getVendorHistory(a.organizationId, vendorB.id)).toEqual({ entries: [], averageFinalCents: null });
  });
});

describe("DAT-08, PRE-10 — La note confidentielle et l'IBAN gardent leur protection (lot 73d)", () => {
  it("la note confidentielle reste refusée à qui n'y a pas droit ; le lien d'un prestataire ne reçoit que l'IBAN masqué", async () => {
    const context = await agency();
    const vendor = (await createVendor(context.organizationId, { name: "Maison Haddad" })).vendor;
    await saveVendorNote(context.organizationId, vendor.id, { note: "Remise de 5 % négociée", confidential: true }, { userId: plannerId, role: "owner" });
    await expect(readVendorConfidentialNote(context.organizationId, vendor.id, { userId: randomUUID(), role: "planner" })).rejects.toBeInstanceOf(ConfidentialNoteForbiddenError);
    expect(await readVendorConfidentialNote(context.organizationId, vendor.id, { userId: plannerId, role: "owner" })).toBe("Remise de 5 % négociée");
    await setVendorBankDetails(context.organizationId, vendor.id, { iban: "FR7630006000011234567890189", bic: null }, { kind: "user", userId: plannerId });
    const bank = await getVendorBankSummary(context.organizationId, vendor.id);
    expect(bank.ibanMasked).toBe("FR76 •••• •••• 0189");
    expect(JSON.stringify(bank)).not.toContain("30006000011234567890");
    expect((await getVendor(context.organizationId, vendor.id))?.internalNote).toBeNull();
  });
});
