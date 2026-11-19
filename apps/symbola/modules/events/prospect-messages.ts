// Lot 45 (CRM-05, CRM-06, CRM-03 ; D1 à D3 ; ADR 0090) — répondre à un prospect en un clic et le
// relancer sans oublier. Accès aux données et règles du module events ; exposé seulement par
// service.ts (ADR 0011).
//
// - Une réponse part d'un modèle de message (hub), relu et modifié par la planner, puis part de
//   Symbola (à l'image de l'organisation, réponses à son adresse) ou s'ouvre dans sa messagerie
//   (« préparée »). Elle est rangée dans l'historique du contact (event_messages).
// - La brochure de l'organisation (un PDF) est jointe par un lien sécurisé, valable 30 jours, servi
//   par la page /partage après contrôle (ADR 0027) ; jamais en pièce jointe.
// - Les relances se comptent depuis le dernier envoi de la planner (J+3, J+7 par défaut). Chacune se
//   prépare dans « Aujourd'hui » ; la planner la relit et l'envoie d'un geste, ou la retire. L'envoi
//   automatique est un réglage, désactivé par défaut. Les faits qui les arrêtent (« a répondu »,
//   étape, confirmation, refus, action du prospect, nouvel envoi) sont revérifiés juste avant
//   l'envoi. Symbola ne lit aucune boîte e-mail (D3).
import type { AutomationHooks } from "@symbola/contracts";
import { and, desc, eq, inArray, isNull, lte, max } from "drizzle-orm";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { withOrganization } from "@symbola/db/with-organization";
import { eventActivities, eventLinks, eventMessages, eventQuestionnaires, events, prospectFollowUps, prospectFollowUpSettings, questionnaireAnswers } from "@symbola/db/schema/events";
import { createStorageClient, deletePrivateObject, readPrivateObject, uploadFile } from "@symbola/files";
import { parseEnv } from "@symbola/env";
import { formatCalendarDate } from "@symbola/i18n";
import { starterProspectFollowUps } from "@symbola/starter-templates";
import {
  MESSAGE_SEND_TIME_VARIABLES,
  type EmailValues,
  type EventMessage,
  type EventMessageKind,
  type FileDownload,
  type FollowUpStep,
  type FollowUpStopReason,
  type ProspectFollowUp,
  type ProspectFollowUpSettings,
  type ReadyFollowUp,
} from "@symbola/contracts";
import { getDocumentHeader, getEmailTemplate, getMessageTemplate, renderMessageTemplate, sendOrganizationEmail, variableToken } from "@/modules/hub/service";
import { followUpStopReason, nextFollowUpToPrepare, validateFollowUpSteps, withOptOut, type FollowUpFacts } from "./follow-up-rules";
import { formatLinkToken, hashLinkSecret, newLinkSecret, parseLinkToken } from "./link-tokens";
import { organizationLinksClosed } from "./closed-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type MessageRow = typeof eventMessages.$inferSelect;
type FollowUpRow = typeof prospectFollowUps.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
export const PROSPECT_SUBJECT_MAX = 200;
export const PROSPECT_BODY_MAX = 5000;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

function translator(locale: "fr" | "en") {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Emails" });
}

export class ProspectMessageInvalidError extends Error {
  constructor(readonly reason: "empty" | "too_long" | "no_recipient" | "missing" | "no_brochure" | "not_found" | "demo") {
    super(`message au prospect refusé : ${reason}`);
    this.name = "ProspectMessageInvalidError";
  }
}

export class BrochureRejectedError extends Error {
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected" | "name") {
    super(`brochure refusée : ${reason}`);
    this.name = "BrochureRejectedError";
  }
}

// —— Réglage des relances et brochure ———————————————————————————————————————————————————

type SettingsRow = typeof prospectFollowUpSettings.$inferSelect;

async function settingsRow(organizationId: string): Promise<SettingsRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(prospectFollowUpSettings).where(eq(prospectFollowUpSettings.organizationId, organizationId));
    if (row) return row;
    const starter = starterProspectFollowUps();
    await tx
      .insert(prospectFollowUpSettings)
      .values({ organizationId, autoSend: starter.autoSend, steps: starter.steps.map((step) => ({ days: step.days, messageTemplateId: null })) })
      .onConflictDoNothing();
    const [created] = await tx.select().from(prospectFollowUpSettings).where(eq(prospectFollowUpSettings.organizationId, organizationId));
    return created!;
  });
}

function toSettings(row: SettingsRow): ProspectFollowUpSettings {
  return {
    enabled: row.enabled,
    autoSend: row.autoSend,
    steps: row.steps.map((step) => ({ days: step.days, messageTemplateId: step.messageTemplateId ?? null })),
    brochure: row.brochureFileName && row.brochureStorageKey ? { fileName: row.brochureFileName, sizeBytes: row.brochureSizeBytes ?? 0 } : null,
  };
}

