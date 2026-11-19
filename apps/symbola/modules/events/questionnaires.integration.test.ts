// Lot 45 (POR-07, CRM-09, HUB-21 ; D6 à D8 ; ADR 0090) — questionnaires, contre un vrai PostgreSQL
// (RLS) : modèles de départ, versions, copie figée à l'envoi, lien du client créé ou renouvelé avec la
// rubrique « Questionnaires », enregistrement à chaque réponse et reprise, préremplissage (champ vide
// rempli, écart montré, choix de la planner), réponse jamais redemandée, isolation (SEC-36).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { eq } from "drizzle-orm";
import {
  addStarterQuestionnaires,
  AnswerInvalidError,
  answerQuestionnaireOfLink,
  createProspect,
  createProspectSource,
  createQuestionnaireTemplate,
  finishQuestionnaireOfLink,
  getEvent,
  getQuestionnaireOfLink,
  getQuestionnaireTemplate,
  listEventLinks,
  listEventMessages,
  listEventQuestionnaires,
  listFinishedUnseenQuestionnaires,
  listQuestionnaireDifferences,
  listQuestionnaireTemplates,
  listQuestionnairesOfLink,
  QuestionnaireClosedError,
  QuestionnaireNotFoundError,
  QuestionnaireTemplateInvalidError,
  resolveQuestionnaireDifference,
  saveQuestionnaireTemplate,
  sendEventQuestionnaire,
  sensitiveQuestionKeys,
  setEventIdentity,
} from "./service";

const plannerId = randomUUID();

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Atelier ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function prospect(organizationId: string, overrides: { eventDate?: string | null } = {}) {
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Léa", lastName: "Martin", email: `lea.${randomUUID().slice(0, 8)}@example.test` }],
    eventDate: overrides.eventDate === undefined ? null : overrides.eventDate,
  });
  const event = await getEvent(organizationId, eventId);
  return { eventId, clientId: event!.clients[0]!.id };
}

async function discovery(organizationId: string): Promise<string> {
  await addStarterQuestionnaires(organizationId, "fr");
  return (await listQuestionnaireTemplates(organizationId)).find((template) => template.starterKey === "discovery")!.id;
}

async function sent(organizationId: string) {
  const { eventId, clientId } = await prospect(organizationId);
  const templateId = await discovery(organizationId);
  const { questionnaireId, linkId } = await sendEventQuestionnaire({ organizationId, eventId, eventClientId: clientId, templateId, userId: plannerId, locale: "fr" });
  return { eventId, clientId, templateId, questionnaireId, scope: { organizationId, eventId, linkId } };
}

describe("HUB-21 — Modèles de questionnaires duplicables et versionnés", () => {
  it("les quatre questionnaires de départ s'ajoutent une fois", async () => {
    const organizationId = await organization();
    expect(await addStarterQuestionnaires(organizationId, "fr")).toBe(4);
    expect(await addStarterQuestionnaires(organizationId, "fr")).toBe(0);
    expect((await listQuestionnaireTemplates(organizationId)).map((template) => template.name).sort()).toEqual(["Cérémonie", "Découverte", "Détails pratiques", "Musiques"]);
  });

  it("enregistrer des questions changées fait une version ; la précédente reste lisible telle quelle", async () => {
    const organizationId = await organization();
    const created = await createQuestionnaireTemplate({ organizationId, name: "Musiques", eventTypeId: null, locale: "fr", questions: [{ key: "dance", label: "Première danse", nature: "short_text" }] });
    expect(created.version).toBe(1);
    const saved = await saveQuestionnaireTemplate({ organizationId, templateId: created.id, name: "Musiques", eventTypeId: null, questions: [{ key: "dance", label: "Titre de la première danse", nature: "short_text" }] });
    expect(saved.version).toBe(2);
    expect(saved.versions).toEqual([2, 1]);
    expect((await getQuestionnaireTemplate(organizationId, created.id, 1))!.questions[0]!.label).toBe("Première danse");
    // Le seul nom changé ne fait pas de version.
    expect((await saveQuestionnaireTemplate({ organizationId, templateId: created.id, name: "Playlist", eventTypeId: null, questions: saved.questions })).version).toBe(2);
  });

  it("un type d'évènement d'une autre organisation est refusé", async () => {
    const organizationId = await organization();
    await expect(createQuestionnaireTemplate({ organizationId, name: "X", eventTypeId: randomUUID(), locale: "fr", questions: [{ label: "Q", nature: "short_text" }] })).rejects.toThrow(QuestionnaireTemplateInvalidError);
  });

  it("DPO : une question sur la santé est signalée à la planner", async () => {
    expect(sensitiveQuestionKeys([{ key: "a", label: "Avez-vous des allergies ?", help: null, nature: "short_text", choices: [], eventField: null }], "fr")).toEqual(["a"]);
  });
});

