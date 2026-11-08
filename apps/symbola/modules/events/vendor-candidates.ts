// Lot 11 (EVT-10 / EVT-11, ADR 0031) — prestataires consultés pour un
// poste : accès aux données et règles du module events. Exposé aux autres
// modules seulement par service.ts (ADR 0011).
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventVendorCandidateNotes, eventVendorCandidates, events, eventVendorSlots } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import type {
  AddVendorCandidateInput,
  ClientVendorSlotOptions,
  FileDownload,
  UpdateVendorCandidateInput,
  VendorCandidate,
  VendorConsultation,
} from "@symbola/contracts";
import { updateEventVendorSlotRow } from "./repository";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type CandidateRow = typeof eventVendorCandidates.$inferSelect;
type NoteRow = typeof eventVendorCandidateNotes.$inferSelect;

// Mêmes règles que les devis joints au budget (BUD-03, ADR 0031 § 8).
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

function toCandidate(row: CandidateRow, notes: NoteRow[], selectedCandidateId: string | null): VendorCandidate {
  return {
    id: row.id,
    eventId: row.eventId,
    vendorSlotId: row.vendorSlotId,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    response: row.response,
    contactedOn: row.contactedOn,
    quoteAmountCents: row.quoteAmountCents,
    currency: "EUR",
    hasQuoteFile: row.quoteFileKey !== null,
    shownToClients: row.shownToClients,
    shareRibWithClients: row.shareRibWithClients,
    outcome: selectedCandidateId === null ? null : selectedCandidateId === row.id ? "selected" : "not_selected",
    notes: notes
      .filter((note) => note.candidateId === row.id)
      .map((note) => ({ id: note.id, body: note.body, visibleToClients: note.visibleToClients, createdAt: note.createdAt.toISOString() })),
  };
}

// Le poste avance de lui-même (« À trouver » → « Devis demandé » →
// « Devis reçu »), jamais en arrière ni au-delà : réservé et non requis
// restent tels quels.
async function advanceSlot(tx: Tx, slotId: string, to: "quote_requested" | "quote_received"): Promise<void> {
  const from = to === "quote_requested" ? ["to_find"] : ["to_find", "quote_requested"];
  await tx
    .update(eventVendorSlots)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(eventVendorSlots.id, slotId), inArray(eventVendorSlots.status, from as ("to_find" | "quote_requested")[])));
}

export async function listCandidates(organizationId: string, eventId: string): Promise<VendorCandidate[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select({ candidate: eventVendorCandidates, selectedCandidateId: eventVendorSlots.selectedCandidateId })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(eq(eventVendorCandidates.eventId, eventId))
      .orderBy(asc(eventVendorCandidates.position), asc(eventVendorCandidates.createdAt));
    const ids = rows.map((row) => row.candidate.id);
    const notes =
      ids.length > 0
        ? await tx.select().from(eventVendorCandidateNotes).where(inArray(eventVendorCandidateNotes.candidateId, ids)).orderBy(asc(eventVendorCandidateNotes.createdAt))
        : [];
    return rows.map((row) => toCandidate(row.candidate, notes, row.selectedCandidateId));
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
    await advanceSlot(tx, slot.id, "quote_requested");
    return toCandidate(row, [], slot.selectedCandidateId);
  });
}

