// Lot 29b (JRJ-04, décision D8 ; ADR 0064) — documents de l'événement (plan de
// table, plans, plan B) et choix des documents embarqués pour le jour J. Accès aux
// données et règles du module events ; exposé seulement par service.ts (ADR 0011).
// Un fichier est contrôlé à l'envoi par @symbola/files (type par le contenu,
// antivirus, stockage privé) et servi par l'app après contrôle des droits (ADR 0027).
import { and, asc, eq, inArray } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventDayDocuments, eventDocuments, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import {
  DAY_DOCUMENT_SOURCES,
  type AttachEventDocumentInput,
  type DayDocumentChoice,
  type DayDocumentSource,
  type EventDocument,
  type FileDownload,
  type SetDayDocumentEmbeddedInput,
} from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type DocumentRow = typeof eventDocuments.$inferSelect;

export const EVENT_DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;
export const EVENT_DOCUMENT_LABEL_MAX = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EventDocumentNotFoundError extends Error {
  constructor() {
    super("document de l'événement introuvable");
    this.name = "EventDocumentNotFoundError";
  }
}

export class EventDocumentRejectedError extends Error {
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected" | "label") {
    super(`document refusé : ${reason}`);
    this.name = "EventDocumentRejectedError";
  }
}

export class DayDocumentSourceError extends Error {
  constructor() {
    super("document embarqué inconnu");
    this.name = "DayDocumentSourceError";
  }
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

function toEventDocument(row: DocumentRow): EventDocument {
  return { id: row.id, eventId: row.eventId, label: row.label, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
}

// Intitulé : texte d'une ligne, 1 à 200 caractères.
export function documentLabel(raw: string): string {
  const label = raw.replace(/\s+/g, " ").trim();
  if (label.length === 0 || label.length > EVENT_DOCUMENT_LABEL_MAX) throw new EventDocumentRejectedError("label");
  return label;
}

export function isDayDocumentSource(value: string): value is DayDocumentSource {
  return (DAY_DOCUMENT_SOURCES as readonly string[]).includes(value);
}

export async function listDocuments(organizationId: string, eventId: string): Promise<EventDocument[]> {
  if (!UUID.test(eventId)) return [];
  return (await inOrganization(organizationId, (tx) => tx.select().from(eventDocuments).where(eq(eventDocuments.eventId, eventId)).orderBy(asc(eventDocuments.createdAt)))).map(
    toEventDocument,
  );
}

// Le fichier est contrôlé et rangé avant la ligne : un refus n'enregistre rien.
export async function attachDocument(input: AttachEventDocumentInput): Promise<EventDocument | null> {
  const label = documentLabel(input.label);
  if (!UUID.test(input.eventId)) return null;
  const exists = await inOrganization(input.organizationId, async (tx) => (await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId))).length > 0);
  if (!exists) return null;
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: EVENT_DOCUMENT_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new EventDocumentRejectedError(upload.reason);
  try {
    const [row] = await inOrganization(input.organizationId, (tx) =>
      tx
        .insert(eventDocuments)
        .values({
          organizationId: input.organizationId,
          eventId: input.eventId,
          label,
          fileKey: upload.key,
          mime: upload.mime,
          sizeBytes: upload.size,
          uploadedByUserId: input.uploadedByUserId,
        })
        .returning(),
    );
    return toEventDocument(row!);
  } catch (error) {
    // Ligne refusée : le fichier rangé ne reste pas orphelin.
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw error;
  }
}

export async function renameDocument(organizationId: string, documentId: string, rawLabel: string): Promise<void> {
  const label = documentLabel(rawLabel);
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const updated = await inOrganization(organizationId, (tx) => tx.update(eventDocuments).set({ label, updatedAt: new Date() }).where(eq(eventDocuments.id, documentId)).returning());
  if (updated.length === 0) throw new EventDocumentNotFoundError();
}

// La ligne et son choix pour le jour J d'abord, le fichier ensuite (supprimer un
// fichier absent ne fait rien).
export async function removeDocument(organizationId: string, documentId: string): Promise<void> {
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const fileKey = await inOrganization(organizationId, async (tx) => {
    const [row] = await tx.delete(eventDocuments).where(eq(eventDocuments.id, documentId)).returning();
    if (!row) return null;
    await tx.delete(eventDayDocuments).where(and(eq(eventDayDocuments.source, "event_document"), eq(eventDayDocuments.sourceId, documentId)));
    return row.fileKey;
  });
  if (!fileKey) throw new EventDocumentNotFoundError();
  await deletePrivateObject(createStorageClient(), fileKey).catch(() => undefined);
}

export async function getDocumentFile(organizationId: string, documentId: string): Promise<FileDownload> {
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const row = await inOrganization(organizationId, async (tx) => (await tx.select().from(eventDocuments).where(eq(eventDocuments.id, documentId)))[0]);
  if (!row) throw new EventDocumentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), row.fileKey);
    const extension = row.fileKey.split(".").pop() ?? "bin";
    const safeName = row.label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
    return { data, contentType: row.mime, fileName: `${safeName}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new EventDocumentNotFoundError();
    throw error;
  }
}

export async function listDayChoices(organizationId: string, eventId: string): Promise<DayDocumentChoice[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select({ source: eventDayDocuments.source, sourceId: eventDayDocuments.sourceId }).from(eventDayDocuments).where(eq(eventDayDocuments.eventId, eventId)).orderBy(asc(eventDayDocuments.createdAt)),
  );
  return rows.filter((row): row is DayDocumentChoice => isDayDocumentSource(row.source));
}

// Embarquer ou non une pièce pour le jour J. L'appartenance de la pièce à
// l'événement est vérifiée par l'appelant, auprès du module qui la détient
// (app/jour-j/[eventId]/day-documents.ts) ; ici, l'événement et la source.
export async function setDayChoice(input: SetDayDocumentEmbeddedInput): Promise<void> {
  if (!isDayDocumentSource(input.source) || !UUID.test(input.sourceId) || !UUID.test(input.eventId)) throw new DayDocumentSourceError();
  await inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
    if (!event) throw new DayDocumentSourceError();
    const where = and(eq(eventDayDocuments.eventId, input.eventId), eq(eventDayDocuments.source, input.source), eq(eventDayDocuments.sourceId, input.sourceId));
    if (!input.embedded) {
      await tx.delete(eventDayDocuments).where(where);
      return;
    }
    await tx
      .insert(eventDayDocuments)
      .values({ organizationId: input.organizationId, eventId: input.eventId, source: input.source, sourceId: input.sourceId })
      .onConflictDoNothing();
  });
}

// Fichiers des documents d'événements (purge des essais, RGPD).
export async function documentKeys(organizationId: string, eventIds: string[], options: { demoOnly?: boolean } = {}): Promise<string[]> {
  if (eventIds.length === 0) return [];
  return inOrganization(organizationId, async (tx) =>
    (
      await tx
        .select({ key: eventDocuments.fileKey })
        .from(eventDocuments)
        .innerJoin(events, eq(events.id, eventDocuments.eventId))
        .where(and(inArray(eventDocuments.eventId, eventIds), ...(options.demoOnly ? [eq(events.isDemo, true)] : [])))
    ).map((row) => row.key),
  );
}