describe("POR-07 — Questionnaires envoyés par le lien du client", () => {
  it("l'envoi crée le lien du client avec la seule rubrique « Questionnaires », range l'envoi dans l'historique et le journal", async () => {
    const organizationId = await organization();
    const { eventId, scope } = await sent(organizationId);
    const [link] = await listEventLinks(organizationId, eventId);
    expect(link).toMatchObject({ id: scope.linkId, audience: "client" });
    expect(link!.rights.rubrics).toEqual(["questionnaires"]);
    expect((await listEventMessages(organizationId, eventId))[0]).toMatchObject({ kind: "questionnaire", subject: "Découverte" });
    const { sql, db } = createAppConnection();
    try {
      expect(await withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "events.questionnaire.sent")))).toHaveLength(1);
    } finally {
      await sql.end();
    }
  });

  it("un second envoi reprend le même lien (jeton renouvelé) et y ajoute la rubrique", async () => {
    const organizationId = await organization();
    const { eventId, clientId, scope } = await sent(organizationId);
    await addStarterQuestionnaires(organizationId, "fr");
    const music = (await listQuestionnaireTemplates(organizationId)).find((template) => template.starterKey === "music")!.id;
    const second = await sendEventQuestionnaire({ organizationId, eventId, eventClientId: clientId, templateId: music, userId: plannerId, locale: "fr" });
    expect(second.linkId).toBe(scope.linkId);
    expect(await listEventLinks(organizationId, eventId)).toHaveLength(1);
    expect((await listQuestionnairesOfLink(scope)).map((questionnaire) => questionnaire.name)).toEqual(["Musiques", "Découverte"]);
  });

  it("chaque réponse est enregistrée aussitôt ; la personne reprend plus tard là où elle s'était arrêtée", async () => {
    const organizationId = await organization();
    const { questionnaireId, scope } = await sent(organizationId);
    await answerQuestionnaireOfLink(scope, questionnaireId, "guests", "140");
    await answerQuestionnaireOfLink(scope, questionnaireId, "city", "Mâcon");
    // Plus tard, une autre session : les réponses sont là.
    const view = await getQuestionnaireOfLink(scope, questionnaireId);
    expect(view.questions.find((question) => question.key === "guests")!.answer).toBe(140);
    expect(view.questions.find((question) => question.key === "city")!.answer).toBe("Mâcon");
    expect(view.remaining).toBe(view.questions.length - 2);
    // Une réponse effacée s'efface ; une réponse hors des choix est refusée.
    await answerQuestionnaireOfLink(scope, questionnaireId, "city", "");
    expect((await getQuestionnaireOfLink(scope, questionnaireId)).questions.find((question) => question.key === "city")!.answer).toBeNull();
    await expect(answerQuestionnaireOfLink(scope, questionnaireId, "style", "Gothique")).rejects.toThrow(AnswerInvalidError);
  });

  it("« Terminer » prévient la planner ; le questionnaire terminé ne se modifie plus", async () => {
    const organizationId = await organization();
    const { questionnaireId, scope } = await sent(organizationId);
    await answerQuestionnaireOfLink(scope, questionnaireId, "guests", "90");
    await finishQuestionnaireOfLink(scope, questionnaireId);
    expect((await listFinishedUnseenQuestionnaires(organizationId)).map((item) => item.id)).toEqual([questionnaireId]);
    await expect(answerQuestionnaireOfLink(scope, questionnaireId, "guests", "100")).rejects.toThrow(QuestionnaireClosedError);
  });
});

