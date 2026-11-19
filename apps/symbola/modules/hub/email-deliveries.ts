// Lot 55 (MSG-04 révisée, MSG-05 ; D1, D2 ; ADR 0101) — l'adresse d'expédition de l'organisation et le
// journal des envois. Exposé seulement par service.ts (ADR 0011).
//
// - Adresse d'expédition : « <partie locale>@<SMTP_FROM_DOMAIN> », proposée depuis le nom, unique
//   (index unique de hub.organizations), modifiable. Utilisée pour tous les e-mails de l'organisation
//   quand SMTP_SENDER_MODE vaut « organization » ; les réponses vont à son adresse de contact.
// - Journal : une ligne par e-mail parti (objet, destinataire, nature, évènement), mise à jour par le
//   webhook signé du service d'envoi (remis, rejeté, plainte). Jamais le corps. Purgé à 13 mois.
// - Un rejet ou une plainte crée une notification « e-mail rejeté » (lot 53), qui mène au contact
//   s'il est connu ; la fiche du contact affiche l'alerte tant qu'aucun envoi plus récent n'est remis.
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, type SQL } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { contacts, emailDeliveries, organizations } from "@symbola/db/schema/hub";
import { withActorContext, withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { hasTerms, prepareTerms, recordMatches, type PersonTerms } from "@symbola/privacy";
import type { ContactDeliveryAlert, EmailBounceReason, EmailDeliveryStatus, EmailDeliveryView, SenderAddressView } from "@symbola/contracts";
import { currentDeliveryWebhookAdapter } from "./delivery-webhooks";
import { findOrganizationById, findOrganizationProfile } from "./repository";
import { normalizeSenderLocalPart, parseDeliveryReference, senderLocalPartCandidates, senderLocalPartProblem, type SenderLocalPartProblem } from "./sender-address-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_DELIVERY_RETENTION_MONTHS = 13;
const PAGE_SIZE = 200;

// --- Adresse d'expédition (MSG-04 révisée) ---

export class SenderAddressError extends Error {
  constructor(readonly reason: SenderLocalPartProblem | "taken") {
    super("adresse d'expédition refusée");
    this.name = "SenderAddressError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause;
  return (error as { code?: string }).code === "23505" || cause?.code === "23505";
}

// La partie locale de l'organisation ; proposée depuis son nom et enregistrée si elle n'en a pas.
export async function ensureSenderLocalPart(organizationId: string): Promise<string> {
  const db = appDatabase();
  const organization = await findOrganizationById(db, organizationId);
  if (!organization) throw new Error("organisation introuvable");
  if (organization.senderLocalPart) return organization.senderLocalPart;
  for (const candidate of senderLocalPartCandidates(organization.name)) {
    try {
      const rows = await withActorContext(db, (tx) =>
        tx
          .update(organizations)
          .set({ senderLocalPart: candidate })
          .where(and(eq(organizations.id, organizationId), isNull(organizations.senderLocalPart)))
          .returning({ localPart: organizations.senderLocalPart }),
      );
      if (rows[0]?.localPart) return rows[0].localPart;
      // Une autre requête l'a posée entre-temps : on la relit.
      const again = await findOrganizationById(db, organizationId);
      if (again?.senderLocalPart) return again.senderLocalPart;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new SenderAddressError("taken");
}

// La planner choisit sa partie locale ; une adresse prise par une autre organisation est refusée sans
// dire laquelle.
export async function setSenderLocalPart(organizationId: string, raw: string): Promise<string> {
  const localPart = normalizeSenderLocalPart(raw);
  const problem = senderLocalPartProblem(localPart);
  if (problem) throw new SenderAddressError(problem);
  try {
    await withActorContext(appDatabase(), (tx) => tx.update(organizations).set({ senderLocalPart: localPart }).where(eq(organizations.id, organizationId)));
  } catch (error) {
    if (isUniqueViolation(error)) throw new SenderAddressError("taken");
    throw error;
  }
  return localPart;
}

export async function getSenderAddress(organizationId: string): Promise<SenderAddressView> {
  const env = parseEnv(process.env);
  const [localPart, profile] = await Promise.all([ensureSenderLocalPart(organizationId), findOrganizationProfile(appDatabase(), organizationId)]);
  return { localPart, domain: env.SMTP_FROM_DOMAIN, address: `${localPart}@${env.SMTP_FROM_DOMAIN}`, mode: env.SMTP_SENDER_MODE, replyTo: profile?.contactEmail ?? null };
}

// L'adresse à mettre en « From » : celle de l'organisation en mode « organization », sinon aucune
// (SMTP_FROM, comme avant le lot).
export async function organizationFromAddress(organizationId: string): Promise<string | null> {
  const env = parseEnv(process.env);
  if (env.SMTP_SENDER_MODE !== "organization") return null;
  return `${await ensureSenderLocalPart(organizationId)}@${env.SMTP_FROM_DOMAIN}`;
}

// --- Journal des envois (MSG-05) ---

export function recipientHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export type DeliveryTracking = { id: string; reference: string; kind: string | null; eventId: string | null };

function toView(row: typeof emailDeliveries.$inferSelect): EmailDeliveryView {
  return {
    id: row.id,
    recipient: row.recipient,
    subject: row.subject,
    kind: row.kind,
    eventId: row.eventId,
    status: row.status,
    reason: (row.reason as EmailBounceReason | null) ?? null,
    sentAt: row.sentAt.toISOString(),
    statusAt: row.statusAt.toISOString(),
  };
}

// Appelé par la file des tâches quand l'e-mail est parti (statut « envoyé »).
export async function recordEmailSent(organizationId: string, tracking: DeliveryTracking, message: { to: string; subject: string }, now: Date = new Date()): Promise<void> {
  if (!UUID.test(tracking.id)) return;
  await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(emailDeliveries)
      .values({
        id: tracking.id,
        organizationId,
        reference: tracking.reference,
        recipient: message.to.trim().toLowerCase(),
        recipientHash: recipientHash(message.to),
        subject: message.subject.slice(0, 300),
        kind: tracking.kind,
        eventId: tracking.eventId && UUID.test(tracking.eventId) ? tracking.eventId : null,
        status: "sent",
        sentAt: now,
        statusAt: now,
      })
      .onConflictDoNothing(),
  );
}

const RANK: Record<EmailDeliveryStatus, number> = { sent: 0, delivered: 1, bounced: 2, complained: 2 };

export type DeliveryChange = { organizationId: string; deliveryId: string; status: EmailDeliveryStatus; recipient: string | null; eventId: string | null };

// Applique un statut reçu : seulement vers l'avant (envoyé → remis → rejeté ou plainte) ; un appel
// rejoué ne change rien. Null : référence inconnue ou rien à changer.
export async function applyDeliveryStatus(input: { reference: string; status: Exclude<EmailDeliveryStatus, "sent">; reason: EmailBounceReason | null; occurredAt: Date }): Promise<DeliveryChange | null> {
  const parsed = parseDeliveryReference(input.reference);
  if (!parsed) return null;
  return withOrganization(appDatabase(), parsed.organizationId, async (tx) => {
    const [row] = await tx.select().from(emailDeliveries).where(eq(emailDeliveries.id, parsed.deliveryId));
    if (!row || row.organizationId !== parsed.organizationId) return null;
    if (RANK[input.status] <= RANK[row.status]) return null;
    await tx
      .update(emailDeliveries)
      .set({ status: input.status, reason: input.status === "delivered" ? null : input.reason, statusAt: input.occurredAt })
      .where(eq(emailDeliveries.id, row.id));
    return { organizationId: row.organizationId, deliveryId: row.id, status: input.status, recipient: row.recipient, eventId: row.eventId };
  });
}

export type EmailDeliveryWebhookResult = { httpStatus: number; outcome: string; changes: DeliveryChange[] };

// Le webhook du service d'envoi : signature vérifiée par l'adaptateur, sinon 401 et journal (motif
// seulement, jamais le corps ni un en-tête : SEC-20). Une référence inconnue est ignorée (200), sans
// dire si elle existe.
export async function handleEmailDeliveryWebhook(input: { headers: Headers; rawBody: string; now?: Date }): Promise<EmailDeliveryWebhookResult> {
  const adapter = currentDeliveryWebhookAdapter();
  if (!adapter) {
    console.warn("webhook d'envoi rejeté : unavailable");
    return { httpStatus: 404, outcome: "unavailable", changes: [] };
  }
  const verification = adapter.verify(input.headers, input.rawBody, input.now ?? new Date());
  if (!verification.ok) {
    console.warn(`webhook d'envoi rejeté : ${verification.reason}`);
    return { httpStatus: 401, outcome: verification.reason, changes: [] };
  }
  const changes: DeliveryChange[] = [];
  for (const event of verification.events) {
    const change = await applyDeliveryStatus(event);
    if (change) changes.push(change);
  }
  return { httpStatus: 200, outcome: "accepted", changes };
}

// Le contact dont c'est l'adresse (la fiche où porter l'alerte), s'il existe.
export async function contactIdForRecipient(organizationId: string, recipient: string | null): Promise<string | null> {
  if (!recipient) return null;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, recipient.trim().toLowerCase())).limit(1));
  return row?.id ?? null;
}

