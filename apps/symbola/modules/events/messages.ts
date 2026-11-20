// Lot 55 (MSG-03, POR-06 ; D3 ; ADR 0102) — sujets de discussion d'un évènement et leurs fils : accès à
// la base du module. Les contrôles d'accès (équipe, lien, rubrique, prestataire du sujet) sont dans
// service.ts, qui seul expose ces fonctions (ADR 0011).
//
// Garde de MSG-03 : un message interne n'a aucun chemin vers l'extérieur.
// - Il n'est écrit que par l'équipe (contrainte messages_internal_team_check) et sa visibilité ne
//   change jamais (le rôle applicatif n'a pas UPDATE sur events.messages).
// - Toute lecture pour un lien passe par sharedOnly : la requête elle-même ne prend que les messages
//   partagés ; une pièce jointe d'un message interne répond comme absente.
// Pièces jointes : contrôlées à l'envoi par @symbola/files (type par le contenu, taille, antivirus,
// stockage privé) et servies par l'app après contrôle des droits (ADR 0027).
import { and, asc, count, desc, eq, inArray, max, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { messageAttachments, messages, messageTopicLinks, messageTopics } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import { MESSAGE_ATTACHMENTS_MAX, MESSAGE_BODY_MAX, MESSAGE_TOPIC_NAME_MAX, type FileDownload, type LinkMessageTopic, type MessageAttachmentView, type MessageFileInput, type MessageTopicSummary, type MessageView, type MessageVisibility } from "@symbola/contracts";
import { documentLabel, EVENT_DOCUMENT_MAX_SIZE_BYTES, EventDocumentRejectedError } from "./documents";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MessageNotFoundError extends Error {
  constructor() {
    super("sujet ou message introuvable");
    this.name = "MessageNotFoundError";
  }
}

export class MessageInputError extends Error {
  constructor(readonly reason: "name" | "body" | "files" | "recipients_changed" | "no_recipients") {
    super("message refusé");
    this.name = "MessageInputError";
  }
}

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export function isMessageId(value: string): boolean {
  return UUID.test(value);
}

// Nom d'un sujet : 1 à 120 caractères, espaces resserrés.
export function topicName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > MESSAGE_TOPIC_NAME_MAX) throw new MessageInputError("name");
  return name;
}

// Texte d'un message : 1 à 5 000 caractères, retours à la ligne gardés.
export function messageBody(raw: string): string {
  const body = raw.replace(/\r\n/g, "\n").trim();
  if (body.length === 0 || body.length > MESSAGE_BODY_MAX) throw new MessageInputError("body");
  return body;
}

// Un champ de fichier vide (aucun fichier choisi) n'est pas une pièce jointe.
export function messageFiles(files: MessageFileInput[]): MessageFileInput[] {
  const kept = files.filter((file) => file.content.byteLength > 0);
  if (kept.length > MESSAGE_ATTACHMENTS_MAX) throw new MessageInputError("files");
  return kept;
}

// --- Sujets ---

export type TopicRow = { id: string; eventId: string; name: string; vendorLinkIds: string[] };

async function vendorLinksOf(tx: Tx, topicIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (topicIds.length === 0) return map;
  const rows = await tx.select({ topicId: messageTopicLinks.topicId, linkId: messageTopicLinks.linkId }).from(messageTopicLinks).where(inArray(messageTopicLinks.topicId, topicIds));
  for (const row of rows) map.set(row.topicId, [...(map.get(row.topicId) ?? []), row.linkId]);
  return map;
}

export async function findTopic(organizationId: string, topicId: string): Promise<TopicRow | null> {
  if (!UUID.test(topicId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select({ id: messageTopics.id, eventId: messageTopics.eventId, name: messageTopics.name }).from(messageTopics).where(eq(messageTopics.id, topicId));
    if (!row) return null;
    return { ...row, vendorLinkIds: (await vendorLinksOf(tx, [row.id])).get(row.id) ?? [] };
  });
}