describe("CRM-09 — Les réponses préremplissent l'évènement ; aucune n'est redemandée (D7)", () => {
  it("un champ vide se remplit ; un champ rempli montre l'écart ; la planner choisit", async () => {
    const organizationId = await organization();
    const { eventId, questionnaireId, scope } = await sent(organizationId);
    const event = await getEvent(organizationId, eventId);
    await setEventIdentity(organizationId, eventId, { guestsEstimated: 120, guestsConfirmed: null, style: event!.style, notes: event!.notes });
    await answerQuestionnaireOfLink(scope, questionnaireId, "event_date", "2027-06-12");
    await answerQuestionnaireOfLink(scope, questionnaireId, "guests", "140");
    await answerQuestionnaireOfLink(scope, questionnaireId, "budget", "25 000");
    const result = await finishQuestionnaireOfLink(scope, questionnaireId);
    expect(result).toEqual({ filled: 2, differences: 1 });
    expect(await getEvent(organizationId, eventId)).toMatchObject({ eventDate: "2027-06-12", wantedBudgetCents: 2_500_000, guestsEstimated: 120 });
    const [difference] = await listQuestionnaireDifferences(organizationId, eventId);
    expect(difference).toMatchObject({ key: "guests", eventField: "guests", answer: 140, current: 120 });
    await resolveQuestionnaireDifference({ organizationId, eventId, questionnaireId, key: "guests", choice: "answer" });
    expect((await getEvent(organizationId, eventId))!.guestsEstimated).toBe(140);
    expect(await listQuestionnaireDifferences(organizationId, eventId)).toEqual([]);
  });

  it("la planner garde la fiche : l'écart disparaît, la fiche ne change pas", async () => {
    const organizationId = await organization();
    const { eventId, questionnaireId, scope } = await sent(organizationId);
    await setEventIdentity(organizationId, eventId, { guestsEstimated: 120, guestsConfirmed: null, style: null, notes: null });
    await answerQuestionnaireOfLink(scope, questionnaireId, "guests", "140");
    await finishQuestionnaireOfLink(scope, questionnaireId);
    await resolveQuestionnaireDifference({ organizationId, eventId, questionnaireId, key: "guests", choice: "event" });
    expect((await getEvent(organizationId, eventId))!.guestsEstimated).toBe(120);
    expect(await listQuestionnaireDifferences(organizationId, eventId)).toEqual([]);
  });

  it("une question liée à un champ déjà rempli est proposée pré-remplie ; une question déjà répondue ailleurs n'est pas reposée", async () => {
    const organizationId = await organization();
    const { eventId, clientId } = await prospect(organizationId, { eventDate: "2027-09-04" });
    const templateId = await discovery(organizationId);
    const first = await sendEventQuestionnaire({ organizationId, eventId, eventClientId: clientId, templateId, userId: plannerId, locale: "fr" });
    const scope = { organizationId, eventId, linkId: first.linkId };
    const view = await getQuestionnaireOfLink(scope, first.questionnaireId);
    expect(view.questions.find((question) => question.key === "event_date")).toMatchObject({ suggestion: "2027-09-04", answer: null });
    await answerQuestionnaireOfLink(scope, first.questionnaireId, "guests", "80");
    const extra = await createQuestionnaireTemplate({ organizationId, name: "Compléments", eventTypeId: null, locale: "fr", questions: [{ key: "how-many", label: "Combien serez-vous ?", nature: "number", eventField: "guests" }, { key: "dance", label: "Première danse ?", nature: "short_text" }] });
    const second = await sendEventQuestionnaire({ organizationId, eventId, eventClientId: clientId, templateId: extra.id, userId: plannerId, locale: "fr" });
    const secondView = await getQuestionnaireOfLink({ ...scope, linkId: second.linkId }, second.questionnaireId);
    expect(secondView.questions.find((question) => question.key === "how-many")).toMatchObject({ answeredElsewhere: true });
    expect(secondView.remaining).toBe(1);
  });

  it("HUB-21 : modifier le modèle ne change pas un questionnaire déjà envoyé", async () => {
    const organizationId = await organization();
    const { eventId, templateId, questionnaireId } = await sent(organizationId);
    const template = (await getQuestionnaireTemplate(organizationId, templateId))!;
    await saveQuestionnaireTemplate({ organizationId, templateId, name: template.name, eventTypeId: null, questions: [{ key: "only", label: "Une seule question", nature: "short_text" }] });
    const [questionnaire] = await listEventQuestionnaires(organizationId, eventId);
    expect(questionnaire!.id).toBe(questionnaireId);
    expect(questionnaire!.templateVersion).toBe(1);
    expect(questionnaire!.questions.map((question) => question.key)).toEqual(template.questions.map((question) => question.key));
  });
});

describe("SEC-36 — Questionnaires : isolation et liens", () => {
  it("le lien d'un autre évènement n'ouvre pas le questionnaire ; l'organisation B ne le lit pas", async () => {
    const a = await organization();
    const b = await organization();
    const first = await sent(a);
    const other = await sent(a);
    await expect(getQuestionnaireOfLink(other.scope, first.questionnaireId)).rejects.toThrow(QuestionnaireNotFoundError);
    await expect(answerQuestionnaireOfLink({ ...other.scope }, first.questionnaireId, "guests", "10")).rejects.toThrow(QuestionnaireNotFoundError);
    await expect(getQuestionnaireOfLink({ ...first.scope, organizationId: b }, first.questionnaireId)).rejects.toThrow(QuestionnaireNotFoundError);
    expect(await listEventQuestionnaires(b, first.eventId)).toEqual([]);
    expect(await listQuestionnaireTemplates(b)).toEqual([]);
    await expect(saveQuestionnaireTemplate({ organizationId: b, templateId: first.templateId, name: "Volé", eventTypeId: null, questions: [{ label: "Q", nature: "short_text" }] })).rejects.toThrow(QuestionnaireNotFoundError);
    await expect(resolveQuestionnaireDifference({ organizationId: b, eventId: first.eventId, questionnaireId: first.questionnaireId, key: "guests", choice: "answer" })).rejects.toThrow(QuestionnaireNotFoundError);
  });
});