export async function listEmailDeliveries(organizationId: string, filter: { email?: string | null; eventId?: string | null; status?: EmailDeliveryStatus | null } = {}): Promise<EmailDeliveryView[]> {
  const conditions: SQL[] = [];
  if (filter.email) conditions.push(eq(emailDeliveries.recipientHash, recipientHash(filter.email)));
  if (filter.eventId) {
    if (!UUID.test(filter.eventId)) return [];
    conditions.push(eq(emailDeliveries.eventId, filter.eventId));
  }
  if (filter.status) conditions.push(eq(emailDeliveries.status, filter.status));
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(emailDeliveries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emailDeliveries.sentAt))
      .limit(PAGE_SIZE),
  );
  return rows.map(toView);
}

// L'alerte d'un contact (critère de MSG-05) : le dernier envoi à son adresse est rejeté ou signalé.
// Un envoi plus récent remis l'efface.
export async function contactDeliveryAlert(organizationId: string, email: string | null): Promise<ContactDeliveryAlert | null> {
  if (!email) return null;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ status: emailDeliveries.status, reason: emailDeliveries.reason, statusAt: emailDeliveries.statusAt })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.recipientHash, recipientHash(email)))
      .orderBy(desc(emailDeliveries.sentAt))
      .limit(1),
  );
  if (!row || (row.status !== "bounced" && row.status !== "complained")) return null;
  return { status: row.status, reason: (row.reason as EmailBounceReason | null) ?? null, at: row.statusAt.toISOString() };
}

