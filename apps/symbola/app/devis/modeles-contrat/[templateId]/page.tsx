// Lot 31b (FAC-04, DOC-02, HUB-21, JUR-20 ; D7, D10, partie N) — un modèle de contrat : en-tête
// (titre, type d'événement, date de la dernière revue juridique), clauses à variables (titre,
// texte, facultative, rôle légal), liste des variables documentée. Chaque modification du texte
// augmente la version ; les contrats déjà générés gardent leur texte.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { contractTemplateWarning } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { CONTRACT_VARIABLES, ContractTemplateNotFoundError, getContractTemplate, type ContractTemplateView } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isQuotesModuleEnabled, isValidId } from "../../module-access";
import { moveContractClauseAction, removeContractClauseAction, removeContractTemplateAction } from "../actions";
import { AddClauseForm, DuplicateContractTemplateForm, UpdateClauseForm, UpdateContractTemplateForm } from "../template-forms";

export default async function ContractTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Contracts");
  const tQuotes = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("templatesTitle")}</h1>
        <p>{tQuotes("moduleUnavailable")}</p>
      </main>
    );
  }
  const { templateId } = await params;
  if (!isValidId(templateId)) notFound();
  let template: ContractTemplateView;
  try {
    template = await getContractTemplate(organizationId, templateId);
  } catch (error) {
    if (error instanceof ContractTemplateNotFoundError) notFound();
    throw error;
  }
  const eventTypes = (await ensureEventTypes(organizationId, locale)).map((type) => ({ id: type.id, label: type.label }));

  return (
    <main>
      <p>
        <Link href="/devis/modeles-contrat">{t("backToTemplates")}</Link>
      </p>
      <h1>{template.name}</h1>
      <p className="meta">
        {t("templateVersion", { version: template.version })} —{" "}
        {template.legalReviewedOn ? t("templateReviewed", { date: formatCalendarDate(template.legalReviewedOn, locale) }) : t("templateNotReviewed")}
      </p>
      <ScreenHelp title={tHelp("contractTemplates.title")} body={tHelp("contractTemplates.body")} />
      <p role="note" className="adapt-warning">
        {contractTemplateWarning(locale)}
      </p>

      <section aria-labelledby="template-header-title">
        <h2 id="template-header-title">{t("templateHeaderTitle")}</h2>
        <UpdateContractTemplateForm template={template} eventTypes={eventTypes} />
      </section>

      <section aria-labelledby="clauses-title">
        <h2 id="clauses-title">{t("clausesTitle")}</h2>
        {template.clauses.length === 0 ? <p>{t("noClauses")}</p> : null}
        <ol>
          {template.clauses.map((clause, index) => (
            <li key={clause.id}>
              <h3>
                {clause.title}
                {clause.optional ? ` — ${t("clauseOptionalBadge")}` : ""}
                {clause.role ? ` — ${t(`role_${clause.role}`)}` : ""}
              </h3>
              <p className="clause-body">{clause.body}</p>
              <details>
                <summary>{t("updateClauseNamed", { title: clause.title })}</summary>
                <UpdateClauseForm clause={clause} />
              </details>
              {index > 0 ? (
                <form action={moveContractClauseAction}>
                  <input type="hidden" name="clauseId" value={clause.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit">{t("moveClauseUp", { title: clause.title })}</button>
                </form>
              ) : null}
              {index < template.clauses.length - 1 ? (
                <form action={moveContractClauseAction}>
                  <input type="hidden" name="clauseId" value={clause.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit">{t("moveClauseDown", { title: clause.title })}</button>
                </form>
              ) : null}
              <form action={removeContractClauseAction}>
                <input type="hidden" name="clauseId" value={clause.id} />
                <button type="submit">{t("removeClause", { title: clause.title })}</button>
              </form>
            </li>
          ))}
        </ol>
        <h3>{t("addClause")}</h3>
        <AddClauseForm templateId={template.id} />
      </section>

      <section aria-labelledby="variables-title">
        <h2 id="variables-title">{t("variablesTitle")}</h2>
        <p>{t("variablesHint")}</p>
        <dl className="variables">
          {CONTRACT_VARIABLES.map((variable) => (
            <div key={variable}>
              <dt>
                <code>{`{${variable}}`}</code>
              </dt>
              <dd>{t(`variable_${variable.replace(".", "_")}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="template-actions-title">
        <h2 id="template-actions-title">{t("templateActionsTitle")}</h2>
        <DuplicateContractTemplateForm template={template} />
        <form action={removeContractTemplateAction}>
          <input type="hidden" name="templateId" value={template.id} />
          <button type="submit">{t("removeTemplate", { name: template.name })}</button>
        </form>
      </section>
    </main>
  );
}
