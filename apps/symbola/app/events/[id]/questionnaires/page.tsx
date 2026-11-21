// Lot 45 (POR-07, CRM-09, HUB-21 ; D6, D7 ; ADR 0090) — les questionnaires de l'évènement : envoyer un
// modèle à un client (son lien personnel s'ouvre sur la rubrique « Questionnaires »), suivre les
// réponses (enregistrées à chaque question), et trancher les écarts entre une réponse et la fiche
// (« Léa indique 140 invités, la fiche dit 120 »). Un champ vide de la fiche s'est déjà rempli.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { eventNames, getEvent, listEventQuestionnaires, listQuestionnaireDifferences, markEventQuestionnairesSeen, questionnaireTemplatesForEventType } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { formatAnswer } from "./answer-format";
import { DifferenceChoice, SendQuestionnaireForm } from "./questionnaire-forms";

export default async function EventQuestionnairesPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const t = await getTranslations("EventQuestionnaires");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const [templates, questionnaires, differences] = await Promise.all([questionnaireTemplatesForEventType(organizationId, event.eventTypeId), listEventQuestionnaires(organizationId, id), listQuestionnaireDifferences(organizationId, id)]);
  await markEventQuestionnairesSeen(organizationId, id);
  const clients = event.clients.map((client) => ({ id: client.id, label: [client.firstName, client.lastName].filter(Boolean).join(" "), hasEmail: Boolean(client.email) }));
  const nameOf = (contactId: string | null) => event.clients.find((client) => client.contactId === contactId)?.firstName ?? t("someone");

  return (
    <main className="stack">
      <Link href={`/events/${event.id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} subtitle={eventNames(event.clients, event.name)} />
      <ScreenHelp title={tHelp("eventQuestionnaires.title")} body={tHelp("eventQuestionnaires.body")} />

      {differences.length > 0 ? (
        <section className="card notice stack" aria-labelledby="questionnaire-differences-title">
          <h2 id="questionnaire-differences-title">{t("differencesTitle")}</h2>
          <ul className="plain-list stack">
            {differences.map((difference) => {
              const questionnaire = questionnaires.find((candidate) => candidate.id === difference.questionnaireId);
              const answer = formatAnswer(difference.answer, locale, difference.eventField);
              const current = formatAnswer(difference.current, locale, difference.eventField);
              return (
                <li key={`${difference.questionnaireId}-${difference.key}`}>
                  <p>{t("difference", { name: nameOf(questionnaire?.contactId ?? null), field: t(`field.${difference.eventField}`), answer, current })}</p>
                  <DifferenceChoice eventId={event.id} questionnaireId={difference.questionnaireId} itemKey={difference.key} answerLabel={t("takeAnswer", { answer })} eventLabel={t("keepEvent", { current })} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="card">
        {templates.length === 0 ? (
          <p>
            {t("noTemplate")} <Link href="/events/parametres/questionnaires">{t("createTemplates")}</Link>
          </p>
        ) : event.isDemo ? (
          <p>{t("demo")}</p>
        ) : (
          <SendQuestionnaireForm eventId={event.id} templates={templates.map((template) => ({ id: template.id, name: template.name }))} clients={clients} />
        )}
      </section>

      <section className="card stack" aria-labelledby="questionnaires-sent-title">
        <h2 id="questionnaires-sent-title">{t("sentTitle")}</h2>
        {questionnaires.length === 0 ? <p className="meta">{t("noneSent")}</p> : null}
        {questionnaires.map((questionnaire) => {
          const answered = questionnaire.questions.filter((question) => questionnaire.answers[question.key]).length;
          return (
            <details key={questionnaire.id} className="questionnaire-sent">
              <summary>
                <strong>{questionnaire.name}</strong> — {nameOf(questionnaire.contactId)} — {questionnaire.finishedAt ? t("finished") : t("progress", { answered, total: questionnaire.questions.length })}
              </summary>
              <dl className="questionnaire-answers">
                {questionnaire.questions.map((question) => (
                  <div key={question.key}>
                    <dt>{question.label}</dt>
                    <dd>{formatAnswer(questionnaire.answers[question.key]?.value ?? null, locale, question.eventField, question.nature)}</dd>
                  </div>
                ))}
              </dl>
              <p className="meta">{t("frozen", { version: questionnaire.templateVersion })}</p>
            </details>
          );
        })}
      </section>
    </main>
  );
}