// Purge à 13 mois (D2) : la ligne entière, objet et statut compris.
// Le même instant, n mois plus tôt ; un jour qui n'existe pas ce mois-là (31 mars → février) devient
// le dernier jour du mois, au lieu de déborder sur le mois suivant.
export function monthsBefore(date: Date, months: number): Date {
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

export async function purgeEmailDeliveries(organizationId: string, now: Date = new Date()): Promise<number> {
  const limit = monthsBefore(now, EMAIL_DELIVERY_RETENTION_MONTHS);
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(emailDeliveries).where(lt(emailDeliveries.sentAt, limit)).returning({ id: emailDeliveries.id }));
  return rows.length;
}

// RGPD (privacy/v1) : les envois à la personne (adresse ou objet qui la nomme) ; l'effacement les
// supprime du journal.
export async function findEmailDeliveriesByTerms(organizationId: string, rawTerms: PersonTerms): Promise<{ id: string; subject: string; fields: Record<string, string> }[]> {
  const terms = prepareTerms(rawTerms);
  if (!hasTerms(terms)) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(emailDeliveries));
  return rows.flatMap((row) => {
    const fields: Record<string, string> = { subject: row.subject, status: row.status, sentAt: row.sentAt.toISOString() };
    if (row.recipient) fields.to = row.recipient;
    return recordMatches([row.recipient ?? "", row.subject], terms) ? [{ id: row.id, subject: row.subject, fields }] : [];
  });
}

export async function eraseEmailDeliveries(organizationId: string, ids: string[], execute: boolean): Promise<string[]> {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length === 0) return [];
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    if (!execute) return (await tx.select({ id: emailDeliveries.id }).from(emailDeliveries).where(inArray(emailDeliveries.id, valid))).map((row) => row.id);
    return (await tx.delete(emailDeliveries).where(inArray(emailDeliveries.id, valid)).returning({ id: emailDeliveries.id })).map((row) => row.id);
  });
}