export async function getProspectFollowUpSettings(organizationId: string): Promise<ProspectFollowUpSettings> {
  return toSettings(await settingsRow(organizationId));
}

export async function saveProspectFollowUpSettings(organizationId: string, input: { enabled: boolean; autoSend: boolean; steps: FollowUpStep[] }): Promise<ProspectFollowUpSettings> {
  const steps = validateFollowUpSteps(input.steps.map((step) => ({ days: step.days, messageTemplateId: step.messageTemplateId && UUID.test(step.messageTemplateId) ? step.messageTemplateId : null })));
  await settingsRow(organizationId);
  const [row] = await inOrganization(organizationId, (tx) =>
    tx.update(prospectFollowUpSettings).set({ enabled: input.enabled, autoSend: input.autoSend, steps, updatedAt: new Date() }).where(eq(prospectFollowUpSettings.organizationId, organizationId)).returning(),
  );
  return toSettings(row!);
}

// La brochure : un PDF (type vérifié par le contenu, antivirus, stockage privé), qui remplace la
// précédente.
export async function saveProspectBrochure(organizationId: string, input: { content: Uint8Array; fileName: string }): Promise<ProspectFollowUpSettings> {
  const fileName = input.fileName.replace(/[\\/]/g, "-").trim().slice(0, 200);
  if (!fileName) throw new BrochureRejectedError("name");
  const upload = await uploadFile({ organizationId, buffer: Buffer.from(input.content), maxSizeBytes: starterProspectFollowUps().brochureMaxSizeBytes });
  if (upload.status === "rejected") throw new BrochureRejectedError(upload.reason);
  const storage = createStorageClient();
  if (upload.mime !== "application/pdf") {
    await deletePrivateObject(storage, upload.key).catch(() => undefined);
    throw new BrochureRejectedError("unsupported_type");
  }
  const previous = await settingsRow(organizationId);
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .update(prospectFollowUpSettings)
      .set({ brochureStorageKey: upload.key, brochureFileName: fileName, brochureSizeBytes: upload.size, updatedAt: new Date() })
      .where(eq(prospectFollowUpSettings.organizationId, organizationId))
      .returning(),
  );
  if (previous.brochureStorageKey) await deletePrivateObject(storage, previous.brochureStorageKey).catch(() => undefined);
  return toSettings(row!);
}

export async function removeProspectBrochure(organizationId: string): Promise<void> {
  const previous = await settingsRow(organizationId);
  await inOrganization(organizationId, (tx) =>
    tx.update(prospectFollowUpSettings).set({ brochureStorageKey: null, brochureFileName: null, brochureSizeBytes: null, updatedAt: new Date() }).where(eq(prospectFollowUpSettings.organizationId, organizationId)),
  );
  if (previous.brochureStorageKey) await deletePrivateObject(createStorageClient(), previous.brochureStorageKey).catch(() => undefined);
}

// Lien de la brochure (SEC-17) : « <organisation>.<secret> », seul le haché est gardé ; la page
// /partage le lit après « # », jamais dans l'adresse envoyée au serveur.
function brochureUrl(token: string): string {
  return `${parseEnv(process.env).APP_PUBLIC_URL}/partage#${token}`;
}

export async function describeBrochureLink(token: string, now: Date = new Date()): Promise<{ label: string; mime: string; sizeBytes: number } | null> {
  const found = await brochureOfToken(token, now);
  return found ? { label: found.fileName, mime: "application/pdf", sizeBytes: found.sizeBytes } : null;
}

export async function openBrochureLink(token: string, now: Date = new Date()): Promise<{ label: string; mime: string; sizeBytes: number; file: () => Promise<FileDownload> } | null> {
  const found = await brochureOfToken(token, now);
  if (!found) return null;
  return {
    label: found.fileName,
    mime: "application/pdf",
    sizeBytes: found.sizeBytes,
    file: async () => {
      const { data } = await readPrivateObject(createStorageClient(), found.storageKey);
      return { data, contentType: "application/pdf", fileName: found.fileName.toLowerCase().endsWith(".pdf") ? found.fileName : `${found.fileName}.pdf` };
    },
  };
}

