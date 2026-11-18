// Lot 45 (POR-07, CRM-09, HUB-21 ; D6 à D8 ; ADR 0090) — questionnaires du module events. Accès aux
// données et règles ; exposé seulement par service.ts (ADR 0011).
//
// - Modèles par type d'évènement, dupliquables et versionnés : enregistrer les questions fait une
//   version ; les questions d'une version ne changent plus (HUB-21).
// - Un questionnaire envoyé garde une copie figée de ses questions : modifier le modèle ne le change
//   pas.
// - La personne répond par son lien (rubrique « Questionnaires ») ; chaque réponse est enregistrée
//   aussitôt (reprise possible) ; « Terminer » prévient la planner et préremplit l'évènement : un
//   champ vide se remplit, un écart est montré à la planner, qui choisit (D7).
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { eventLinks, eventQuestionnaires, events, eventTypes, questionnaireAnswers, questionnaireTemplateItems, questionnaireTemplates } from "@symbola/db/schema/events";
import { sql } from "drizzle-orm";
import { questionnaireSensitiveWords, starterQuestionnaires } from "@symbola/starter-templates";
import type {
  EventQuestionnaire,
  PortalQuestion,
  PrefillDifference,
  QuestionEventField,
  QuestionnaireAnswerValue,
  QuestionnaireQuestion,
  QuestionnaireTemplateDetail,
  QuestionnaireTemplateSummary,
} from "@symbola/contracts";
import { cleanAnswer, cleanQuestions, isSensitiveQuestion, portalQuestions, prefillPlan, unansweredCount, type EventFieldValues, type KnownAnswer, type QuestionInput } from "./questionnaire-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type TemplateRow = typeof questionnaireTemplates.$inferSelect;
type ItemRow = typeof questionnaireTemplateItems.$inferSelect;
type QuestionnaireRow = typeof eventQuestionnaires.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QUESTIONNAIRE_NAME_MAX = 120;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class QuestionnaireNotFoundError extends Error {
  constructor() {
    super("questionnaire introuvable");
    this.name = "QuestionnaireNotFoundError";
  }
}

export class QuestionnaireTemplateInvalidError extends Error {
  constructor(readonly reason: "name" | "event_type") {
    super(`modèle de questionnaire invalide : ${reason}`);
    this.name = "QuestionnaireTemplateInvalidError";
  }
}

export class QuestionnaireClosedError extends Error {
  constructor() {
    super("questionnaire terminé");
    this.name = "QuestionnaireClosedError";
  }
}

function cleanName(name: string): string {
  const value = name.replace(/\s+/g, " ").trim();
  if (!value || value.length > QUESTIONNAIRE_NAME_MAX) throw new QuestionnaireTemplateInvalidError("name");
  return value;
}

function toQuestion(item: ItemRow): QuestionnaireQuestion {
  return { key: item.itemKey, label: item.label, help: item.help, nature: item.nature, choices: [...item.choices], eventField: item.eventField };
}

function toSummary(row: TemplateRow, questionCount: number): QuestionnaireTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    eventTypeId: row.eventTypeId,
    locale: row.locale === "en" ? "en" : "fr",
    starterKey: row.starterKey,
    version: row.version,
    questionCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function itemsOf(tx: Tx, templateId: string, version: number): Promise<ItemRow[]> {
  return tx
    .select()
    .from(questionnaireTemplateItems)
    .where(and(eq(questionnaireTemplateItems.templateId, templateId), eq(questionnaireTemplateItems.version, version)))
    .orderBy(asc(questionnaireTemplateItems.position));
}

async function insertVersion(tx: Tx, organizationId: string, templateId: string, version: number, questions: QuestionnaireQuestion[]): Promise<void> {
  await tx.insert(questionnaireTemplateItems).values(
    questions.map((question, position) => ({
      organizationId,
      templateId,
      version,
      position,
      itemKey: question.key,
      label: question.label,
      help: question.help,
      nature: question.nature,
      choices: question.choices,
      eventField: question.eventField,
    })),
  );
}

