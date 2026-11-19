// Lot 29b (JRJ-04, décision D8 ; ADR 0064) — documents de l'événement (plan de
// table, plans, plan B) et choix des documents embarqués pour le jour J. Accès aux
// données et règles du module events ; exposé seulement par service.ts (ADR 0011).
// Un fichier est contrôlé à l'envoi par @symbola/files (type par le contenu,
// antivirus, stockage privé) et servi par l'app après contrôle des droits (ADR 0027).
// Lot 37a (DOC-01, DOC-04, POR-10 ; D3, D4, D6, D7 ; ADR 0070) : dossiers (un niveau), versions
// (une nouvelle version garde les précédentes ; la dernière est recopiée sur le document), partage
// avec les clients et les prestataires (rien par défaut), liens de partage à durée limitée.
import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { inTrash, markDeleted } from "@symbola/db/soft-delete";
import { appDatabase } from "@symbola/db/client";
import {
  eventActivities,
  eventDayDocuments,
  eventDocumentFolders,
  eventDocumentLinks,
  eventDocuments,
  eventDocumentVersions,
  events,
  eventTaskAttachments,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import {
  DAY_DOCUMENT_SOURCES,
  type AttachEventDocumentInput,
  type CreateEventDocumentLinkInput,
  type DayDocumentChoice,
  type DayDocumentSource,
  type EventDocument,
  type EventDocumentFolder,
  type EventDocumentShareLink,
  type EventDocumentVersion,
  type FileDownload,
  type SetDayDocumentEmbeddedInput,
} from "@symbola/contracts";
import { formatLinkToken, hashLinkSecret, newLinkSecret, parseLinkToken } from "./link-tokens";
import { organizationLinksClosed } from "./closed-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type DocumentRow = typeof eventDocuments.$inferSelect;

export const EVENT_DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;
export const EVENT_DOCUMENT_LABEL_MAX = 200;
export const EVENT_DOCUMENT_FOLDER_NAME_MAX = 80;
// D7 : un lien de partage vit de 1 à 30 jours.
export const DOCUMENT_LINK_MIN_DAYS = 1;
export const DOCUMENT_LINK_MAX_DAYS = 30;
const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EventDocumentNotFoundError extends Error {
  constructor() {
    super("document de l'événement introuvable");
    this.name = "EventDocumentNotFoundError";
  }
}

export class EventDocumentRejectedError extends Error {
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected" | "label" | "folder" | "duration") {
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

async function currentVersions(tx: Tx, documentIds: string[]): Promise<Map<string, number>> {
  if (documentIds.length === 0) return new Map();
  const rows = await tx
    .select({ documentId: eventDocumentVersions.documentId, version: max(eventDocumentVersions.version) })
    .from(eventDocumentVersions)
    .where(inArray(eventDocumentVersions.documentId, documentIds))
    .groupBy(eventDocumentVersions.documentId);
  return new Map(rows.map((row) => [row.documentId, row.version ?? 1]));
}

function toEventDocument(row: DocumentRow, version: number): EventDocument {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    folderId: row.folderId,
    version,
    sharedWithClients: row.sharedWithClients,
    sharedWithVendors: row.sharedWithVendors,
  };
}

async function withVersions(tx: Tx, rows: DocumentRow[]): Promise<EventDocument[]> {
  const versions = await currentVersions(tx, rows.map((row) => row.id));
  return rows.map((row) => toEventDocument(row, versions.get(row.id) ?? 1));
}

// Intitulé : texte d'une ligne, 1 à 200 caractères.
export function documentLabel(raw: string): string {
  const label = raw.replace(/\s+/g, " ").trim();
  if (label.length === 0 || label.length > EVENT_DOCUMENT_LABEL_MAX) throw new EventDocumentRejectedError("label");
  return label;
}

function folderName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > EVENT_DOCUMENT_FOLDER_NAME_MAX) throw new EventDocumentRejectedError("folder");
  return name;
}

export function isDayDocumentSource(value: string): value is DayDocumentSource {
  return (DAY_DOCUMENT_SOURCES as readonly string[]).includes(value);
}

export async function listDocuments(organizationId: string, eventId: string): Promise<EventDocument[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, async (tx) =>
    withVersions(tx, await tx.select().from(eventDocuments).where(eq(eventDocuments.eventId, eventId)).orderBy(asc(eventDocuments.createdAt))),
  );
}