// Un lien inconnu, expiré, ou dont la brochure a été retirée : null, sans rien révéler.
async function brochureOfToken(token: string, now: Date): Promise<{ fileName: string; sizeBytes: number; storageKey: string } | null> {
  const parsed = parseLinkToken(token);
  if (!parsed || (await organizationLinksClosed(parsed.organizationId))) return null;
  return inOrganization(parsed.organizationId, async (tx) => {
    const [message] = await tx.select({ expiresAt: eventMessages.brochureExpiresAt }).from(eventMessages).where(eq(eventMessages.brochureTokenHash, hashLinkSecret(parsed.secret)));
    if (!message?.expiresAt || message.expiresAt.getTime() <= now.getTime()) return null;
    const [settings] = await tx.select().from(prospectFollowUpSettings).where(eq(prospectFollowUpSettings.organizationId, parsed.organizationId));
    if (!settings?.brochureStorageKey || !settings.brochureFileName) return null;
    return { fileName: settings.brochureFileName, sizeBytes: settings.brochureSizeBytes ?? 0, storageKey: settings.brochureStorageKey };
  });
}

// —— Valeurs d'un message ————————————————————————————————————————————————————————————————

export type ProspectRecipient = { contactId: string; firstName: string; email: string };


// Les valeurs des variables d'un message (CRM-05) ; la brochure n'a de valeur qu'à l'envoi.
export async function prospectMessageValues(input: {
  organizationId: string;
  locale: "fr" | "en";
  couple: boolean;
  firstNames: string[];
  clientNames: string[];
  eventDate: string | null;
  place: string | null;
  bookingUrl: string | null;
}): Promise<EmailValues> {
  const t = translator(input.locale);
  const join = (names: string[]) => names.filter((name) => name.trim()).join(" & ");
  const header = await getDocumentHeader(appDatabase(), input.organizationId);
  return {
    first_name: join(input.firstNames),
    clients: join(input.clientNames),
    event: t(input.couple ? "event.coupleClient" : "event.clientsClient"),
    event_date: input.eventDate ? formatCalendarDate(input.eventDate, input.locale) : "",
    place: input.place ?? "",
    organization: header?.organizationName ?? "",
    booking_link: input.bookingUrl ? t("booking.withPage", { url: input.bookingUrl }) : t("booking.manual"),
  };
}

// Un texte rendu garde « {{brochure}} » jusqu'à l'envoi ; toute autre variable vide est signalée.
export function renderProspectText(text: { subject: string; body: string }, values: EmailValues): { subject: string; body: string; missing: string[] } {
  const rendered = renderMessageTemplate(text, values);
  const sendTime = new Set<string>(MESSAGE_SEND_TIME_VARIABLES);
  return { subject: rendered.subject, body: rendered.body, missing: rendered.missing.filter((key) => !sendTime.has(key)) };
}

function usesBrochure(text: string): boolean {
  return /\{\{\s*brochure\s*\}\}/.test(text);
}

async function loadEventForMessage(tx: Tx, eventId: string): Promise<{ id: string; isDemo: boolean } | null> {
  if (!UUID.test(eventId)) return null;
  const [event] = await tx.select({ id: events.id, isDemo: events.isDemo }).from(events).where(eq(events.id, eventId));
  return event ?? null;
}

// —— Envoi d'une réponse (CRM-05 ; D1) ——————————————————————————————————————————————————

export type ProspectSendInput = {
  organizationId: string;
  eventId: string;
  // Destinataires : des clients de l'évènement, avec leur adresse (vérifiés par l'appelant, getEvent).
  recipients: ProspectRecipient[];
  templateId: string | null;
  subject: string;
  body: string;
  userId: string;
  locale: "fr" | "en";
  delivery: "sent" | "prepared";
  // Les autres variables, déjà remplies ; la brochure s'ajoute ici.
  values: EmailValues;
  kind?: "reply";
  now?: Date;
};

function cleanText(subject: string, body: string): { subject: string; body: string } {
  const clean = { subject: subject.replace(/\s+/g, " ").trim(), body: body.replace(/\r\n/g, "\n").trim() };
  if (!clean.subject || !clean.body) throw new ProspectMessageInvalidError("empty");
  if (clean.subject.length > PROSPECT_SUBJECT_MAX || clean.body.length > PROSPECT_BODY_MAX) throw new ProspectMessageInvalidError("too_long");
  return clean;
}

// Le texte final : la brochure remplacée par son lien ; une variable restée vide arrête tout.
function finalText(text: { subject: string; body: string }, values: EmailValues, locale: "fr" | "en"): { subject: string; body: string } {
  const rendered = renderMessageTemplate(text, values);
  if (rendered.missing.length > 0) throw Object.assign(new ProspectMessageInvalidError("missing"), { tokens: rendered.missing.map((key) => variableToken(key, locale)) });
  return { subject: rendered.subject, body: rendered.body };
}

export type ProspectSendResult = { messageIds: string[]; subject: string; body: string; deferred: boolean; brochureExpiresAt: string | null };

