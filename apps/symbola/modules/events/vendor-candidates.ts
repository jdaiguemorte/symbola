// Lot 11 (L11-EVT-10 / L11-EVT-11, ADR 0031) — prestataires consultés pour un
// poste : accès aux données et règles du module events. Exposé aux autres
// modules seulement par service.ts (ADR 0011).
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventVendorCandidateNotes, eventVendorCandidates, events, eventVendorSlots } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import type {
  AddVendorCandidateInput,
  ClientVendorSlotOptions,
  FileDownload,
  UpdateVendorCandidateInput,
  VendorCandidate,
  VendorConsultation,
} from "@symbola/contracts";
import {
  ENGAGED_CANDIDATE_STATUSES,
  EVT_VENDOR_SLOT_BOOKED,
  EVT_VENDOR_SLOT_BOOKED_VERSION,
  vendorSlotBookedPayloadSchema,
  type RetainedVendor,
  type VendorCandidateStatus,
} from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type CandidateRow = typeof eventVendorCandidates.$inferSelect;
type NoteRow = typeof eventVendorCandidateNotes.$inferSelect;

// Mêmes règles que les devis joints au budget (PRD-BUD-03, ADR 0031 § 8).
export const CANDIDATE_QUOTE_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class VendorCandidateNotFoundError extends Error {
  constructor() {
    super("prestataire consulté introuvable");
    this.name = "VendorCandidateNotFoundError";
  }
}
export class CandidateQuoteRejectedError extends Error {
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected") {
    super(`devis refusé : ${reason}`);
    this.name = "CandidateQuoteRejectedError";
  }
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

function toCandidate(row: CandidateRow, notes: NoteRow[]): VendorCandidate {
  return {
    id: row.id,
    eventId: row.eventId,
    vendorSlotId: row.vendorSlotId,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    status: row.status,
    contactedOn: row.contactedOn,
    quoteAmountCents: row.quoteAmountCents,
    currency: "EUR",
    hasQuoteFile: row.quoteFileKey !== null,
    quoteSizeBytes: row.quoteFileKey !== null ? row.quoteSizeBytes : null,
    shownToClients: row.shownToClients,
    shareRibWithClients: row.shareRibWithClients,
    outcome: isEngaged(row.status) ? "selected" : row.status === "dismissed" ? "not_selected" : null,
    notes: notes
      .filter((note) => note.candidateId === row.id)
      .map((note) => ({ id: note.id, body: note.body, visibleToClients: note.visibleToClients, createdAt: note.createdAt.toISOString() })),
  };
}

// Lot 28a (PRE-02) : le statut du poste se déduit de ses prestataires ; il
// n'avance plus de lui-même.
const isEngaged = (status: VendorCandidateStatus) => ENGAGED_CANDIDATE_STATUSES.includes(status);
// Un montant ou un devis reçu fait passer un prestataire pressenti ou consulté à « Devis reçu ».
const withQuote = (status: VendorCandidateStatus): VendorCandidateStatus => (status === "shortlisted" || status === "contacted" ? "quote_received" : status);
// Lot 28b (PRE-02, décision D10) : concurrents encore en lice, écartés quand un autre est retenu.
const IN_THE_RUNNING: VendorCandidateStatus[] = ["shortlisted", "contacted", "quote_received"];

// Lot 28b (PRE-02, D11) : un prestataire devient « Retenu », ou le devis d'un
// prestataire retenu change ; le module Budget engage ses lignes. Dans la même
// transaction que l'écriture (outbox), jamais pour un événement d'essai.
async function publishRetention(tx: Tx, organizationId: string, candidate: CandidateRow, changedByUserId: string): Promise<void> {
  const [parent] = await tx.select({ isDemo: events.isDemo }).from(events).where(eq(events.id, candidate.eventId));
  const [slot] = await tx.select({ label: eventVendorSlots.label }).from(eventVendorSlots).where(eq(eventVendorSlots.id, candidate.vendorSlotId));
  if (!slot || !parent || parent.isDemo) return;
  await emitDomainEvent(tx, {
    organizationId,
    name: EVT_VENDOR_SLOT_BOOKED,
    version: EVT_VENDOR_SLOT_BOOKED_VERSION,
    payload: vendorSlotBookedPayloadSchema.parse({
      eventId: candidate.eventId,
      vendorSlotId: candidate.vendorSlotId,
      label: slot.label,
      amountCents: candidate.quoteAmountCents,
      candidateId: candidate.id,
      currency: "EUR",
      bookedByUserId: changedByUserId,
    }),
  });
}

