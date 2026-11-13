// Lot 31b (FAC-04, HUB-21, HUB-26, JUR-20 ; D7, D10, partie N) — modèles de contrat par type
// d'événement : titre, clauses ordonnées à variables, version, date de la dernière revue
// juridique. Chaque modèle porte l'avertissement « base à adapter ». Modifier un modèle ne
// change aucun contrat déjà généré (il garde son texte et la version dont il vient).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { contractTemplateWarning } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { listContractTemplates } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isQuotesModuleEnabled } from "../module-access";
import { addStarterContractTemplatesAction } from "./actions";
import { CreateContractTemplateForm } from "./template-forms";

export default async function ContractTemplatesPage() {
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

  const [templates, eventTypes] = await Promise.all([listContractTemplates(organizationId), ensureEventTypes(organizationId, locale)]);
  const typeLabel = new Map(eventTypes.map((type) => [type.id, type.label]));

  return (
    <main>
      <h1>{t("templatesTitle")}</h1>
      <ScreenHelp title={tHelp("contractTemplates.title")} body={tHelp("contractTemplates.body")} />
      <p role="note" className="adapt-warning">
        {contractTemplateWarning(locale)}
      </p>
      {templates.length === 0 ? (
        <section aria-labelledby="no-contract-templates-title">
          <h2 id="no-contract-templates-title">{t("noTemplatesTitle")}</h2>
          <p>{t("noTemplatesHint")}</p>
        </section>
      ) : (
        <ul className="item-list" aria-label={t("templatesTitle")}>
          {templates.map((template) => (
            <li key={template.id}>
              <h2>
                <Link href={`/devis/modeles-contrat/${template.id}`}>{template.name}</Link>
              </h2>
              <p className="meta">
                {t("templateVersion", { version: template.version })} —{" "}
                {template.eventTypeId ? (typeLabel.get(template.eventTypeId) ?? t("templateAllEventTypes")) : t("templateAllEventTypes")} —{" "}
                {template.legalReviewedOn ? t("templateReviewed", { date: formatCalendarDate(template.legalReviewedOn, locale) }) : t("templateNotReviewed")}
              </p>
              <p>{t("templateClauseCount", { count: template.clauses.length })}</p>
            </li>
          ))}
        </ul>
      )}
      <form action={addStarterContractTemplatesAction}>
        <button type="submit">{t("addStarterTemplates")}</button>
      </form>
      <section aria-labelledby="create-contract-template-title">
        <h2 id="create-contract-template-title">{t("createTemplate")}</h2>
        <CreateContractTemplateForm eventTypes={eventTypes.map((type) => ({ id: type.id, label: type.label }))} />
      </section>
    </main>
  );
}
