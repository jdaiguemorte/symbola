// Lot 65d (MSG-01, HUB-20, HUB-28 ; décisions de Julien du 22/11/2026 ; ADR 0110) — les messages de la
// relation préparés par Symbola, envoyés par la planner de sa messagerie. Exposé seulement par
// service.ts (ADR 0011).
//
// - Le réglage de l'organisation : « planner » (par défaut, sans ligne) ou « symbola » (Symbola envoie,
//   comme avant le lot). Changer de réglage ne perd rien : les messages déjà préparés restent.
// - La liste des modèles techniques, toujours envoyés par Symbola, est fermée et en données
//   (email-senders.json) ; tout autre modèle est un message de la relation.
// - Un message préparé ne garde ni contenu ni adresse : le modèle, l'évènement, le destinataire par son
//   identifiant, des références (identifiants) pour le recomposer, et sa clé d'envoi (une seule fois).
//   « J'ai envoyé » note la date, la personne et le modèle ; « Ne pas l'envoyer » l'écarte.
import { and, desc, eq, inArray } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { preparedEmails, relationMailSettings } from "@symbola/db/schema/hub";
import { RELATION_MAIL_SENDERS, type EmailTemplateKind, type PreparedEmailRecipientType, type PreparedEmailRef, type PreparedEmailView, type RelationMailSender } from "@symbola/contracts";

import { isRelationEmailKind } from "./relation-mail-rules";

export { isRelationEmailKind, preparedMailto, RELATION_EMAIL_KINDS, TECHNICAL_EMAIL_KINDS } from "./relation-mail-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
const REF_VALUE = /^[0-9a-zA-Z_:.-]{1,80}$/;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class PreparedEmailError extends Error {
  constructor(readonly reason: "sender" | "kind" | "recipient" | "ref" | "not_found" | "closed") {
    super("message préparé refusé");
    this.name = "PreparedEmailError";
  }
}

export async function getRelationMailSender(organizationId: string): Promise<RelationMailSender> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select({ sender: relationMailSettings.sender }).from(relationMailSettings).where(eq(relationMailSettings.organizationId, organizationId)));
  return row?.sender ?? "planner";
}

export async function setRelationMailSender(organizationId: string, sender: string): Promise<RelationMailSender> {
  if (!(RELATION_MAIL_SENDERS as readonly string[]).includes(sender)) throw new PreparedEmailError("sender");
  const value = sender as RelationMailSender;
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(relationMailSettings)
      .values({ organizationId, sender: value })
      .onConflictDoUpdate({ target: relationMailSettings.organizationId, set: { sender: value, updatedAt: new Date() } }),
  );
  return value;
}

// true : ce modèle ne part pas de Symbola pour cette organisation, il est préparé pour la planner.
export async function preparesRelationEmail(organizationId: string, kind: EmailTemplateKind): Promise<boolean> {
  if (!isRelationEmailKind(kind)) return false;
  return (await getRelationMailSender(organizationId)) === "planner";
}

function toView(row: typeof preparedEmails.$inferSelect): PreparedEmailView {
  return {
    id: row.id,
    kind: row.kind as EmailTemplateKind,
    eventId: row.eventId,
    recipientType: row.recipientType,
    recipientId: row.recipientId,
    ref: row.ref,
    origin: row.origin,
    automationKey: row.automationKey,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    sentByUserId: row.sentByUserId,
  };
}

function cleanRef(ref: PreparedEmailRef): PreparedEmailRef {
  const entries = Object.entries(ref);
  if (entries.length > 12 || entries.some(([key, value]) => !REF_KEY.test(key) || typeof value !== "string" || !REF_VALUE.test(value))) throw new PreparedEmailError("ref");
  return Object.fromEntries(entries);
}

export type DepositPreparedEmailInput = {
  organizationId: string;
  kind: EmailTemplateKind;
  eventId: string | null;
  recipientType: PreparedEmailRecipientType;
  recipientId: string;
  ref?: PreparedEmailRef;
  origin: "gesture" | "automation";
  automationKey?: string | null;
  // La clé de l'envoi remplacé : un message n'est déposé qu'une fois par clé (des identifiants, jamais
  // d'adresse), même s'il a été envoyé ou écarté depuis.
  sourceKey?: string | null;
};