// Lot 28b (D10) : prestataires retenus (Retenu, Contrat signé, Soldé) des postes.
export async function retainedVendorsBySlot(organizationId: string, eventIds: string[]): Promise<Map<string, RetainedVendor[]>> {
  const bySlot = new Map<string, RetainedVendor[]>();
  if (eventIds.length === 0) return bySlot;
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(eventVendorCandidates)
      .where(and(inArray(eventVendorCandidates.eventId, eventIds), inArray(eventVendorCandidates.status, [...ENGAGED_CANDIDATE_STATUSES])))
      .orderBy(asc(eventVendorCandidates.position), asc(eventVendorCandidates.createdAt)),
  );
  for (const row of rows) {
    const list = bySlot.get(row.vendorSlotId) ?? [];
    list.push({ candidateId: row.id, vendorName: row.vendorName, quoteAmountCents: row.quoteAmountCents });
    bySlot.set(row.vendorSlotId, list);
  }
  return bySlot;
}

export async function getCandidate(organizationId: string, candidateId: string): Promise<VendorCandidate | null> {
  if (!UUID.test(candidateId)) return null;
  const row = await inOrganization(organizationId, async (tx) => (await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, candidateId)))[0]);
  return row ? toCandidate(row, []) : null;
}

export async function listCandidates(organizationId: string, eventId: string): Promise<VendorCandidate[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select({ candidate: eventVendorCandidates })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(eq(eventVendorCandidates.eventId, eventId))
      .orderBy(asc(eventVendorCandidates.position), asc(eventVendorCandidates.createdAt));
    const ids = rows.map((row) => row.candidate.id);
    const notes =
      ids.length > 0
        ? await tx.select().from(eventVendorCandidateNotes).where(inArray(eventVendorCandidateNotes.candidateId, ids)).orderBy(asc(eventVendorCandidateNotes.createdAt))
        : [];
    return rows.map((row) => toCandidate(row.candidate, notes));
  });
}