// D6 (POR-10) : les documents partagés avec les clients, ou avec les prestataires, d'un évènement.
export async function listSharedDocuments(organizationId: string, eventId: string, audience: "client" | "vendor"): Promise<EventDocument[]> {
  if (!UUID.test(eventId)) return [];
  const shared = audience === "client" ? eventDocuments.sharedWithClients : eventDocuments.sharedWithVendors;
  return inOrganization(organizationId, async (tx) =>
    withVersions(tx, await tx.select().from(eventDocuments).where(and(eq(eventDocuments.eventId, eventId), eq(shared, true))).orderBy(asc(eventDocuments.createdAt))),
  );
}

async function folderOfEvent(tx: Tx, eventId: string, folderId: string | null | undefined): Promise<string | null> {
  if (!folderId) return null;
  if (!UUID.test(folderId)) throw new EventDocumentRejectedError("folder");
  const [folder] = await tx.select({ id: eventDocumentFolders.id }).from(eventDocumentFolders).where(and(eq(eventDocumentFolders.id, folderId), eq(eventDocumentFolders.eventId, eventId)));
  if (!folder) throw new EventDocumentRejectedError("folder");
  return folder.id;
}

// Le fichier est contrôlé et rangé avant la ligne : un refus n'enregistre rien. Le document naît
// avec sa version 1.
export async function attachDocument(input: AttachEventDocumentInput): Promise<EventDocument | null> {
  const label = documentLabel(input.label);
  if (!UUID.test(input.eventId)) return null;
  const exists = await inOrganization(input.organizationId, async (tx) => (await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId))).length > 0);
  if (!exists) return null;
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: EVENT_DOCUMENT_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new EventDocumentRejectedError(upload.reason);
  try {
    return await inOrganization(input.organizationId, async (tx) => {
      const folderId = await folderOfEvent(tx, input.eventId, input.folderId);
      const [row] = await tx
        .insert(eventDocuments)
        .values({
          organizationId: input.organizationId,
          eventId: input.eventId,
          label,
          fileKey: upload.key,
          mime: upload.mime,
          sizeBytes: upload.size,
          uploadedByUserId: input.uploadedByUserId,
          folderId,
        })
        .returning();
      await tx.insert(eventDocumentVersions).values({
        organizationId: input.organizationId,
        documentId: row!.id,
        version: 1,
        fileKey: upload.key,
        mime: upload.mime,
        sizeBytes: upload.size,
        uploadedByUserId: input.uploadedByUserId,
      });
      return toEventDocument(row!, 1);
    });
  } catch (error) {
    // Ligne refusée : le fichier rangé ne reste pas orphelin.
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw error;
  }
}

// D4 : une nouvelle version garde les précédentes ; elle devient le fichier du document (aperçu,
// partage, jour J suivent la dernière).
export async function addDocumentVersion(input: { organizationId: string; documentId: string; content: Uint8Array; uploadedByUserId: string }): Promise<EventDocument> {
  if (!UUID.test(input.documentId)) throw new EventDocumentNotFoundError();
  const known = await inOrganization(input.organizationId, async (tx) => (await tx.select({ id: eventDocuments.id }).from(eventDocuments).where(eq(eventDocuments.id, input.documentId))).length > 0);
  if (!known) throw new EventDocumentNotFoundError();
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: EVENT_DOCUMENT_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new EventDocumentRejectedError(upload.reason);
  try {
    return await inOrganization(input.organizationId, async (tx) => {
      // Verrou sur le document : deux versions déposées en même temps reçoivent deux numéros.
      const [locked] = await tx.select().from(eventDocuments).where(eq(eventDocuments.id, input.documentId)).for("update");
      if (!locked) throw new EventDocumentNotFoundError();
      const next = ((await currentVersions(tx, [locked.id])).get(locked.id) ?? 0) + 1;
      await tx.insert(eventDocumentVersions).values({
        organizationId: input.organizationId,
        documentId: locked.id,
        version: next,
        fileKey: upload.key,
        mime: upload.mime,
        sizeBytes: upload.size,
        uploadedByUserId: input.uploadedByUserId,
      });
      const [row] = await tx
        .update(eventDocuments)
        .set({ fileKey: upload.key, mime: upload.mime, sizeBytes: upload.size, updatedAt: new Date() })
        .where(eq(eventDocuments.id, locked.id))
        .returning();
      return toEventDocument(row!, next);
    });
  } catch (error) {
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw error;
  }
}

