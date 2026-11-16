// Lot 38b (HUB-21 ; D10 ; ADR 0072) — modèles de messages de la planner (« Réponse à une première
// demande », « Proposer un rendez-vous »…), pour tous les évènements ou pour un type d'évènement,
// dans une langue. Chaque enregistrement d'un texte changé fait une version ; une version ne se
// modifie pas ; restaurer une version en fait une nouvelle. Duplicables. « Écrire au client » en
// remplit les variables (aucune variable vide) puis ouvre la messagerie de la planner : Symbola
// n'envoie rien. Exposé seulement par service.ts (ADR 0011).
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { messageTemplates, messageTemplateVersions } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import type { EmailLocale, EmailTemplateText, EmailValues, MessageTemplateDetail, MessageTemplateSummary } from "@symbola/contracts";
import { starterMessageTemplates } from "@symbola/starter-templates";
import { renderMessageTemplate, validateMessageTemplate, type EmailTemplateProblems, type RenderedMessage } from "./email-template-rules";

export const MESSAGE_TEMPLATE_NAME_MAX = 120;

export class MessageTemplateInvalidError extends Error {
  constructor(readonly problems: EmailTemplateProblems & { empty: ("name" | "subject" | "body")[]; nameTooLong: boolean }) {
    super("modèle de message invalide");
    this.name = "MessageTemplateInvalidError";
  }
}

export class MessageTemplateNotFoundError extends Error {
  constructor() {
    super("modèle de message introuvable");
    this.name = "MessageTemplateNotFoundError";
  }
}

type TemplateRow = typeof messageTemplates.$inferSelect;
type VersionRow = typeof messageTemplateVersions.$inferSelect;

function toSummary(row: TemplateRow): MessageTemplateSummary {
  return { id: row.id, name: row.name, eventTypeId: row.eventTypeId, locale: row.locale === "en" ? "en" : "fr", version: row.version, updatedAt: row.updatedAt.toISOString() };
}

function toDetail(row: TemplateRow, versions: VersionRow[]): MessageTemplateDetail {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const current = sorted.find((version) => version.version === row.version) ?? sorted[0];
  return {
    ...toSummary(row),
    subject: current?.subject ?? "",
    body: current?.body ?? "",
    versions: sorted.map((version) => ({ version: version.version, subject: version.subject, body: version.body, createdAt: version.createdAt.toISOString() })),
  };
}

type Input = { name: string; eventTypeId: string | null; subject: string; body: string };

// Nom, objet et texte nettoyés, puis contrôlés : rien de vide, aucune variable inconnue, longueurs.
function cleanInput(input: Input): Input {
  const clean = { name: input.name.trim(), eventTypeId: input.eventTypeId, subject: input.subject.trim(), body: input.body.replace(/\r\n/g, "\n").trim() };
  const problems = validateMessageTemplate(clean);
  const empty = (["name", "subject", "body"] as const).filter((field) => !clean[field]);
  const nameTooLong = clean.name.length > MESSAGE_TEMPLATE_NAME_MAX;
  if (empty.length > 0 || nameTooLong || problems.unknown.length > 0 || problems.tooLong.length > 0) throw new MessageTemplateInvalidError({ ...problems, empty: [...empty], nameTooLong });
  return clean;
}

export async function listMessageTemplates(organizationId: string): Promise<MessageTemplateSummary[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(messageTemplates).orderBy(asc(messageTemplates.name)));
  return rows.map(toSummary);
}

export async function getMessageTemplate(organizationId: string, templateId: string): Promise<MessageTemplateDetail | null> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx.select().from(messageTemplates).where(eq(messageTemplates.id, templateId));
    if (!row) return null;
    const versions = await tx.select().from(messageTemplateVersions).where(eq(messageTemplateVersions.templateId, templateId)).orderBy(desc(messageTemplateVersions.version));
    return toDetail(row, versions);
  });
}

export async function createMessageTemplate(input: Input & { organizationId: string; locale: EmailLocale }): Promise<MessageTemplateDetail> {
  const clean = cleanInput(input);
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [row] = await tx.insert(messageTemplates).values({ organizationId: input.organizationId, name: clean.name, eventTypeId: clean.eventTypeId, locale: input.locale, version: 1 }).returning();
    const [version] = await tx.insert(messageTemplateVersions).values({ organizationId: input.organizationId, templateId: row!.id, version: 1, subject: clean.subject, body: clean.body }).returning();
    return toDetail(row!, [version!]);
  });
}

