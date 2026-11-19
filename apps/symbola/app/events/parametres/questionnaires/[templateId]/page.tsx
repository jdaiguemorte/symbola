// Lot 45 (HUB-21, POR-07 ; D6 à D8 ; ADR 0090) — un modèle de questionnaire : ses questions, ses
// versions (la précédente se relit), l'éditeur.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { QUESTION_EVENT_FIELDS, type QuestionEventField, type QuestionNature } from "@symbola/contracts";
import { questionnaireSensitiveWords } from "@symbola/starter-templates";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { getQuestionnaireTemplate, listEventTypes, naturesForField } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { TemplateEditor } from "./template-editor";

export default async function QuestionnaireTemplatePage({ params, searchParams }: { params: Promise<{ templateId: string }>; searchParams: Promise<{ version?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { templateId } = await params;
  if (!isValidId(templateId) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const { version } = await searchParams;
  const template = await getQuestionnaireTemplate(organizationId, templateId);
  if (!template) notFound();
  const shown = version && /^\d+$/.test(version) && Number(version) !== template.version ? await getQuestionnaireTemplate(organizationId, templateId, Number(version)) : null;
  const t = await getTranslations("QuestionnaireTemplates");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const types = await listEventTypes(organizationId);
  const fieldNatures = Object.fromEntries(QUESTION_EVENT_FIELDS.map((field) => [field, naturesForField(field)])) as Record<QuestionEventField, QuestionNature[]>;
  return (
    <main className="stack">
      <Link href="/events/parametres/questionnaires" className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={template.name} subtitle={t("versionLabel", { version: template.version })} />
      <ScreenHelp title={tHelp("questionnaireTemplates.title")} body={tHelp("questionnaireTemplates.body")} />
      {template.versions.length > 1 ? (
        <nav aria-label={t("versionsLabel")} className="row-wrap">
          {template.versions.map((number) => (
            <Link key={number} href={`/events/parametres/questionnaires/${template.id}?version=${number}`} aria-current={(shown?.version ?? template.version) === number ? "page" : undefined}>
              {t("versionLabel", { version: number })}
            </Link>
          ))}
        </nav>
      ) : null}
      {shown ? (
        <section className="card stack" aria-labelledby="old-version-title">
          <h2 id="old-version-title">{t("oldVersionTitle", { version: shown.version })}</h2>
          <ol>
            {shown.questions.map((question) => (
              <li key={question.key}>{question.label}</li>
            ))}
          </ol>
        </section>
      ) : (
        <TemplateEditor
          templateId={template.id}
          name={template.name}
          eventTypeId={template.eventTypeId}
          eventTypes={types.map((type) => ({ id: type.id, label: type.label }))}
          questions={template.questions}
          fieldNatures={fieldNatures}
          sensitiveWords={[...questionnaireSensitiveWords(locale), ...questionnaireSensitiveWords(locale === "fr" ? "en" : "fr")]}
        />
      )}
    </main>
  );
}