export async function addCandidate(input: AddVendorCandidateInput): Promise<VendorCandidate> {
  const vendorName = input.vendorName.trim();
  if (!vendorName) throw new RangeError("le nom du prestataire est obligatoire");
  if (input.vendorId && !UUID.test(input.vendorId)) throw new RangeError("fiche du carnet invalide");
  return inOrganization(input.organizationId, async (tx) => {
    const [slot] = await tx
      .select()
      .from(eventVendorSlots)
      .where(and(eq(eventVendorSlots.id, input.vendorSlotId), eq(eventVendorSlots.eventId, input.eventId)));
    if (!slot) throw new VendorCandidateNotFoundError();
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${eventVendorCandidates.position}) + 1, 0)::int` })
      .from(eventVendorCandidates)
      .where(eq(eventVendorCandidates.vendorSlotId, slot.id));
    const [row] = await tx
      .insert(eventVendorCandidates)
      .values({
        organizationId: input.organizationId,
        eventId: slot.eventId,
        vendorSlotId: slot.id,
        vendorId: input.vendorId ?? null,
        vendorName,
        position: next,
      })
      .returning();
    if (!row) throw new Error("ajout du prestataire consulté échoué");
    return toCandidate(row, []);
  });
}

export async function updateCandidate(input: UpdateVendorCandidateInput): Promise<void> {
  if (input.quoteAmountCents !== undefined && input.quoteAmountCents !== null) {
    if (!Number.isInteger(input.quoteAmountCents) || input.quoteAmountCents < 0) throw new RangeError("le montant doit être un nombre entier positif de centimes");
  }
  if (input.contactedOn && !DATE.test(input.contactedOn)) throw new RangeError("date invalide");
  const outcome = await inOrganization(input.organizationId, async (tx) => {
    const [current] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId));
    if (!current) throw new VendorCandidateNotFoundError();
    // Un montant saisi vaut « Devis reçu » pour un prestataire pressenti ou consulté.
    const asked = input.status ?? current.status;
    const status = input.quoteAmountCents != null ? withQuote(asked) : asked;
    const wasEngaged = isEngaged(current.status);
    // Passer à « Retenu » (ou au-delà) passe par la sélection, qui engage le budget.
    const engaging = isEngaged(status) && !wasEngaged;
    if (engaging && !input.changedByUserId) throw new RangeError("l'auteur du passage à « Retenu » est obligatoire");
    const [updated] = await tx
      .update(eventVendorCandidates)
      .set({
        ...(engaging ? {} : { status }),
        ...(input.contactedOn !== undefined ? { contactedOn: input.contactedOn } : {}),
        ...(input.quoteAmountCents !== undefined ? { quoteAmountCents: input.quoteAmountCents } : {}),
        ...(input.shownToClients !== undefined ? { shownToClients: input.shownToClients } : {}),
        ...(input.shareRibWithClients !== undefined ? { shareRibWithClients: input.shareRibWithClients && current.vendorId !== null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventVendorCandidates.id, current.id))
      .returning();
    // Le devis d'un prestataire retenu change : l'engagement du budget suit.
    const quoteChanged = input.quoteAmountCents !== undefined && input.quoteAmountCents !== current.quoteAmountCents;
    if (updated && wasEngaged && isEngaged(status) && quoteChanged && input.changedByUserId) {
      await publishRetention(tx, input.organizationId, updated, input.changedByUserId);
    }
    return { engaging, status };
  });
  if (outcome.engaging) {
    await selectCandidate({ organizationId: input.organizationId, candidateId: input.candidateId, changedByUserId: input.changedByUserId!, status: outcome.status });
  }
}

export async function linkCandidate(organizationId: string, candidateId: string, vendorId: string): Promise<void> {
  if (!UUID.test(vendorId)) throw new RangeError("fiche du carnet invalide");
  await inOrganization(organizationId, async (tx) => {
    const updated = await tx.update(eventVendorCandidates).set({ vendorId, updatedAt: new Date() }).where(eq(eventVendorCandidates.id, candidateId)).returning();
    if (updated.length === 0) throw new VendorCandidateNotFoundError();
  });
}

export async function removeCandidate(organizationId: string, candidateId: string): Promise<void> {
  const fileKey = await inOrganization(organizationId, async (tx) => {
    const [row] = await tx.delete(eventVendorCandidates).where(eq(eventVendorCandidates.id, candidateId)).returning();
    return row ? row.quoteFileKey : null;
  });
  if (fileKey) await deletePrivateObject(createStorageClient(), fileKey).catch(() => undefined);
}

export async function attachCandidateQuote(input: { organizationId: string; candidateId: string; content: Uint8Array }): Promise<void> {
  const exists = await inOrganization(input.organizationId, async (tx) => (await tx.select({ id: eventVendorCandidates.id }).from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId))).length > 0);
  if (!exists) throw new VendorCandidateNotFoundError();
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: CANDIDATE_QUOTE_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new CandidateQuoteRejectedError(upload.reason);
  const previousKey = await inOrganization(input.organizationId, async (tx) => {
    const [current] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId));
    if (!current) throw new VendorCandidateNotFoundError();
    await tx
      .update(eventVendorCandidates)
      .set({
        quoteFileKey: upload.key,
        quoteMime: upload.mime,
        quoteSizeBytes: upload.size,
        status: withQuote(current.status),
        updatedAt: new Date(),
      })
      .where(eq(eventVendorCandidates.id, current.id));
    return current.quoteFileKey;
  });
  if (previousKey) await deletePrivateObject(createStorageClient(), previousKey).catch(() => undefined);
}

async function readQuote(row: Pick<CandidateRow, "id" | "quoteFileKey" | "quoteMime" | "vendorName">): Promise<FileDownload> {
  if (!row.quoteFileKey || !row.quoteMime) throw new VendorCandidateNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), row.quoteFileKey);
    const extension = row.quoteFileKey.split(".").pop() ?? "bin";
    const safeName = row.vendorName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "prestataire";
    return { data, contentType: row.quoteMime, fileName: `devis-${safeName}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new VendorCandidateNotFoundError();
    throw error;
  }
}