export async function listDocumentVersions(organizationId: string, documentId: string): Promise<EventDocumentVersion[]> {
  if (!UUID.test(documentId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(eventDocumentVersions).where(eq(eventDocumentVersions.documentId, documentId)).orderBy(desc(eventDocumentVersions.version)),
  );
  return rows.map((row) => ({ id: row.id, documentId: row.documentId, version: row.version, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() }));
}

export async function renameDocument(organizationId: string, documentId: string, rawLabel: string): Promise<void> {
  const label = documentLabel(rawLabel);
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const updated = await inOrganization(organizationId, (tx) => tx.update(eventDocuments).set({ label, updatedAt: new Date() }).where(eq(eventDocuments.id, documentId)).returning());
  if (updated.length === 0) throw new EventDocumentNotFoundError();
}

// D3 : ranger un document dans un dossier de son évènement, ou dans « Divers » (null).
export async function moveDocument(organizationId: string, documentId: string, folderId: string | null): Promise<void> {
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select({ eventId: eventDocuments.eventId }).from(eventDocuments).where(eq(eventDocuments.id, documentId));
    if (!row) throw new EventDocumentNotFoundError();
    const target = await folderOfEvent(tx, row.eventId, folderId);
    await tx.update(eventDocuments).set({ folderId: target, updatedAt: new Date() }).where(eq(eventDocuments.id, documentId));
  });
}

// D6 (POR-10) : partager, ou ne plus partager, avec les clients et les prestataires de l'évènement.
export async function setDocumentSharing(organizationId: string, documentId: string, sharing: { clients: boolean; vendors: boolean }): Promise<void> {
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const updated = await inOrganization(organizationId, (tx) =>
    tx
      .update(eventDocuments)
      .set({ sharedWithClients: sharing.clients, sharedWithVendors: sharing.vendors, updatedAt: new Date() })
      .where(eq(eventDocuments.id, documentId))
      .returning({ id: eventDocuments.id }),
  );
  if (updated.length === 0) throw new EventDocumentNotFoundError();
}

// Lot 39a (HUB-17, DAT-03 ; ADR 0073) : le document va à la corbeille avec ses versions, ses liens de
// partage et son choix pour le jour J (cachés avec lui) ; la purge efface lignes et fichiers.
export async function removeDocument(organizationId: string, documentId: string): Promise<void> {
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const rows = await inTrash(organizationId, (tx) =>
    tx.update(eventDocuments).set(markDeleted()).where(and(eq(eventDocuments.id, documentId), isNull(eventDocuments.deletedAt))).returning({ id: eventDocuments.id }),
  );
  if (rows.length === 0) throw new EventDocumentNotFoundError();
}

// Purge réelle (corbeille échue, suppression définitive, effacement RGPD) : la ligne et son choix pour
// le jour J d'abord, les fichiers de toutes ses versions ensuite (supprimer un fichier absent ne fait rien).
export async function purgeDocuments(organizationId: string, documentIds: string[]): Promise<number> {
  if (documentIds.length === 0) return 0;
  const fileKeys = await inTrash(organizationId, async (tx) => {
    const versions = await tx.select({ key: eventDocumentVersions.fileKey }).from(eventDocumentVersions).where(inArray(eventDocumentVersions.documentId, documentIds));
    const deleted = await tx.delete(eventDocuments).where(inArray(eventDocuments.id, documentIds)).returning({ fileKey: eventDocuments.fileKey });
    await tx.delete(eventDayDocuments).where(and(eq(eventDayDocuments.source, "event_document"), inArray(eventDayDocuments.sourceId, documentIds)));
    return [...new Set([...deleted.map((row) => row.fileKey), ...versions.map((version) => version.key)])];
  });
  const storage = createStorageClient();
  for (const key of fileKeys) await deletePrivateObject(storage, key).catch(() => undefined);
  return fileKeys.length;
}

function fileNameOf(label: string, fileKey: string, version?: number): string {
  const extension = fileKey.split(".").pop() ?? "bin";
  const safeName = label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
  return version ? `${safeName}-v${version}.${extension}` : `${safeName}.${extension}`;
}

async function readFile(fileKey: string, mime: string, fileName: string): Promise<FileDownload> {
  try {
    const { data } = await readPrivateObject(createStorageClient(), fileKey);
    return { data, contentType: mime, fileName };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new EventDocumentNotFoundError();
    throw error;
  }
}