// Envoyer depuis Symbola (« sent ») ou préparer pour la messagerie de la planner (« prepared ») : le
// message est rangé dans l'historique de chaque destinataire ; les relances en attente de l'évènement
// s'arrêtent (un nouvel envoi repart à zéro).
export async function sendProspectMessage(input: ProspectSendInput): Promise<ProspectSendResult> {
  const now = input.now ?? new Date();
  const text = cleanText(input.subject, input.body);
  if (input.recipients.length === 0) throw new ProspectMessageInvalidError("no_recipient");
  const event = await inOrganization(input.organizationId, (tx) => loadEventForMessage(tx, input.eventId));
  if (!event) throw new ProspectMessageInvalidError("not_found");
  if (event.isDemo) throw new ProspectMessageInvalidError("demo");
  const template = input.templateId && UUID.test(input.templateId) ? await getMessageTemplate(input.organizationId, input.templateId) : null;

  let brochure: { hash: string; expiresAt: Date; url: string } | null = null;
  if (usesBrochure(text.subject) || usesBrochure(text.body)) {
    const settings = await settingsRow(input.organizationId);
    if (!settings.brochureStorageKey) throw new ProspectMessageInvalidError("no_brochure");
    const secret = newLinkSecret();
    brochure = { hash: hashLinkSecret(secret), expiresAt: new Date(now.getTime() + starterProspectFollowUps().brochureLinkDays * DAY_MS), url: brochureUrl(formatLinkToken(input.organizationId, secret)) };
  }
  const final = finalText(text, { ...input.values, ...(brochure ? { brochure: brochure.url } : {}) }, input.locale);

  let deferred = false;
  if (input.delivery === "sent") {
    for (const recipient of input.recipients) {
      const outcome = await sendOrganizationEmail({ organizationId: input.organizationId, to: recipient.email, kind: "prospect_reply", locale: input.locale, values: {}, template: final });
      deferred ||= outcome.deferred;
    }
  }
  const messageIds = await inOrganization(input.organizationId, async (tx) => {
    const rows = await tx
      .insert(eventMessages)
      .values(
        input.recipients.map((recipient, index) => ({
          organizationId: input.organizationId,
          eventId: input.eventId,
          contactId: recipient.contactId,
          kind: "reply" as const,
          delivery: input.delivery,
          templateId: template?.id ?? null,
          templateVersion: template?.version ?? null,
          subject: final.subject,
          body: final.body,
          // Un seul lien de brochure par envoi, porté par le premier destinataire.
          brochureTokenHash: index === 0 ? (brochure?.hash ?? null) : null,
          brochureExpiresAt: index === 0 ? (brochure?.expiresAt ?? null) : null,
          sentByUserId: input.userId,
          occurredAt: now,
        })),
      )
      .returning({ id: eventMessages.id });
    await stopPendingFollowUps(tx, input.eventId, "new_message", now);
    if (input.delivery === "sent") await appendAudit(tx, { organizationId: input.organizationId, action: "events.prospect_message.sent", objectId: input.eventId, details: { recipients: input.recipients.length } });
    return rows.map((row) => row.id);
  });
  return { messageIds, subject: final.subject, body: final.body, deferred, brochureExpiresAt: brochure?.expiresAt.toISOString() ?? null };
}

async function stopPendingFollowUps(tx: Tx, eventId: string, reason: FollowUpStopReason, now: Date): Promise<number> {
  const stopped = await tx
    .update(prospectFollowUps)
    .set({ stoppedAt: now, stopReason: reason, updatedAt: now })
    .where(and(eq(prospectFollowUps.eventId, eventId), isNull(prospectFollowUps.sentAt), isNull(prospectFollowUps.stoppedAt)))
    .returning({ id: prospectFollowUps.id });
  return stopped.length;
}

// « A répondu » (D3) : noté d'un geste ; les relances en attente s'arrêtent.
export async function noteProspectAnswered(input: { organizationId: string; eventId: string; userId: string; now?: Date }): Promise<void> {
  await noteFact(input, "answered", "answered");
}

// « Ne plus relancer » : noté d'un geste ; vaut pour toujours.
export async function stopProspectFollowUps(input: { organizationId: string; eventId: string; userId: string; now?: Date }): Promise<void> {
  await noteFact(input, "stop", "stopped");
}

async function noteFact(input: { organizationId: string; eventId: string; userId: string; now?: Date }, kind: "answered" | "stop", reason: FollowUpStopReason): Promise<void> {
  if (!UUID.test(input.eventId)) throw new ProspectMessageInvalidError("not_found");
  const now = input.now ?? new Date();
  await inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
    if (!event) throw new ProspectMessageInvalidError("not_found");
    await tx.insert(eventMessages).values({ organizationId: input.organizationId, eventId: input.eventId, kind, delivery: "noted", sentByUserId: input.userId, occurredAt: now });
    await stopPendingFollowUps(tx, input.eventId, reason, now);
  });
}