export async function getCandidateQuoteFile(organizationId: string, candidateId: string): Promise<FileDownload> {
  if (!UUID.test(candidateId)) throw new VendorCandidateNotFoundError();
  const row = await inOrganization(organizationId, async (tx) => (await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, candidateId)))[0]);
  if (!row) throw new VendorCandidateNotFoundError();
  return readQuote(row);
}

export async function addCandidateNote(input: { organizationId: string; candidateId: string; body: string; visibleToClients: boolean; createdByUserId: string }): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new RangeError("la note est vide");
  if (body.length > 2000) throw new RangeError("la note est trop longue");
  await inOrganization(input.organizationId, async (tx) => {
    const [candidate] = await tx.select({ id: eventVendorCandidates.id }).from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId));
    if (!candidate) throw new VendorCandidateNotFoundError();
    await tx.insert(eventVendorCandidateNotes).values({
      organizationId: input.organizationId,
      candidateId: candidate.id,
      body,
      visibleToClients: input.visibleToClients,
      createdByUserId: input.createdByUserId,
    });
  });
}

export async function setCandidateNoteVisibility(organizationId: string, noteId: string, visibleToClients: boolean): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.update(eventVendorCandidateNotes).set({ visibleToClients }).where(eq(eventVendorCandidateNotes.id, noteId)));
}

export async function removeCandidateNote(organizationId: string, noteId: string): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.delete(eventVendorCandidateNotes).where(eq(eventVendorCandidateNotes.id, noteId)));
}

// « Retenir » (PRD-EVT-03, ADR 0031 § 2). Lot 28b (PRE-02, décisions D10 et
// D11) : le prestataire passe à « Retenu » (ou garde un statut plus avancé) ;
// les concurrents encore en lice du poste sont écartés, un prestataire déjà
// retenu le reste. L'engagement part au budget par l'événement interne.
export async function selectCandidate(input: { organizationId: string; candidateId: string; changedByUserId: string; status?: VendorCandidateStatus }): Promise<void> {
  const found = await inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId));
    if (!row) return false;
    const wasEngaged = isEngaged(row.status);
    const status = input.status && isEngaged(input.status) ? input.status : wasEngaged ? row.status : "retained";
    await tx
      .update(eventVendorCandidates)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(and(eq(eventVendorCandidates.vendorSlotId, row.vendorSlotId), ne(eventVendorCandidates.id, row.id), inArray(eventVendorCandidates.status, IN_THE_RUNNING)));
    const [updated] = await tx.update(eventVendorCandidates).set({ status, updatedAt: new Date() }).where(eq(eventVendorCandidates.id, row.id)).returning();
    if (updated && !wasEngaged) await publishRetention(tx, input.organizationId, updated, input.changedByUserId);
    return true;
  });
  if (!found) throw new VendorCandidateNotFoundError();
}