export async function getDocumentFile(organizationId: string, documentId: string): Promise<FileDownload> {
  if (!UUID.test(documentId)) throw new EventDocumentNotFoundError();
  const row = await inOrganization(organizationId, async (tx) => (await tx.select().from(eventDocuments).where(eq(eventDocuments.id, documentId)))[0]);
  if (!row) throw new EventDocumentNotFoundError();
  return readFile(row.fileKey, row.mime, fileNameOf(row.label, row.fileKey));
}

// D4 : une version précédente, consultable.
export async function getDocumentVersionFile(organizationId: string, documentId: string, version: number): Promise<FileDownload> {
  if (!UUID.test(documentId) || !Number.isInteger(version) || version < 1) throw new EventDocumentNotFoundError();
  const found = await inOrganization(organizationId, async (tx) => {
    const [document] = await tx.select({ label: eventDocuments.label }).from(eventDocuments).where(eq(eventDocuments.id, documentId));
    const [row] = await tx.select().from(eventDocumentVersions).where(and(eq(eventDocumentVersions.documentId, documentId), eq(eventDocumentVersions.version, version)));
    return document && row ? { label: document.label, row } : null;
  });
  if (!found) throw new EventDocumentNotFoundError();
  return readFile(found.row.fileKey, found.row.mime, fileNameOf(found.label, found.row.fileKey, version));
}

// D6 : le fichier d'un document partagé avec ce public, pour le portail ou l'espace prestataire ;
// un document non partagé répond comme un document absent.
export async function getSharedDocumentFile(organizationId: string, input: { eventId: string; documentId: string; audience: "client" | "vendor" }): Promise<FileDownload> {
  if (!UUID.test(input.documentId) || !UUID.test(input.eventId)) throw new EventDocumentNotFoundError();
  const shared = input.audience === "client" ? eventDocuments.sharedWithClients : eventDocuments.sharedWithVendors;
  const row = await inOrganization(organizationId, async (tx) =>
    (await tx.select().from(eventDocuments).where(and(eq(eventDocuments.id, input.documentId), eq(eventDocuments.eventId, input.eventId), eq(shared, true))))[0],
  );
  if (!row) throw new EventDocumentNotFoundError();
  return readFile(row.fileKey, row.mime, fileNameOf(row.label, row.fileKey));
}

// —— Dossiers (D3) ————————————————————————————————————————————————————————————

export async function listDocumentFolders(organizationId: string, eventId: string): Promise<EventDocumentFolder[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(eventDocumentFolders).where(eq(eventDocumentFolders.eventId, eventId)).orderBy(asc(sql`lower(${eventDocumentFolders.name})`)),
  );
  return rows.map((row) => ({ id: row.id, eventId: row.eventId, name: row.name }));
}

export async function createDocumentFolder(organizationId: string, eventId: string, rawName: string): Promise<EventDocumentFolder | null> {
  const name = folderName(rawName);
  if (!UUID.test(eventId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) return null;
    const [row] = await tx.insert(eventDocumentFolders).values({ organizationId, eventId, name }).returning();
    return { id: row!.id, eventId: row!.eventId, name: row!.name };
  });
}

export async function renameDocumentFolder(organizationId: string, folderId: string, rawName: string): Promise<void> {
  const name = folderName(rawName);
  if (!UUID.test(folderId)) throw new EventDocumentRejectedError("folder");
  const updated = await inOrganization(organizationId, (tx) =>
    tx.update(eventDocumentFolders).set({ name, updatedAt: new Date() }).where(eq(eventDocumentFolders.id, folderId)).returning({ id: eventDocumentFolders.id }),
  );
  if (updated.length === 0) throw new EventDocumentRejectedError("folder");
}

// Retirer un dossier range ses documents dans « Divers » (aucun document n'est supprimé).
export async function removeDocumentFolder(organizationId: string, folderId: string): Promise<void> {
  if (!UUID.test(folderId)) throw new EventDocumentRejectedError("folder");
  const removed = await inOrganization(organizationId, (tx) => tx.delete(eventDocumentFolders).where(eq(eventDocumentFolders.id, folderId)).returning({ id: eventDocumentFolders.id }));
  if (removed.length === 0) throw new EventDocumentRejectedError("folder");
}

// —— Liens de partage à durée limitée (DOC-04, D7) ———————————————————————————————

