// Lot 43 (FAC-02, HUB-21 ; D2) — modèles de la page de proposition : un pour tous les évènements, et un
// par type d'évènement si besoin. Le devis reste le cœur de la page ; le mot d'accueil se reprend dans
// chaque devis, qui peut le changer avant l'envoi. Le modèle de départ est à adapter.
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { listProposalTemplates } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "../module-access";
import { removeProposalTemplateAction } from "./actions";
import { ProposalTemplateForm } from "./proposal-template-forms";
import { ProposalPhotosForm } from "./photo-form";

export default async function ProposalTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("ProposalTemplates");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const [templates, eventTypes] = await Promise.all([listProposalTemplates(organizationId, locale === "en" ? "en" : "fr"), ensureEventTypes(organizationId, locale)]);
  const typeLabel = new Map(eventTypes.map((type) => [type.id, type.label]));
  const freeTypes = eventTypes.filter((type) => !templates.some((template) => template.eventTypeId === type.id)).map((type) => ({ id: type.id, label: type.label }));
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("proposalTemplates.title")} body={tHelp("proposalTemplates.body")} />
      <ul className="item-list">
        {templates.map((template) => (
          <li key={template.id ?? "starter"}>
            <h2>{template.eventTypeId ? t("forType", { type: typeLabel.get(template.eventTypeId) ?? "" }) : t("forAll")}</h2>
            <p className="meta">{template.starter ? t("starterHint") : t("version", { version: template.version })}</p>
            <ProposalTemplateForm template={template} eventTypes={[]} formId={`proposal-template-${template.id ?? "starter"}`} />
            {template.id ? (
              <details>
                <summary>{t("photosSummary", { count: template.photoCount })}</summary>
                <ProposalPhotosForm templateId={template.id} count={template.photoCount} version={template.version} />
              </details>
            ) : null}
            {template.id && template.eventTypeId ? (
              <form action={removeProposalTemplateAction}>
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit">{t("remove", { type: typeLabel.get(template.eventTypeId) ?? "" })}</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {freeTypes.length > 0 ? (
        <section aria-labelledby="proposal-template-new">
          <h2 id="proposal-template-new">{t("newTitle")}</h2>
          <ProposalTemplateForm template={null} eventTypes={freeTypes} formId="proposal-template-new" />
        </section>
      ) : null}
    </main>
  );
}