// —— Modèles (HUB-21) ————————————————————————————————————————————————————————————————————

export async function listQuestionnaireTemplates(organizationId: string): Promise<QuestionnaireTemplateSummary[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(questionnaireTemplates).orderBy(asc(questionnaireTemplates.name));
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.id, (await itemsOf(tx, row.id, row.version)).length);
    return rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
  });
}

// Pour un évènement : les modèles de son type d'abord, puis ceux de tous les évènements.
export async function questionnaireTemplatesForEventType(organizationId: string, eventTypeId: string | null): Promise<QuestionnaireTemplateSummary[]> {
  const all = await listQuestionnaireTemplates(organizationId);
  return all.filter((template) => template.eventTypeId === null || template.eventTypeId === eventTypeId).sort((a, b) => Number(b.eventTypeId !== null) - Number(a.eventTypeId !== null));
}

export async function getQuestionnaireTemplate(organizationId: string, templateId: string, version?: number): Promise<QuestionnaireTemplateDetail | null> {
  if (!UUID.test(templateId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(questionnaireTemplates).where(eq(questionnaireTemplates.id, templateId));
    if (!row) return null;
    const shown = version && version >= 1 && version <= row.version ? version : row.version;
    const items = await itemsOf(tx, row.id, shown);
    const versions = (await tx.selectDistinct({ version: questionnaireTemplateItems.version }).from(questionnaireTemplateItems).where(eq(questionnaireTemplateItems.templateId, row.id))).map((item) => item.version).sort((a, b) => b - a);
    return { ...toSummary(row, items.length), questions: items.map(toQuestion), versions };
  });
}

// Un type d'évènement de l'organisation seulement (lu sous la RLS : jamais celui d'une autre).
async function eventTypeAllowed(tx: Tx, eventTypeId: string | null): Promise<string | null> {
  if (!eventTypeId) return null;
  if (!UUID.test(eventTypeId)) throw new QuestionnaireTemplateInvalidError("event_type");
  const [found] = await tx.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.id, eventTypeId));
  if (!found) throw new QuestionnaireTemplateInvalidError("event_type");
  return eventTypeId;
}

export async function createQuestionnaireTemplate(input: { organizationId: string; name: string; eventTypeId: string | null; locale: "fr" | "en"; questions: QuestionInput[]; starterKey?: string | null }): Promise<QuestionnaireTemplateDetail> {
  const name = cleanName(input.name);
  const questions = cleanQuestions(input.questions);
  const id = await inOrganization(input.organizationId, async (tx) => {
    const eventTypeId = await eventTypeAllowed(tx, input.eventTypeId);
    const [row] = await tx.insert(questionnaireTemplates).values({ organizationId: input.organizationId, name, eventTypeId, locale: input.locale, starterKey: input.starterKey ?? null, version: 1 }).returning();
    await insertVersion(tx, input.organizationId, row!.id, 1, questions);
    return row!.id;
  });
  return (await getQuestionnaireTemplate(input.organizationId, id))!;
}

// Enregistrer : le nom et le type changent sur place ; des questions changées font une version de
// plus (les précédentes restent telles quelles). Le modèle est verrouillé le temps de numéroter.
export async function saveQuestionnaireTemplate(input: { organizationId: string; templateId: string; name: string; eventTypeId: string | null; questions: QuestionInput[] }): Promise<QuestionnaireTemplateDetail> {
  if (!UUID.test(input.templateId)) throw new QuestionnaireNotFoundError();
  const name = cleanName(input.name);
  const questions = cleanQuestions(input.questions);
  await inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx.select().from(questionnaireTemplates).where(eq(questionnaireTemplates.id, input.templateId)).for("update");
    if (!row) throw new QuestionnaireNotFoundError();
    const eventTypeId = await eventTypeAllowed(tx, input.eventTypeId);
    const current = (await itemsOf(tx, row.id, row.version)).map(toQuestion);
    const changed = JSON.stringify(current) !== JSON.stringify(questions);
    const version = changed ? row.version + 1 : row.version;
    if (changed) await insertVersion(tx, input.organizationId, row.id, version, questions);
    await tx.update(questionnaireTemplates).set({ name, eventTypeId, version, updatedAt: new Date() }).where(eq(questionnaireTemplates.id, row.id));
  });
  return (await getQuestionnaireTemplate(input.organizationId, input.templateId))!;
}