// Les sujets d'un évènement, pour l'équipe : tous les messages comptés.
export async function listTopics(organizationId: string, eventId: string): Promise<MessageTopicSummary[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, async (tx) => {
    const topics = await tx.select().from(messageTopics).where(eq(messageTopics.eventId, eventId)).orderBy(desc(messageTopics.updatedAt));
    const stats = await tx
      .select({ topicId: messages.topicId, count: count(), last: max(messages.createdAt) })
      .from(messages)
      .where(eq(messages.eventId, eventId))
      .groupBy(messages.topicId);
    const byTopic = new Map(stats.map((stat) => [stat.topicId, stat]));
    const vendors = await vendorLinksOf(tx, topics.map((topic) => topic.id));
    return topics
      .map((topic) => ({
        id: topic.id,
        eventId: topic.eventId,
        name: topic.name,
        vendorLinkIds: vendors.get(topic.id) ?? [],
        messageCount: byTopic.get(topic.id)?.count ?? 0,
        lastMessageAt: byTopic.get(topic.id)?.last?.toISOString() ?? null,
        createdAt: topic.createdAt.toISOString(),
      }))
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
  });
}

// Les sujets qu'un lien voit : ceux qui ont au moins un message partagé (un sujet de notes internes
// reste invisible, son nom compris) ; pour un prestataire, seulement ceux où la planner l'a ajouté.
export async function listLinkTopics(organizationId: string, eventId: string, vendorLinkId: string | null): Promise<LinkMessageTopic[]> {
  return inOrganization(organizationId, async (tx) => {
    const stats = await tx
      .select({ topicId: messages.topicId, count: count(), last: max(messages.createdAt) })
      .from(messages)
      .where(and(eq(messages.eventId, eventId), eq(messages.visibility, "shared")))
      .groupBy(messages.topicId);
    if (stats.length === 0) return [];
    let topicIds = stats.map((stat) => stat.topicId);
    if (vendorLinkId) {
      const allowed = await tx.select({ topicId: messageTopicLinks.topicId }).from(messageTopicLinks).where(and(eq(messageTopicLinks.linkId, vendorLinkId), inArray(messageTopicLinks.topicId, topicIds)));
      const set = new Set(allowed.map((row) => row.topicId));
      topicIds = topicIds.filter((id) => set.has(id));
      if (topicIds.length === 0) return [];
    }
    const topics = await tx.select({ id: messageTopics.id, name: messageTopics.name }).from(messageTopics).where(and(eq(messageTopics.eventId, eventId), inArray(messageTopics.id, topicIds)));
    const byTopic = new Map(stats.map((stat) => [stat.topicId, stat]));
    return topics
      .map((topic) => ({ id: topic.id, name: topic.name, messageCount: byTopic.get(topic.id)?.count ?? 0, lastMessageAt: byTopic.get(topic.id)?.last?.toISOString() ?? null }))
      .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  });
}

export async function topicHasSharedMessage(organizationId: string, topicId: string): Promise<boolean> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select({ id: messages.id }).from(messages).where(and(eq(messages.topicId, topicId), eq(messages.visibility, "shared"))).limit(1));
  return Boolean(row);
}

export async function insertTopic(organizationId: string, eventId: string, rawName: string): Promise<MessageTopicSummary> {
  const name = topicName(rawName);
  const [row] = await inOrganization(organizationId, (tx) => tx.insert(messageTopics).values({ organizationId, eventId, name }).returning());
  return { id: row!.id, eventId: row!.eventId, name: row!.name, vendorLinkIds: [], messageCount: 0, lastMessageAt: null, createdAt: row!.createdAt.toISOString() };
}

// Les prestataires du sujet (leurs liens, déjà vérifiés par le service : liens « vendor » du même
// évènement).
export async function replaceTopicVendors(organizationId: string, topicId: string, linkIds: string[]): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    await tx.delete(messageTopicLinks).where(eq(messageTopicLinks.topicId, topicId));
    if (linkIds.length > 0) await tx.insert(messageTopicLinks).values(linkIds.map((linkId) => ({ organizationId, topicId, linkId })));
    await tx.update(messageTopics).set({ updatedAt: sql`now()` }).where(eq(messageTopics.id, topicId));
  });
}

// --- Messages ---

type MessageRow = typeof messages.$inferSelect;
type AttachmentRow = typeof messageAttachments.$inferSelect;

function toAttachment(row: AttachmentRow): MessageAttachmentView {
  return { id: row.id, label: row.label, mime: row.mime, sizeBytes: row.sizeBytes };
}