function toShareLink(row: typeof eventDocumentLinks.$inferSelect): EventDocumentShareLink {
  return {
    id: row.id,
    documentId: row.documentId,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    openCount: row.openCount,
    lastOpenedAt: row.lastOpenedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Le jeton n'est rendu qu'ici ; seule son empreinte est gardée (SEC-14).
export async function createDocumentLink(input: CreateEventDocumentLinkInput): Promise<{ link: EventDocumentShareLink; token: string }> {
  if (!Number.isInteger(input.days) || input.days < DOCUMENT_LINK_MIN_DAYS || input.days > DOCUMENT_LINK_MAX_DAYS) throw new EventDocumentRejectedError("duration");
  if (!UUID.test(input.documentId)) throw new EventDocumentNotFoundError();
  const now = input.now ?? new Date();
  const secret = newLinkSecret();
  const row = await inOrganization(input.organizationId, async (tx) => {
    const [document] = await tx.select({ id: eventDocuments.id, eventId: eventDocuments.eventId }).from(eventDocuments).where(eq(eventDocuments.id, input.documentId));
    if (!document) return null;
    const [created] = await tx
      .insert(eventDocumentLinks)
      .values({
        organizationId: input.organizationId,
        eventId: document.eventId,
        documentId: document.id,
        tokenHash: hashLinkSecret(secret),
        expiresAt: new Date(now.getTime() + input.days * DAY_MS),
        createdByUserId: input.createdByUserId,
        createdAt: now,
      })
      .returning();
    return created!;
  });
  if (!row) throw new EventDocumentNotFoundError();
  return { link: toShareLink(row), token: formatLinkToken(input.organizationId, secret) };
}

export async function listDocumentLinks(organizationId: string, documentId: string): Promise<EventDocumentShareLink[]> {
  if (!UUID.test(documentId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(eventDocumentLinks).where(eq(eventDocumentLinks.documentId, documentId)).orderBy(desc(eventDocumentLinks.createdAt)),
  );
  return rows.map(toShareLink);
}

// Tous les liens de partage des documents d'un évènement, pour l'onglet « Documents ».
export async function listEventDocumentLinkRows(organizationId: string, eventId: string): Promise<EventDocumentShareLink[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(eventDocumentLinks).where(eq(eventDocumentLinks.eventId, eventId)).orderBy(desc(eventDocumentLinks.createdAt)),
  );
  return rows.map(toShareLink);
}

// Toutes les versions des documents d'un évènement, les plus récentes d'abord.
export async function listEventDocumentVersionRows(organizationId: string, eventId: string): Promise<EventDocumentVersion[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ version: eventDocumentVersions })
      .from(eventDocumentVersions)
      .innerJoin(eventDocuments, eq(eventDocuments.id, eventDocumentVersions.documentId))
      .where(eq(eventDocuments.eventId, eventId))
      .orderBy(desc(eventDocumentVersions.version)),
  );
  return rows.map(({ version: row }) => ({ id: row.id, documentId: row.documentId, version: row.version, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() }));
}

export async function revokeDocumentLink(organizationId: string, linkId: string, now: Date = new Date()): Promise<void> {
  if (!UUID.test(linkId)) throw new EventDocumentNotFoundError();
  const updated = await inOrganization(organizationId, (tx) =>
    tx.update(eventDocumentLinks).set({ revokedAt: now }).where(and(eq(eventDocumentLinks.id, linkId), sql`${eventDocumentLinks.revokedAt} is null`)).returning({ id: eventDocumentLinks.id }),
  );
  if (updated.length === 0) throw new EventDocumentNotFoundError();
}

// Ce que la page d'un lien de partage montre avant l'ouverture : l'intitulé et le type du document,
// s'il est encore valable ; sinon null, comme un lien inconnu. Rien n'est compté ni journalisé :
// l'ouverture, c'est le fichier servi (openDocumentLink).
export async function peekDocumentLink(token: string, now: Date = new Date()): Promise<{ label: string; mime: string; sizeBytes: number } | null> {
  const parsed = parseLinkToken(token);
  if (!parsed || (await organizationLinksClosed(parsed.organizationId))) return null;
  return inOrganization(parsed.organizationId, async (tx) => {
    const [link] = await tx.select().from(eventDocumentLinks).where(eq(eventDocumentLinks.tokenHash, hashLinkSecret(parsed.secret)));
    if (!link || link.revokedAt || link.expiresAt.getTime() <= now.getTime()) return null;
    const [document] = await tx.select({ label: eventDocuments.label, mime: eventDocuments.mime, sizeBytes: eventDocuments.sizeBytes }).from(eventDocuments).where(eq(eventDocuments.id, link.documentId));
    return document ?? null;
  });
}