// Enregistrer : le nom et le type changent sur place ; un objet ou un texte changé fait une version
// de plus (la précédente reste, telle quelle). Le modèle est verrouillé le temps de numéroter.
export async function saveMessageTemplate(input: Input & { organizationId: string; templateId: string }): Promise<MessageTemplateDetail> {
  const clean = cleanInput(input);
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [row] = await tx.select().from(messageTemplates).where(eq(messageTemplates.id, input.templateId)).for("update");
    if (!row) throw new MessageTemplateNotFoundError();
    const [current] = await tx
      .select()
      .from(messageTemplateVersions)
      .where(and(eq(messageTemplateVersions.templateId, row.id), eq(messageTemplateVersions.version, row.version)));
    const changed = !current || current.subject !== clean.subject || current.body !== clean.body;
    const version = changed ? row.version + 1 : row.version;
    if (changed) await tx.insert(messageTemplateVersions).values({ organizationId: input.organizationId, templateId: row.id, version, subject: clean.subject, body: clean.body });
    await tx.update(messageTemplates).set({ name: clean.name, eventTypeId: clean.eventTypeId, version, updatedAt: new Date() }).where(eq(messageTemplates.id, row.id));
    const [updated] = await tx.select().from(messageTemplates).where(eq(messageTemplates.id, row.id));
    const versions = await tx.select().from(messageTemplateVersions).where(eq(messageTemplateVersions.templateId, row.id));
    return toDetail(updated!, versions);
  });
}

// Restaurer une version : son texte devient une version de plus ; l'historique ne se réécrit pas.
export async function restoreMessageTemplateVersion(input: { organizationId: string; templateId: string; version: number }): Promise<MessageTemplateDetail> {
  const detail = await getMessageTemplate(input.organizationId, input.templateId);
  const restored = detail?.versions.find((version) => version.version === input.version);
  if (!detail || !restored) throw new MessageTemplateNotFoundError();
  return saveMessageTemplate({ organizationId: input.organizationId, templateId: input.templateId, name: detail.name, eventTypeId: detail.eventTypeId, subject: restored.subject, body: restored.body });
}

// Dupliquer : un modèle nouveau, en version 1, avec le texte en cours ; le nom est donné par l'écran.
export async function duplicateMessageTemplate(input: { organizationId: string; templateId: string; name: string }): Promise<MessageTemplateDetail> {
  const detail = await getMessageTemplate(input.organizationId, input.templateId);
  if (!detail) throw new MessageTemplateNotFoundError();
  return createMessageTemplate({ organizationId: input.organizationId, locale: detail.locale, name: input.name.slice(0, MESSAGE_TEMPLATE_NAME_MAX), eventTypeId: detail.eventTypeId, subject: detail.subject, body: detail.body });
}

export async function deleteMessageTemplate(organizationId: string, templateId: string): Promise<void> {
  const removed = await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(messageTemplates).where(eq(messageTemplates.id, templateId)).returning({ id: messageTemplates.id }));
  if (removed.length === 0) throw new MessageTemplateNotFoundError();
}

// Les deux modèles de départ, dans la langue de l'écran ; ceux dont le nom existe déjà ne sont pas
// ajoutés une seconde fois.
export async function addStarterMessageTemplates(organizationId: string, locale: EmailLocale): Promise<number> {
  const existing = new Set((await listMessageTemplates(organizationId)).map((template) => template.name));
  let added = 0;
  for (const starter of starterMessageTemplates(locale)) {
    if (existing.has(starter.name)) continue;
    await createMessageTemplate({ organizationId, locale, name: starter.name, eventTypeId: null, subject: starter.subject, body: starter.body });
    added += 1;
  }
  return added;
}

// Les modèles proposés pour un évènement : ceux de son type d'abord, puis ceux de tous les
// évènements ; jamais ceux d'un autre type.
export async function messageTemplatesForEventType(organizationId: string, eventTypeId: string | null): Promise<MessageTemplateSummary[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(messageTemplates)
      .where(eventTypeId ? or(eq(messageTemplates.eventTypeId, eventTypeId), isNull(messageTemplates.eventTypeId)) : isNull(messageTemplates.eventTypeId))
      .orderBy(asc(messageTemplates.name)),
  );
  return rows.map(toSummary).sort((a, b) => Number(b.eventTypeId !== null) - Number(a.eventTypeId !== null));
}

// Le texte en cours d'un modèle, rempli ; « missing » nomme chaque variable sans valeur.
export async function renderMessageForTemplate(organizationId: string, templateId: string, values: EmailValues): Promise<(RenderedMessage & { template: MessageTemplateDetail }) | null> {
  const template = await getMessageTemplate(organizationId, templateId);
  if (!template) return null;
  const text: EmailTemplateText = { subject: template.subject, body: template.body };
  return { ...renderMessageTemplate(text, values), template };
}