function toMessage(row: MessageRow, attachments: AttachmentRow[]): MessageView {
  return {
    id: row.id,
    topicId: row.topicId,
    visibility: row.visibility,
    authorKind: row.authorKind,
    authorName: row.authorName,
    body: row.body,
    attachments: attachments.map(toAttachment),
    createdAt: row.createdAt.toISOString(),
  };
}

// sharedOnly : la lecture d'un lien ; la requête ne prend que les messages partagés.
export async function listMessages(organizationId: string, topicId: string, options: { sharedOnly: boolean }): Promise<MessageView[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select()
      .from(messages)
      .where(options.sharedOnly ? and(eq(messages.topicId, topicId), eq(messages.visibility, "shared")) : eq(messages.topicId, topicId))
      .orderBy(asc(messages.createdAt));
    if (rows.length === 0) return [];
    const attachments = await tx.select().from(messageAttachments).where(inArray(messageAttachments.messageId, rows.map((row) => row.id))).orderBy(asc(messageAttachments.createdAt));
    return rows.map((row) => toMessage(row, attachments.filter((attachment) => attachment.messageId === row.id)));
  });
}

export type NewMessage = {
  organizationId: string;
  topic: TopicRow;
  visibility: MessageVisibility;
  author: { kind: "team"; userId: string; name: string } | { kind: "link"; linkId: string; name: string };
  body: string;
  files: MessageFileInput[];
};

// Les fichiers sont contrôlés et rangés avant la ligne : un refus n'enregistre rien ; une ligne refusée
// ne laisse aucun fichier orphelin.
export async function insertMessage(input: NewMessage): Promise<MessageView> {
  const body = messageBody(input.body);
  const files = messageFiles(input.files);
  const uploaded: { label: string; key: string; mime: string; size: number }[] = [];
  const storage = createStorageClient();
  try {
    for (const file of files) {
      const label = documentLabel(file.label);
      const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(file.content), maxSizeBytes: EVENT_DOCUMENT_MAX_SIZE_BYTES });
      if (upload.status === "rejected") throw new EventDocumentRejectedError(upload.reason);
      uploaded.push({ label, key: upload.key, mime: upload.mime, size: upload.size });
    }
    return await inOrganization(input.organizationId, async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          organizationId: input.organizationId,
          eventId: input.topic.eventId,
          topicId: input.topic.id,
          visibility: input.visibility,
          authorKind: input.author.kind,
          authorUserId: input.author.kind === "team" ? input.author.userId : null,
          authorLinkId: input.author.kind === "link" ? input.author.linkId : null,
          authorName: input.author.name.slice(0, 200) || "—",
          body,
        })
        .returning();
      const attachments =
        uploaded.length > 0
          ? await tx
              .insert(messageAttachments)
              .values(uploaded.map((file) => ({ organizationId: input.organizationId, eventId: input.topic.eventId, messageId: row!.id, label: file.label, fileKey: file.key, mime: file.mime, sizeBytes: file.size })))
              .returning()
          : [];
      await tx.update(messageTopics).set({ updatedAt: sql`now()` }).where(eq(messageTopics.id, input.topic.id));
      return toMessage(row!, attachments);
    });
  } catch (error) {
    for (const file of uploaded) await deletePrivateObject(storage, file.key).catch(() => undefined);
    throw error;
  }
}

// Une pièce jointe, avec la visibilité de son message et son sujet : le service décide.
export async function findAttachment(organizationId: string, attachmentId: string): Promise<{ row: AttachmentRow; visibility: MessageVisibility; topicId: string } | null> {
  if (!UUID.test(attachmentId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [found] = await tx
      .select({ row: messageAttachments, visibility: messages.visibility, topicId: messages.topicId })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .where(eq(messageAttachments.id, attachmentId));
    return found ?? null;
  });
}

export async function readAttachmentFile(row: AttachmentRow): Promise<FileDownload> {
  try {
    const { data } = await readPrivateObject(createStorageClient(), row.fileKey);
    const extension = row.fileKey.split(".").pop() ?? "bin";
    const safeName = row.label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "piece-jointe";
    return { data, contentType: row.mime, fileName: `${safeName}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new MessageNotFoundError();
    throw error;
  }
}