export async function updateCandidate(input: UpdateVendorCandidateInput): Promise<void> {
  if (input.quoteAmountCents !== undefined && input.quoteAmountCents !== null) {
    if (!Number.isInteger(input.quoteAmountCents) || input.quoteAmountCents < 0) throw new RangeError("le montant doit être un nombre entier positif de centimes");
  }
  if (input.contactedOn && !DATE.test(input.contactedOn)) throw new RangeError("date invalide");
  await inOrganization(input.organizationId, async (tx) => {
    const [current] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId));
    if (!current) throw new VendorCandidateNotFoundError();
    // Un montant saisi vaut réponse « devis reçu », même si le formulaire
    // renvoie encore « contacté » (jamais pour un prestataire écarté).
    const asked = input.response ?? current.response;
    const response = input.quoteAmountCents != null && asked === "contacted" ? "quote_received" : asked;
    await tx
      .update(eventVendorCandidates)
      .set({
        response,
        ...(input.contactedOn !== undefined ? { contactedOn: input.contactedOn } : {}),
        ...(input.quoteAmountCents !== undefined ? { quoteAmountCents: input.quoteAmountCents } : {}),
        ...(input.shownToClients !== undefined ? { shownToClients: input.shownToClients } : {}),
        ...(input.shareRibWithClients !== undefined ? { shareRibWithClients: input.shareRibWithClients && current.vendorId !== null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventVendorCandidates.id, current.id));
    if (response === "quote_received") await advanceSlot(tx, current.vendorSlotId, "quote_received");
  });
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
    if (!row) return null;
    await tx
      .update(eventVendorSlots)
      .set({ selectedCandidateId: null })
      .where(and(eq(eventVendorSlots.id, row.vendorSlotId), eq(eventVendorSlots.selectedCandidateId, row.id)));
    return row.quoteFileKey;
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
        response: current.response === "contacted" ? "quote_received" : current.response,
        updatedAt: new Date(),
      })
      .where(eq(eventVendorCandidates.id, current.id));
    if (current.response !== "declined") await advanceSlot(tx, current.vendorSlotId, "quote_received");
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

// « Retenir » = réserver le poste avec ce prestataire et son devis (EVT-03,
// ADR 0031 § 2) : même chemin que la réservation à la main, donc même
// événement interne pour le budget. Sans montant de devis, le montant déjà
// saisi sur le poste est gardé.
export async function selectCandidate(input: { organizationId: string; candidateId: string; changedByUserId: string }): Promise<void> {
  const candidate = await inOrganization(input.organizationId, async (tx) => (await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, input.candidateId)))[0]);
  if (!candidate) throw new VendorCandidateNotFoundError();
  const updated = await updateEventVendorSlotRow({
    organizationId: input.organizationId,
    vendorSlotId: candidate.vendorSlotId,
    changedByUserId: input.changedByUserId,
    status: "booked",
    vendorName: candidate.vendorName,
    ...(candidate.quoteAmountCents !== null ? { amountCents: candidate.quoteAmountCents } : {}),
    selectedCandidateId: candidate.id,
  });
  if (!updated) throw new VendorCandidateNotFoundError();
}

export async function setSlotBrief(organizationId: string, vendorSlotId: string, brief: string | null): Promise<void> {
  const clean = brief?.trim() ? brief.trim().slice(0, 2000) : null;
  await inOrganization(organizationId, (tx) => tx.update(eventVendorSlots).set({ brief: clean, updatedAt: new Date() }).where(eq(eventVendorSlots.id, vendorSlotId)));
}

// PRE-09 — consultations d'une fiche du carnet (jamais les essais).
export async function listConsultations(organizationId: string, vendorId: string, namesOf: (eventIds: string[]) => Promise<Record<string, string>>): Promise<VendorConsultation[]> {
  if (!UUID.test(vendorId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({
        eventId: events.id,
        eventDate: events.eventDate,
        slotId: eventVendorSlots.id,
        slotLabel: eventVendorSlots.label,
        selectedCandidateId: eventVendorSlots.selectedCandidateId,
        candidateId: eventVendorCandidates.id,
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
    outcome: row.selectedCandidateId === null ? "pending" : row.selectedCandidateId === row.candidateId ? "selected" : "not_selected",
    quotedCents: row.quotedCents,
  }));
}

// « Déjà travaillé avec » : fiches retenues au moins une fois, hors essais.
export async function listSelectedVendors(organizationId: string): Promise<string[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .selectDistinct({ vendorId: eventVendorCandidates.vendorId })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.selectedCandidateId, eventVendorCandidates.id))
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(and(isNotNull(eventVendorCandidates.vendorId), eq(events.isDemo, false)));
    return rows.map((row) => row.vendorId).filter((id): id is string => id !== null);
  });
}

// EVT-11 — ce que voient les clients : consultés montrés, notes « Clients ».
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

// Lot 12 (EVT-16) — fiche du carnet dont le RIB est partagé aux clients de
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