export async function duplicateQuestionnaireTemplate(input: { organizationId: string; templateId: string; name: string }): Promise<QuestionnaireTemplateDetail> {
  const source = await getQuestionnaireTemplate(input.organizationId, input.templateId);
  if (!source) throw new QuestionnaireNotFoundError();
  return createQuestionnaireTemplate({ organizationId: input.organizationId, name: input.name.slice(0, QUESTIONNAIRE_NAME_MAX), eventTypeId: source.eventTypeId, locale: source.locale, questions: source.questions });
}

// Retirer un modèle : les questionnaires déjà envoyés gardent leur copie (HUB-21).
export async function deleteQuestionnaireTemplate(organizationId: string, templateId: string): Promise<void> {
  if (!UUID.test(templateId)) throw new QuestionnaireNotFoundError();
  const removed = await inOrganization(organizationId, (tx) => tx.delete(questionnaireTemplates).where(eq(questionnaireTemplates.id, templateId)).returning({ id: questionnaireTemplates.id }));
  if (removed.length === 0) throw new QuestionnaireNotFoundError();
}

// Les questionnaires de départ, dans la langue de l'écran ; un modèle de départ déjà ajouté ne l'est
// pas deux fois.
export async function addStarterQuestionnaires(organizationId: string, locale: "fr" | "en"): Promise<number> {
  const existing = new Set((await listQuestionnaireTemplates(organizationId)).map((template) => template.starterKey).filter(Boolean));
  let added = 0;
  for (const starter of starterQuestionnaires(locale)) {
    if (existing.has(starter.key)) continue;
    await createQuestionnaireTemplate({ organizationId, name: starter.name, eventTypeId: null, locale, starterKey: starter.key, questions: starter.questions });
    added += 1;
  }
  return added;
}

// DPO : les questions d'un modèle qui touchent à la santé, à la religion ou aux opinions.
export function sensitiveQuestionKeys(questions: QuestionnaireQuestion[], locale: "fr" | "en"): string[] {
  const words = [...questionnaireSensitiveWords("fr"), ...questionnaireSensitiveWords("en")];
  void locale;
  return questions.filter((question) => isSensitiveQuestion(`${question.label} ${question.help ?? ""}`, words)).map((question) => question.key);
}

// —— Questionnaires envoyés ———————————————————————————————————————————————————————————————

function toQuestionnaire(row: QuestionnaireRow, answers: (typeof questionnaireAnswers.$inferSelect)[]): EventQuestionnaire {
  return {
    id: row.id,
    eventId: row.eventId,
    contactId: row.contactId,
    name: row.name,
    locale: row.locale === "en" ? "en" : "fr",
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    questions: row.questions,
    answers: Object.fromEntries(answers.filter((answer) => answer.questionnaireId === row.id).map((answer) => [answer.itemKey, { value: answer.value, answeredAt: answer.answeredAt.toISOString() }])),
    sentAt: row.sentAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

// La copie figée du modèle, à l'envoi : sa version en cours, ses questions telles quelles.
export async function freezeQuestionnaire(organizationId: string, templateId: string): Promise<{ templateId: string; version: number; name: string; locale: "fr" | "en"; questions: QuestionnaireQuestion[] }> {
  const template = await getQuestionnaireTemplate(organizationId, templateId);
  if (!template || template.questions.length === 0) throw new QuestionnaireNotFoundError();
  return { templateId: template.id, version: template.version, name: template.name, locale: template.locale, questions: template.questions };
}

export async function insertEventQuestionnaire(input: {
  organizationId: string;
  eventId: string;
  contactId: string | null;
  linkId: string;
  frozen: { templateId: string; version: number; name: string; locale: "fr" | "en"; questions: QuestionnaireQuestion[] };
  now: Date;
}): Promise<string> {
  const [row] = await inOrganization(input.organizationId, (tx) =>
    tx
      .insert(eventQuestionnaires)
      .values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        contactId: input.contactId,
        linkId: input.linkId,
        templateId: input.frozen.templateId,
        templateVersion: input.frozen.version,
        name: input.frozen.name,
        locale: input.frozen.locale,
        questions: input.frozen.questions,
        sentAt: input.now,
      })
      .returning({ id: eventQuestionnaires.id }),
  );
  return row!.id;
}