// Raccourci du formulaire du poste : retient un prestataire par son nom (celui
// déjà rattaché au poste, ou un nouveau), au montant donné. Le montant d'un
// prestataire déjà retenu qui change part aussi au budget.
export async function retainVendorByName(input: { organizationId: string; vendorSlotId: string; vendorName: string; amountCents: number | null; changedByUserId: string }): Promise<void> {
  const name = input.vendorName.trim();
  if (!name) throw new RangeError("le nom du prestataire est obligatoire");
  const toSelect = await inOrganization(input.organizationId, async (tx) => {
    const [slot] = await tx.select().from(eventVendorSlots).where(eq(eventVendorSlots.id, input.vendorSlotId));
    if (!slot) throw new VendorCandidateNotFoundError();
    const existing = (await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, slot.id))).find(
      (row) => row.vendorName.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      const quoteChanged = input.amountCents !== null && input.amountCents !== existing.quoteAmountCents;
      const [updated] = quoteChanged
        ? await tx.update(eventVendorCandidates).set({ quoteAmountCents: input.amountCents, updatedAt: new Date() }).where(eq(eventVendorCandidates.id, existing.id)).returning()
        : [existing];
      if (!isEngaged(existing.status)) return existing.id;
      if (quoteChanged && updated) await publishRetention(tx, input.organizationId, updated, input.changedByUserId);
      return null;
    }
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${eventVendorCandidates.position}) + 1, 0)::int` })
      .from(eventVendorCandidates)
      .where(eq(eventVendorCandidates.vendorSlotId, slot.id));
    const [row] = await tx
      .insert(eventVendorCandidates)
      .values({ organizationId: input.organizationId, eventId: slot.eventId, vendorSlotId: slot.id, vendorName: name, quoteAmountCents: input.amountCents, position: next })
      .returning();
    if (!row) throw new Error("ajout du prestataire retenu échoué");
    return row.id;
  });
  if (toSelect) await selectCandidate({ organizationId: input.organizationId, candidateId: toSelect, changedByUserId: input.changedByUserId });
}

export async function setSlotBrief(organizationId: string, vendorSlotId: string, brief: string | null): Promise<void> {
  const clean = brief?.trim() ? brief.trim().slice(0, 2000) : null;
  await inOrganization(organizationId, (tx) => tx.update(eventVendorSlots).set({ brief: clean, updatedAt: new Date() }).where(eq(eventVendorSlots.id, vendorSlotId)));
}

// L11-PRE-09 — consultations d'une fiche du carnet (jamais les essais).
export async function listConsultations(organizationId: string, vendorId: string, namesOf: (eventIds: string[]) => Promise<Record<string, string>>): Promise<VendorConsultation[]> {
  if (!UUID.test(vendorId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({
        eventId: events.id,
        eventDate: events.eventDate,
        slotId: eventVendorSlots.id,
        slotLabel: eventVendorSlots.label,
        status: eventVendorCandidates.status,
        quotedCents: eventVendorCandidates.quoteAmountCents,
      })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(and(eq(eventVendorCandidates.vendorId, vendorId), eq(events.isDemo, false)))
      .orderBy(sql`${events.eventDate} desc nulls last`, asc(eventVendorSlots.label)),
  );
  const names = await namesOf([...new Set(rows.map((row) => row.eventId))]);
  return rows.map((row) => ({
    eventId: row.eventId,
    eventNames: names[row.eventId] ?? "",
    eventDate: row.eventDate,
    slotId: row.slotId,
    slotLabel: row.slotLabel,
    outcome: isEngaged(row.status) ? "selected" : row.status === "dismissed" ? "not_selected" : "pending",
    quotedCents: row.quotedCents,
  }));
}

// « Déjà travaillé avec » : fiches retenues au moins une fois, hors essais.
export async function listSelectedVendors(organizationId: string): Promise<string[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .selectDistinct({ vendorId: eventVendorCandidates.vendorId })
      .from(eventVendorCandidates)
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(and(isNotNull(eventVendorCandidates.vendorId), inArray(eventVendorCandidates.status, [...ENGAGED_CANDIDATE_STATUSES]), eq(events.isDemo, false)));
    return rows.map((row) => row.vendorId).filter((id): id is string => id !== null);
  });
}

// L11-EVT-11 — ce que voient les clients : consultés montrés, notes « Clients ».
// L'accès du client à l'événement est vérifié par l'appelant (service).
export async function clientOptions(organizationId: string, eventId: string): Promise<ClientVendorSlotOptions[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label, slotPosition: eventVendorSlots.position })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(and(eq(eventVendorCandidates.eventId, eventId), eq(eventVendorCandidates.shownToClients, true)))
      .orderBy(asc(eventVendorSlots.position), asc(eventVendorSlots.label), asc(eventVendorCandidates.position));
    const ids = rows.map((row) => row.candidate.id);
    const notes =
      ids.length > 0
        ? await tx
            .select()
            .from(eventVendorCandidateNotes)
            .where(and(inArray(eventVendorCandidateNotes.candidateId, ids), eq(eventVendorCandidateNotes.visibleToClients, true)))
            .orderBy(asc(eventVendorCandidateNotes.createdAt))
        : [];
    const bySlot = new Map<string, ClientVendorSlotOptions>();
    for (const row of rows) {
      const group = bySlot.get(row.candidate.vendorSlotId) ?? { slotLabel: row.slotLabel, options: [] };
      group.options.push({
        candidateId: row.candidate.id,
        vendorName: row.candidate.vendorName,
        quoteAmountCents: row.candidate.quoteAmountCents,
        hasQuoteFile: row.candidate.quoteFileKey !== null,
        notes: notes.filter((note) => note.candidateId === row.candidate.id).map((note) => note.body),
        ribShared: row.candidate.shareRibWithClients && row.candidate.vendorId !== null,
      });
      bySlot.set(row.candidate.vendorSlotId, group);
    }
    return [...bySlot.values()];
  });
}

export async function clientQuoteFile(organizationId: string, eventId: string, candidateId: string): Promise<FileDownload> {
  if (!UUID.test(candidateId)) throw new VendorCandidateNotFoundError();
  const row = await inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select()
        .from(eventVendorCandidates)
        .where(and(eq(eventVendorCandidates.id, candidateId), eq(eventVendorCandidates.eventId, eventId), eq(eventVendorCandidates.shownToClients, true)))
    )[0],
  );
  if (!row) throw new VendorCandidateNotFoundError();
  return readQuote(row);
}

// Fichiers des devis des consultés d'événements (purge des essais, RGPD).
export async function candidateQuoteKeys(organizationId: string, eventIds: string[], options: { demoOnly?: boolean } = {}): Promise<string[]> {
  if (eventIds.length === 0) return [];
  return inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select({ key: eventVendorCandidates.quoteFileKey })
        .from(eventVendorCandidates)
        .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
        .where(
          and(
            inArray(eventVendorCandidates.eventId, eventIds),
            isNotNull(eventVendorCandidates.quoteFileKey),
            ...(options.demoOnly ? [eq(events.isDemo, true)] : []),
          ),
        )
    )
      .map((row) => row.key)
      .filter((key): key is string => key !== null),
  );
}

export async function candidateQuoteKeysOfSlot(organizationId: string, vendorSlotId: string): Promise<string[]> {
  return inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select({ key: eventVendorCandidates.quoteFileKey })
        .from(eventVendorCandidates)
        .where(and(eq(eventVendorCandidates.vendorSlotId, vendorSlotId), isNotNull(eventVendorCandidates.quoteFileKey)))
    )
      .map((row) => row.key)
      .filter((key): key is string => key !== null),
  );
}

// Lot 12 (L12-EVT-16) — fiche du carnet dont le RIB est partagé aux clients de
// cet événement : consulté montré aux clients, case « Partager le RIB »
// cochée. L'accès du client est vérifié par l'appelant (service).
export async function sharedRibVendorId(organizationId: string, eventId: string, candidateId: string): Promise<string> {
  if (!UUID.test(candidateId)) throw new VendorCandidateNotFoundError();
  const row = await inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select({ vendorId: eventVendorCandidates.vendorId })
        .from(eventVendorCandidates)
        .where(
          and(
            eq(eventVendorCandidates.id, candidateId),
            eq(eventVendorCandidates.eventId, eventId),
            eq(eventVendorCandidates.shownToClients, true),
            eq(eventVendorCandidates.shareRibWithClients, true),
          ),
        )
    )[0],
  );
  if (!row?.vendorId) throw new VendorCandidateNotFoundError();
  return row.vendorId;
}