// Un questionnaire envoyé entre dans l'historique du contact (sans relancer : ce n'est pas une réponse).
export async function recordQuestionnaireSent(input: { organizationId: string; eventId: string; contactId: string | null; userId: string; name: string; now: Date }): Promise<void> {
  await inOrganization(input.organizationId, async (tx) => {
    await tx.insert(eventMessages).values({ organizationId: input.organizationId, eventId: input.eventId, contactId: input.contactId, kind: "questionnaire", delivery: "sent", subject: input.name.slice(0, PROSPECT_SUBJECT_MAX), sentByUserId: input.userId, occurredAt: input.now });
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.questionnaire.sent", objectId: input.eventId });
  });
}

function toMessage(row: MessageRow): EventMessage {
  return {
    id: row.id,
    eventId: row.eventId,
    contactId: row.contactId,
    kind: row.kind as EventMessageKind,
    delivery: row.delivery,
    subject: row.subject,
    body: row.body,
    brochureExpiresAt: row.brochureExpiresAt?.toISOString() ?? null,
    sentByUserId: row.sentByUserId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

export async function listEventMessages(organizationId: string, eventId: string): Promise<EventMessage[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventMessages).where(eq(eventMessages.eventId, eventId)).orderBy(desc(eventMessages.occurredAt)));
  return rows.map(toMessage);
}

// CRM-03 : l'historique des messages d'un contact, tous évènements confondus.
export async function listContactMessages(organizationId: string, contactId: string): Promise<EventMessage[]> {
  if (!UUID.test(contactId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventMessages).where(eq(eventMessages.contactId, contactId)).orderBy(desc(eventMessages.occurredAt)));
  return rows.map(toMessage);
}

// —— Relances (CRM-06 ; D2, D3) ————————————————————————————————————————————————————————

// Ce que les autres modules savent du prospect (rendez-vous pris, signature) : fourni par
// l'appelant, qui les interroge par leurs services (ARC-01).
export type ExternalProspectActivity = (input: { organizationId: string; eventId: string; contactIds: string[] }) => Promise<Date | null>;

// Les destinataires d'une relance et les valeurs de ses variables ; null : l'évènement n'est plus lisible.
export type ProspectContext = (input: { eventId: string; contactIds: string[] }) => Promise<{ recipients: ProspectRecipient[]; values: EmailValues } | null>;

const noExternalActivity: ExternalProspectActivity = async () => null;

type Anchor = { messageId: string; at: Date; contactIds: string[] };

// Le dernier envoi de la planner (réponse envoyée ou préparée), avec tous ses destinataires.
async function latestAnchor(tx: Tx, eventId: string): Promise<Anchor | null> {
  const [last] = await tx
    .select()
    .from(eventMessages)
    .where(and(eq(eventMessages.eventId, eventId), eq(eventMessages.kind, "reply")))
    .orderBy(desc(eventMessages.occurredAt), desc(eventMessages.createdAt))
    .limit(1);
  if (!last) return null;
  const batch = await tx
    .select({ contactId: eventMessages.contactId })
    .from(eventMessages)
    .where(and(eq(eventMessages.eventId, eventId), eq(eventMessages.kind, "reply"), eq(eventMessages.occurredAt, last.occurredAt)));
  return { messageId: last.id, at: last.occurredAt, contactIds: [...new Set(batch.map((row) => row.contactId).filter((id): id is string => id !== null))] };
}

async function followUpFacts(tx: Tx, organizationId: string, eventId: string, anchor: Anchor, external: ExternalProspectActivity): Promise<FollowUpFacts | null> {
  const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, eventId));
  if (!event) return null;
  const latest = async (kind: "answered" | "stop" | "reply") =>
    (await tx.select({ at: max(eventMessages.occurredAt) }).from(eventMessages).where(and(eq(eventMessages.eventId, eventId), eq(eventMessages.kind, kind))))[0]?.at ?? null;
  const [answered, stopped, planner] = [await latest("answered"), await latest("stop"), await latest("reply")];
  const [stage] = await tx.select({ at: max(eventActivities.createdAt) }).from(eventActivities).where(and(eq(eventActivities.eventId, eventId), eq(eventActivities.kind, "stage_changed")));
  const [opened] = await tx.select({ at: max(eventLinks.lastOpenedAt) }).from(eventLinks).where(and(eq(eventLinks.eventId, eventId), eq(eventLinks.audience, "client")));
  const [answer] = await tx
    .select({ at: max(questionnaireAnswers.answeredAt) })
    .from(questionnaireAnswers)
    .innerJoin(eventQuestionnaires, eq(eventQuestionnaires.id, questionnaireAnswers.questionnaireId))
    .where(eq(eventQuestionnaires.eventId, eventId));
  const outside = await external({ organizationId, eventId, contactIds: anchor.contactIds });
  const actions = [opened?.at ?? null, answer?.at ?? null, outside].filter((date): date is Date => date !== null);
  return {
    status: event.status,
    anchorAt: anchor.at,
    lastAnsweredAt: answered,
    stoppedAt: stopped,
    lastStageChangeAt: stage?.at ?? null,
    lastProspectActionAt: actions.length > 0 ? new Date(Math.max(...actions.map((date) => date.getTime()))) : null,
    lastPlannerMessageAt: planner,
  };
}