export async function listEventQuestionnaires(organizationId: string, eventId: string): Promise<EventQuestionnaire[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(eventQuestionnaires).where(eq(eventQuestionnaires.eventId, eventId)).orderBy(desc(eventQuestionnaires.sentAt));
    const answers = rows.length > 0 ? await tx.select().from(questionnaireAnswers).where(inArray(questionnaireAnswers.questionnaireId, rows.map((row) => row.id))) : [];
    return rows.map((row) => toQuestionnaire(row, answers));
  });
}

// La rubrique « Questionnaires » s'ouvre sur le lien à l'envoi d'un questionnaire (POR-10 : fermée
// par défaut).
export async function openQuestionnaireRubric(organizationId: string, linkId: string): Promise<void> {
  await inOrganization(organizationId, (tx) =>
    tx
      .update(eventLinks)
      .set({ rubrics: sql`array_append(${eventLinks.rubrics}, 'questionnaires')` })
      .where(and(eq(eventLinks.id, linkId), sql`not ('questionnaires' = any(${eventLinks.rubrics}))`)),
  );
}

// —— Côté lien personnel (POR-07) ————————————————————————————————————————————————————————

// Les questionnaires du lien : seulement ceux de son évènement, envoyés à ce lien.
export async function listLinkQuestionnaires(organizationId: string, eventId: string, linkId: string): Promise<EventQuestionnaire[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .select()
      .from(eventQuestionnaires)
      .where(and(eq(eventQuestionnaires.eventId, eventId), eq(eventQuestionnaires.linkId, linkId)))
      .orderBy(desc(eventQuestionnaires.sentAt));
    const answers = rows.length > 0 ? await tx.select().from(questionnaireAnswers).where(inArray(questionnaireAnswers.questionnaireId, rows.map((row) => row.id))) : [];
    return rows.map((row) => toQuestionnaire(row, answers));
  });
}

async function linkQuestionnaireRow(tx: Tx, eventId: string, linkId: string, questionnaireId: string): Promise<QuestionnaireRow> {
  if (!UUID.test(questionnaireId)) throw new QuestionnaireNotFoundError();
  const [row] = await tx
    .select()
    .from(eventQuestionnaires)
    .where(and(eq(eventQuestionnaires.id, questionnaireId), eq(eventQuestionnaires.eventId, eventId), eq(eventQuestionnaires.linkId, linkId)));
  if (!row) throw new QuestionnaireNotFoundError();
  return row;
}

// Les réponses déjà données dans les autres questionnaires de l'évènement (jamais redemandées).
async function answersElsewhere(tx: Tx, eventId: string, exceptId: string): Promise<KnownAnswer[]> {
  const others = await tx.select().from(eventQuestionnaires).where(and(eq(eventQuestionnaires.eventId, eventId), ne(eventQuestionnaires.id, exceptId)));
  if (others.length === 0) return [];
  const answers = await tx.select().from(questionnaireAnswers).where(inArray(questionnaireAnswers.questionnaireId, others.map((row) => row.id)));
  return answers.map((answer) => {
    const question = others.find((row) => row.id === answer.questionnaireId)?.questions.find((item) => item.key === answer.itemKey);
    return { key: answer.itemKey, eventField: question?.eventField ?? null, value: answer.value };
  });
}