// Dépose un message « à envoyer ». created : false si la même clé a déjà été déposée (son identifiant
// est rendu, quel que soit son état).
export async function depositPreparedEmail(input: DepositPreparedEmailInput): Promise<{ id: string; created: boolean }> {
  if (!isRelationEmailKind(input.kind)) throw new PreparedEmailError("kind");
  if (!UUID.test(input.recipientId) || (input.eventId !== null && !UUID.test(input.eventId))) throw new PreparedEmailError("recipient");
  const ref = cleanRef(input.ref ?? {});
  const sourceKey = input.sourceKey ? input.sourceKey.slice(0, 300) : null;
  return inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx
      .insert(preparedEmails)
      .values({
        organizationId: input.organizationId,
        kind: input.kind,
        eventId: input.eventId,
        recipientType: input.recipientType,
        recipientId: input.recipientId,
        ref,
        origin: input.origin,
        automationKey: input.automationKey ?? null,
        sourceKey,
      })
      .onConflictDoNothing()
      .returning({ id: preparedEmails.id });
    if (row) return { id: row.id, created: true };
    const [existing] = await tx.select({ id: preparedEmails.id }).from(preparedEmails).where(and(eq(preparedEmails.organizationId, input.organizationId), eq(preparedEmails.sourceKey, sourceKey ?? "")));
    if (!existing) throw new PreparedEmailError("ref");
    return { id: existing.id, created: false };
  });
}

export async function getPreparedEmail(organizationId: string, id: string): Promise<PreparedEmailView | null> {
  if (!UUID.test(id)) return null;
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(preparedEmails).where(eq(preparedEmails.id, id)));
  return row ? toView(row) : null;
}

export async function listPreparedEmails(organizationId: string, filter: { status?: PreparedEmailView["status"]; eventId?: string; ids?: string[] } = {}): Promise<PreparedEmailView[]> {
  if (filter.eventId !== undefined && !UUID.test(filter.eventId)) return [];
  const ids = filter.ids?.filter((id) => UUID.test(id)).slice(0, 50);
  if (ids && ids.length === 0) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(preparedEmails)
      .where(
        and(
          eq(preparedEmails.organizationId, organizationId),
          filter.status ? eq(preparedEmails.status, filter.status) : undefined,
          filter.eventId ? eq(preparedEmails.eventId, filter.eventId) : undefined,
          ids ? inArray(preparedEmails.id, ids) : undefined,
        ),
      )
      .orderBy(desc(preparedEmails.createdAt))
      .limit(200),
  );
  return rows.map(toView);
}

// « J'ai envoyé » : la date, la personne de l'équipe, le modèle et le destinataire (son identifiant)
// restent au journal. Déjà envoyé : rien ne change ; écarté : refusé.
export async function markPreparedEmailSent(organizationId: string, id: string, userId: string, now: Date = new Date()): Promise<PreparedEmailView> {
  if (!UUID.test(id)) throw new PreparedEmailError("not_found");
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(preparedEmails).where(eq(preparedEmails.id, id)).for("update");
    if (!row) throw new PreparedEmailError("not_found");
    if (row.status === "sent") return toView(row);
    if (row.status !== "to_send") throw new PreparedEmailError("closed");
    const [updated] = await tx.update(preparedEmails).set({ status: "sent", sentAt: now, sentByUserId: userId, updatedAt: now }).where(eq(preparedEmails.id, id)).returning();
    return toView(updated!);
  });
}

// « Ne pas l'envoyer » : le message quitte « À envoyer » ; il ne revient pas (sa clé reste prise).
export async function dismissPreparedEmail(organizationId: string, id: string, now: Date = new Date()): Promise<PreparedEmailView> {
  if (!UUID.test(id)) throw new PreparedEmailError("not_found");
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(preparedEmails).where(eq(preparedEmails.id, id)).for("update");
    if (!row) throw new PreparedEmailError("not_found");
    if (row.status === "dismissed") return toView(row);
    if (row.status !== "to_send") throw new PreparedEmailError("closed");
    const [updated] = await tx.update(preparedEmails).set({ status: "dismissed", dismissedAt: now, updatedAt: now }).where(eq(preparedEmails.id, id)).returning();
    return toView(updated!);
  });
}