// Le texte d'une relance : le modèle de message de son rang, sinon le texte de la nature
// « prospect_follow_up » ; variables remplies, la brochure gardée jusqu'à l'envoi.
export type FollowUpTextSource = (input: { organizationId: string; eventId: string; contactIds: string[]; step: FollowUpStep; rank: number }) => Promise<{ subject: string; body: string } | null>;

async function defaultFollowUpText(organizationId: string, step: FollowUpStep, locale: "fr" | "en"): Promise<{ subject: string; body: string }> {
  if (step.messageTemplateId) {
    const template = await getMessageTemplate(organizationId, step.messageTemplateId);
    if (template) return { subject: template.subject, body: template.body };
  }
  const template = await getEmailTemplate(organizationId, "prospect_follow_up", locale);
  return { subject: template.subject, body: template.body };
}

export { defaultFollowUpText };

export type PrepareFollowUpsResult = { prepared: number; stopped: number; sent: number };

// Prépare les relances dont le jour est venu, arrête celles qu'un fait arrête ; avec l'envoi
// automatique, envoie aussitôt celles qui le peuvent. Rejouable : une seule relance par rang et par
// envoi de la planner.
export async function prepareDueFollowUps(input: {
  organizationId: string;
  now?: Date;
  external?: ExternalProspectActivity;
  // Les destinataires (adresses des contacts) et les valeurs des variables, donnés par l'appelant qui
  // lit la fiche (getEvent, contacts du hub).
  context: ProspectContext;
  locale: "fr" | "en";
  // Lot 53 (HUB-28, D5) : sans rattrapage après une remise en route, et la trace de chaque relance.
  hooks?: AutomationHooks;
}): Promise<PrepareFollowUpsResult> {
  const now = input.now ?? new Date();
  const external = input.external ?? noExternalActivity;
  const settings = await settingsRow(input.organizationId);
  const result: PrepareFollowUpsResult = { prepared: 0, stopped: 0, sent: 0 };
  if (!settings.enabled || settings.steps.length === 0) return result;
  const candidates = await inOrganization(input.organizationId, (tx) =>
    tx
      .selectDistinct({ eventId: eventMessages.eventId })
      .from(eventMessages)
      .innerJoin(events, eq(events.id, eventMessages.eventId))
      .where(and(eq(eventMessages.kind, "reply"), eq(events.status, "option"), eq(events.isDemo, false))),
  );
  for (const { eventId } of candidates) {
    const plan = await inOrganization(input.organizationId, async (tx) => {
      const anchor = await latestAnchor(tx, eventId);
      if (!anchor) return null;
      const facts = await followUpFacts(tx, input.organizationId, eventId, anchor, external);
      if (!facts) return null;
      const reason = followUpStopReason(facts);
      if (reason) {
        result.stopped += await stopPendingFollowUps(tx, eventId, reason, now);
        return null;
      }
      const existing = await tx.select().from(prospectFollowUps).where(eq(prospectFollowUps.anchorMessageId, anchor.messageId));
      const next = nextFollowUpToPrepare(settings.steps, anchor.at, now, existing);
      return next ? { anchor, next } : null;
    });
    if (!plan) continue;
    if (plan.anchor.contactIds.length === 0) continue;
    if (input.hooks?.notBefore && plan.next.readyAt.toISOString().slice(0, 10) < input.hooks.notBefore) continue;
    const step = settings.steps[plan.next.rank - 1]!;
    const context = await input.context({ eventId, contactIds: plan.anchor.contactIds });
    if (!context) continue;
    const text = renderProspectText(await defaultFollowUpText(input.organizationId, step, input.locale), context.values);
    const inserted = await inOrganization(input.organizationId, (tx) =>
      tx
        .insert(prospectFollowUps)
        .values({
          organizationId: input.organizationId,
          eventId,
          contactId: plan.anchor.contactIds[0]!,
          anchorMessageId: plan.anchor.messageId,
          rank: plan.next.rank,
          readyAt: plan.next.readyAt,
          subject: text.subject.slice(0, PROSPECT_SUBJECT_MAX) || "—",
          body: text.body.slice(0, PROSPECT_BODY_MAX) || "—",
        })
        .onConflictDoNothing()
        .returning({ id: prospectFollowUps.id }),
    );
    if (inserted.length === 0) continue;
    result.prepared += 1;
    if (settings.autoSend) {
      // Une relance qui garde une variable vide attend la relecture de la planner.
      if (text.missing.length > 0) continue;
      const outcome = await sendProspectFollowUp({ organizationId: input.organizationId, followUpId: inserted[0]!.id, userId: null, locale: input.locale, now, external, recipients: context.recipients, values: context.values }).catch(() => null);
      if (outcome?.status === "sent") result.sent += 1;
      await input.hooks?.onRun?.({ objectKey: inserted[0]!.id, href: `/events/${eventId}`, result: outcome?.status === "sent" ? "sent" : "failed" });
      continue;
    }
    await input.hooks?.onRun?.({ objectKey: inserted[0]!.id, href: `/events/${eventId}`, result: "done" });
  }
  return result;
}