export type PortalQuestionnaireView = { id: string; name: string; finishedAt: string | null; questions: PortalQuestion[]; remaining: number };

export async function getPortalQuestionnaire(input: { organizationId: string; eventId: string; linkId: string; questionnaireId: string; eventValues: EventFieldValues }): Promise<PortalQuestionnaireView> {
  return inOrganization(input.organizationId, async (tx) => {
    const row = await linkQuestionnaireRow(tx, input.eventId, input.linkId, input.questionnaireId);
    const own = await tx.select().from(questionnaireAnswers).where(eq(questionnaireAnswers.questionnaireId, row.id));
    const view = portalQuestions(row.questions, new Map(own.map((answer) => [answer.itemKey, answer.value])), await answersElsewhere(tx, input.eventId, row.id), input.eventValues);
    return { id: row.id, name: row.name, finishedAt: row.finishedAt?.toISOString() ?? null, questions: view, remaining: unansweredCount(view) };
  });
}

// POR-07 — enregistrement à chaque réponse : la réponse remplace la précédente ; vide, elle s'efface.
// Un questionnaire terminé ne se modifie plus (la planner en envoie un autre si besoin).
export async function saveLinkAnswer(input: { organizationId: string; eventId: string; linkId: string; questionnaireId: string; key: string; value: string | string[] | null; now?: Date }): Promise<QuestionnaireAnswerValue | null> {
  const now = input.now ?? new Date();
  return inOrganization(input.organizationId, async (tx) => {
    const row = await linkQuestionnaireRow(tx, input.eventId, input.linkId, input.questionnaireId);
    if (row.finishedAt) throw new QuestionnaireClosedError();
    const question = row.questions.find((item) => item.key === input.key);
    if (!question) throw new QuestionnaireNotFoundError();
    const value = cleanAnswer(question, input.value);
    if (value === null) {
      await tx.delete(questionnaireAnswers).where(and(eq(questionnaireAnswers.questionnaireId, row.id), eq(questionnaireAnswers.itemKey, question.key)));
      return null;
    }
    await tx
      .insert(questionnaireAnswers)
      .values({ organizationId: input.organizationId, questionnaireId: row.id, itemKey: question.key, value, answeredAt: now })
      .onConflictDoUpdate({ target: [questionnaireAnswers.questionnaireId, questionnaireAnswers.itemKey], set: { value, answeredAt: now, resolution: null, updatedAt: now } });
    return value;
  });
}

// « Terminer » : le questionnaire se ferme ; la planner est prévenue (« Aujourd'hui »).
export async function finishLinkQuestionnaire(input: { organizationId: string; eventId: string; linkId: string; questionnaireId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await inOrganization(input.organizationId, async (tx) => {
    const row = await linkQuestionnaireRow(tx, input.eventId, input.linkId, input.questionnaireId);
    if (row.finishedAt) return;
    await tx.update(eventQuestionnaires).set({ finishedAt: now, updatedAt: now }).where(eq(eventQuestionnaires.id, row.id));
  });
}

// —— Préremplissage (CRM-09 ; D7) ————————————————————————————————————————————————————————

export type PrefillWork = { eventId: string; fill: { questionnaireId: string; key: string; eventField: QuestionEventField; value: QuestionnaireAnswerValue }[]; same: { questionnaireId: string; key: string }[] };

// Les réponses non réglées d'un évènement, des questionnaires terminés : ce qui remplit un champ vide,
// ce qui est égal à la fiche, et les écarts (montrés à la planner).
export async function eventPrefillState(organizationId: string, eventId: string, eventValues: EventFieldValues): Promise<{ work: PrefillWork; differences: PrefillDifference[] }> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(eventQuestionnaires).where(and(eq(eventQuestionnaires.eventId, eventId), isNotNull(eventQuestionnaires.finishedAt))).orderBy(asc(eventQuestionnaires.finishedAt));
    const answers = rows.length > 0 ? await tx.select().from(questionnaireAnswers).where(and(inArray(questionnaireAnswers.questionnaireId, rows.map((row) => row.id)), isNull(questionnaireAnswers.resolution))) : [];
    const items = answers.flatMap((answer) => {
      const row = rows.find((candidate) => candidate.id === answer.questionnaireId)!;
      const question = row.questions.find((item) => item.key === answer.itemKey);
      return question?.eventField ? [{ questionnaireId: row.id, key: answer.itemKey, label: question.label, eventField: question.eventField, value: answer.value, resolution: null }] : [];
    });
    const plan = prefillPlan(items.map((item) => ({ ...item, key: `${item.questionnaireId}:${item.key}` })), eventValues);
    const split = (compound: string) => ({ questionnaireId: compound.slice(0, 36), key: compound.slice(37) });
    return {
      work: { eventId, fill: plan.fill.map((fill) => ({ ...split(fill.key), eventField: fill.eventField, value: fill.value })), same: plan.same.map(split) },
      differences: plan.differences.map((difference) => ({ ...split(difference.key), label: difference.label, eventField: difference.eventField, answer: difference.answer, current: difference.current })),
    };
  });
}