// Ouvrir un lien de partage : le document, s'il est encore valable. Inconnu, expiré ou révoqué : null,
// sans rien révéler (DOC-04). Chaque ouverture est comptée et va au fil de l'évènement.
export async function openDocumentLink(token: string, now: Date = new Date()): Promise<{ label: string; mime: string; sizeBytes: number; file: () => Promise<FileDownload> } | null> {
  const parsed = parseLinkToken(token);
  if (!parsed || (await organizationLinksClosed(parsed.organizationId))) return null;
  const found = await inOrganization(parsed.organizationId, async (tx) => {
    const [link] = await tx.select().from(eventDocumentLinks).where(eq(eventDocumentLinks.tokenHash, hashLinkSecret(parsed.secret)));
    if (!link || link.revokedAt || link.expiresAt.getTime() <= now.getTime()) return null;
    const [document] = await tx.select().from(eventDocuments).where(eq(eventDocuments.id, link.documentId));
    if (!document) return null;
    await tx.update(eventDocumentLinks).set({ openCount: sql`${eventDocumentLinks.openCount} + 1`, lastOpenedAt: now }).where(eq(eventDocumentLinks.id, link.id));
    await tx.insert(eventActivities).values({ organizationId: parsed.organizationId, eventId: link.eventId, kind: "document_link_opened", taskLabel: document.label, createdAt: now });
    return document;
  });
  if (!found) return null;
  return { label: found.label, mime: found.mime, sizeBytes: found.sizeBytes, file: () => readFile(found.fileKey, found.mime, fileNameOf(found.label, found.fileKey)) };
}

export async function listDayChoices(organizationId: string, eventId: string): Promise<DayDocumentChoice[]> {
  if (!UUID.test(eventId)) return [];
  const { rows, visibleDocuments } = await inOrganization(organizationId, async (tx) => ({
    rows: await tx
      .select({ source: eventDayDocuments.source, sourceId: eventDayDocuments.sourceId })
      .from(eventDayDocuments)
      .where(eq(eventDayDocuments.eventId, eventId))
      .orderBy(asc(eventDayDocuments.createdAt)),
    visibleDocuments: new Set((await tx.select({ id: eventDocuments.id }).from(eventDocuments).where(eq(eventDocuments.eventId, eventId))).map((row) => row.id)),
  }));
  // Lot 39a (ADR 0073) : le choix d'un document à la corbeille est caché avec lui, et revient avec lui.
  return rows
    .filter((row): row is DayDocumentChoice => isDayDocumentSource(row.source))
    .filter((row) => row.source !== "event_document" || visibleDocuments.has(row.sourceId));
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

// Fichiers des documents d'événements (toutes leurs versions, lot 37a) et, lot 34b (CHR-02), des
// pièces jointes de leurs tâches (purge des essais, RGPD).
export async function documentKeys(organizationId: string, eventIds: string[], options: { demoOnly?: boolean } = {}): Promise<string[]> {
  if (eventIds.length === 0) return [];
  return inOrganization(organizationId, async (tx) => {
    const demo = options.demoOnly ? [eq(events.isDemo, true)] : [];
    const documents = await tx
      .select({ key: eventDocuments.fileKey })
      .from(eventDocuments)
      .innerJoin(events, eq(events.id, eventDocuments.eventId))
      .where(and(inArray(eventDocuments.eventId, eventIds), ...demo));
    const versions = await tx
      .select({ key: eventDocumentVersions.fileKey })
      .from(eventDocumentVersions)
      .innerJoin(eventDocuments, eq(eventDocuments.id, eventDocumentVersions.documentId))
      .innerJoin(events, eq(events.id, eventDocuments.eventId))
      .where(and(inArray(eventDocuments.eventId, eventIds), ...demo));
    const attachments = await tx
      .select({ key: eventTaskAttachments.fileKey })
      .from(eventTaskAttachments)
      .innerJoin(events, eq(events.id, eventTaskAttachments.eventId))
      .where(and(inArray(eventTaskAttachments.eventId, eventIds), ...demo));
    return [...new Set([...documents, ...versions, ...attachments].map((row) => row.key))];
  });
}