function toFollowUp(row: FollowUpRow): ProspectFollowUp {
  return {
    id: row.id,
    eventId: row.eventId,
    contactId: row.contactId,
    rank: row.rank,
    readyAt: row.readyAt.toISOString(),
    subject: row.subject,
    body: row.body,
    sentAt: row.sentAt?.toISOString() ?? null,
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
    stopReason: row.stopReason,
  };
}

export async function getProspectFollowUp(organizationId: string, followUpId: string): Promise<ProspectFollowUp | null> {
  if (!UUID.test(followUpId)) return null;
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(prospectFollowUps).where(eq(prospectFollowUps.id, followUpId)));
  return row ? toFollowUp(row) : null;
}

export async function listEventFollowUps(organizationId: string, eventId: string): Promise<ProspectFollowUp[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(prospectFollowUps).where(eq(prospectFollowUps.eventId, eventId)).orderBy(desc(prospectFollowUps.readyAt)));
  return rows.map(toFollowUp);
}

// « Aujourd'hui » : les relances prêtes, à relire (les plus anciennes d'abord).
export async function listReadyFollowUps(organizationId: string, now: Date = new Date()): Promise<ProspectFollowUp[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select()
      .from(prospectFollowUps)
      .innerJoin(events, eq(events.id, prospectFollowUps.eventId))
      .where(and(isNull(prospectFollowUps.sentAt), isNull(prospectFollowUps.stoppedAt), lte(prospectFollowUps.readyAt, now), eq(events.status, "option")))
      .orderBy(prospectFollowUps.readyAt);
    return rows.map((row) => toFollowUp(row.prospect_follow_ups));
  });
}

export type FollowUpSendOutcome = { status: "sent"; deferred: boolean } | { status: "stopped"; reason: FollowUpStopReason } | { status: "already" };

