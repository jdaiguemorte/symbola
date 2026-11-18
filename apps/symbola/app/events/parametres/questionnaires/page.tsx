// Lot 45 (HUB-21, POR-07 ; D6 ; ADR 0090) — Paramètres › Questionnaires : les modèles de l'organisation
// (découverte, cérémonie, musiques, détails pratiques…), pour tous les évènements ou pour un type,
// duplicables et versionnés ; un questionnaire déjà envoyé garde sa version.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { listEventTypes, listQuestionnaireTemplates } from "@/modules/events/service";
import { isEventsModuleEnabled } from "../../module-access";
import { CreateQuestionnaireForm, StarterQuestionnairesButton, TemplateRowActions } from "./template-list-forms";

export default async function QuestionnaireTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) notFound();
  const t = await getTranslations("QuestionnaireTemplates");
  const tHelp = await getTranslations("Help");
  const [templates, types] = await Promise.all([listQuestionnaireTemplates(organizationId), listEventTypes(organizationId)]);
  const typeLabel = (id: string | null) => (id ? (types.find((type) => type.id === id)?.label ?? t("allEvents")) : t("allEvents"));
  return (
    <main className="stack">
      <PageHeader title={t("title")} />
      <ScreenHelp title={tHelp("questionnaireTemplates.title")} body={tHelp("questionnaireTemplates.body")} />
      <p>{t("intro")}</p>
      <StarterQuestionnairesButton />
      <section className="card stack" aria-labelledby="questionnaire-list-title">
        <h2 id="questionnaire-list-title">{t("listTitle")}</h2>
        {templates.length === 0 ? <p className="meta">{t("empty")}</p> : null}
        <ul className="plain-list stack">
          {templates.map((template) => (
            <li key={template.id} className="row-wrap">
              <Link href={`/events/parametres/questionnaires/${template.id}`}>{template.name}</Link>
              <span className="meta">{t("summary", { questions: template.questionCount, version: template.version, type: typeLabel(template.eventTypeId) })}</span>
              <TemplateRowActions templateId={template.id} name={template.name} />
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <CreateQuestionnaireForm />
      </section>
    </main>
  );
}