export async function markAnswersResolved(organizationId: string, answers: { questionnaireId: string; key: string }[], resolution: "filled" | "applied" | "kept"): Promise<void> {
  if (answers.length === 0) return;
  await inOrganization(organizationId, async (tx) => {
    for (const answer of answers) {
      if (!UUID.test(answer.questionnaireId)) continue;
      await tx.update(questionnaireAnswers).set({ resolution, updatedAt: new Date() }).where(and(eq(questionnaireAnswers.questionnaireId, answer.questionnaireId), eq(questionnaireAnswers.itemKey, answer.key)));
    }
  });
}

// La réponse d'un écart, pour l'appliquer (la planner a choisi la réponse).
export async function findResolvableAnswer(organizationId: string, questionnaireId: string, key: string): Promise<{ eventId: string; eventField: QuestionEventField; value: QuestionnaireAnswerValue } | null> {
  if (!UUID.test(questionnaireId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(eventQuestionnaires).where(eq(eventQuestionnaires.id, questionnaireId));
    if (!row) return null;
    const question = row.questions.find((item) => item.key === key);
    const [answer] = await tx.select().from(questionnaireAnswers).where(and(eq(questionnaireAnswers.questionnaireId, questionnaireId), eq(questionnaireAnswers.itemKey, key), isNull(questionnaireAnswers.resolution)));
    if (!question?.eventField || !answer) return null;
    return { eventId: row.eventId, eventField: question.eventField, value: answer.value };
  });
}

// « Aujourd'hui » : les questionnaires terminés que la planner n'a pas encore vus.
export async function listFinishedUnseenQuestionnaires(organizationId: string): Promise<{ id: string; eventId: string; name: string; finishedAt: string }[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ id: eventQuestionnaires.id, eventId: eventQuestionnaires.eventId, name: eventQuestionnaires.name, finishedAt: eventQuestionnaires.finishedAt })
      .from(eventQuestionnaires)
      .innerJoin(events, eq(events.id, eventQuestionnaires.eventId))
      .where(and(isNotNull(eventQuestionnaires.finishedAt), isNull(eventQuestionnaires.seenAt)))
      .orderBy(asc(eventQuestionnaires.finishedAt)),
  );
  return rows.map((row) => ({ id: row.id, eventId: row.eventId, name: row.name, finishedAt: row.finishedAt!.toISOString() }));
}

export async function markEventQuestionnairesSeen(organizationId: string, eventId: string, now: Date = new Date()): Promise<void> {
  if (!UUID.test(eventId)) return;
  await inOrganization(organizationId, (tx) =>
    tx.update(eventQuestionnaires).set({ seenAt: now, updatedAt: now }).where(and(eq(eventQuestionnaires.eventId, eventId), isNotNull(eventQuestionnaires.finishedAt), isNull(eventQuestionnaires.seenAt))),
  );
}