// Envoyer une relance (la planner après relecture, ou l'envoi automatique) : les faits sont revérifiés
// juste avant ; une relance arrêtée entre la préparation et l'envoi ne part pas (critère CRM-06).
export async function sendProspectFollowUp(input: {
  organizationId: string;
  followUpId: string;
  userId: string | null;
  locale: "fr" | "en";
  subject?: string;
  body?: string;
  // Les adresses des destinataires du dernier envoi, lues par l'appelant (contacts du hub).
  recipients: ProspectRecipient[];
  values: EmailValues;
  now?: Date;
  external?: ExternalProspectActivity;
}): Promise<FollowUpSendOutcome> {
  if (!UUID.test(input.followUpId)) throw new ProspectMessageInvalidError("not_found");
  const now = input.now ?? new Date();
  const external = input.external ?? noExternalActivity;
  const check = await inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx.select().from(prospectFollowUps).where(eq(prospectFollowUps.id, input.followUpId)).for("update");
    if (!row) throw new ProspectMessageInvalidError("not_found");
    if (row.sentAt) return { status: "already" as const };
    if (row.stoppedAt) return { status: "stopped" as const, reason: row.stopReason ?? ("stopped" as const) };
    const anchor = await latestAnchor(tx, row.eventId);
    if (!anchor || anchor.messageId !== row.anchorMessageId) {
      await tx.update(prospectFollowUps).set({ stoppedAt: now, stopReason: "new_message", updatedAt: now }).where(eq(prospectFollowUps.id, row.id));
      return { status: "stopped" as const, reason: "new_message" as const };
    }
    const facts = await followUpFacts(tx, input.organizationId, row.eventId, anchor, external);
    const reason = facts ? followUpStopReason(facts) : "lost";
    if (reason) {
      await tx.update(prospectFollowUps).set({ stoppedAt: now, stopReason: reason, updatedAt: now }).where(eq(prospectFollowUps.id, row.id));
      return { status: "stopped" as const, reason };
    }
    return { status: "go" as const, row, anchor };
  });
  if (check.status !== "go") return check;
  const { row } = check;
  const t = translator(input.locale);
  const text = cleanText(input.subject ?? row.subject, withOptOut(input.body ?? row.body, t("followUpOptOut")));
  const anchorContacts = new Set(check.anchor.contactIds);
  const recipients = input.recipients.filter((recipient) => anchorContacts.has(recipient.contactId));
  if (recipients.length === 0) {
    await inOrganization(input.organizationId, (tx) => tx.update(prospectFollowUps).set({ stoppedAt: now, stopReason: "no_recipient", updatedAt: now }).where(eq(prospectFollowUps.id, row.id)));
    return { status: "stopped", reason: "no_recipient" };
  }
  let brochure: { hash: string; expiresAt: Date; url: string } | null = null;
  if (usesBrochure(text.subject) || usesBrochure(text.body)) {
    const settings = await settingsRow(input.organizationId);
    if (!settings.brochureStorageKey) throw new ProspectMessageInvalidError("no_brochure");
    const secret = newLinkSecret();
    brochure = { hash: hashLinkSecret(secret), expiresAt: new Date(now.getTime() + starterProspectFollowUps().brochureLinkDays * DAY_MS), url: brochureUrl(formatLinkToken(input.organizationId, secret)) };
  }
  const final = finalText(text, { ...input.values, ...(brochure ? { brochure: brochure.url } : {}) }, input.locale);
  let deferred = false;
  for (const recipient of recipients) {
    const outcome = await sendOrganizationEmail({ organizationId: input.organizationId, to: recipient.email, kind: "prospect_follow_up", locale: input.locale, values: {}, template: final, idempotencyKey: `follow-up:${row.id}:${recipient.contactId}` });
    deferred ||= outcome.deferred;
  }
  await inOrganization(input.organizationId, async (tx) => {
    const messages = await tx
      .insert(eventMessages)
      .values(
        recipients.map((recipient, index) => ({
          organizationId: input.organizationId,
          eventId: row.eventId,
          contactId: recipient.contactId,
          kind: "follow_up" as const,
          delivery: "sent" as const,
          subject: final.subject,
          body: final.body,
          brochureTokenHash: index === 0 ? (brochure?.hash ?? null) : null,
          brochureExpiresAt: index === 0 ? (brochure?.expiresAt ?? null) : null,
          sentByUserId: input.userId,
          occurredAt: now,
        })),
      )
      .returning({ id: eventMessages.id });
    await tx.update(prospectFollowUps).set({ sentAt: now, sentMessageId: messages[0]!.id, subject: final.subject, body: final.body, updatedAt: now }).where(eq(prospectFollowUps.id, row.id));
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.follow_up.sent", objectId: row.eventId, details: { rank: row.rank, automatic: input.userId === null } });
  });
  return { status: "sent", deferred };
}

// La planner retire une relance prête : elle ne part pas ; la suivante viendra à son jour.
export async function withdrawProspectFollowUp(organizationId: string, followUpId: string, now: Date = new Date()): Promise<void> {
  if (!UUID.test(followUpId)) throw new ProspectMessageInvalidError("not_found");
  const updated = await inOrganization(organizationId, (tx) =>
    tx
      .update(prospectFollowUps)
      .set({ stoppedAt: now, stopReason: "withdrawn", updatedAt: now })
      .where(and(eq(prospectFollowUps.id, followUpId), isNull(prospectFollowUps.sentAt), isNull(prospectFollowUps.stoppedAt)))
      .returning({ id: prospectFollowUps.id }),
  );
  if (updated.length === 0) throw new ProspectMessageInvalidError("not_found");
}

// Les évènements dont un prospect a un envoi récent, pour l'écran (« dernier envoi le … »).
export async function lastPlannerMessages(organizationId: string, eventIds: string[]): Promise<Map<string, string>> {
  const ids = eventIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return new Map();
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ eventId: eventMessages.eventId, at: max(eventMessages.occurredAt) })
      .from(eventMessages)
      .where(and(inArray(eventMessages.eventId, ids), eq(eventMessages.kind, "reply")))
      .groupBy(eventMessages.eventId),
  );
  return new Map(rows.filter((row) => row.at).map((row) => [row.eventId, row.at!.toISOString()]));
}

export type { ReadyFollowUp };
