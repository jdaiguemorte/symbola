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
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{tMenu("rubrics.proposalTemplates.label")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const [templates, eventTypes] = await Promise.all([listProposalTemplates(organizationId, locale === "en" ? "en" : "fr"), ensureEventTypes(organizationId, locale)]);
  const typeLabel = new Map(eventTypes.map((type) => [type.id, type.label]));
  const freeTypes = eventTypes.filter((type) => !templates.some((template) => template.eventTypeId === type.id)).map((type) => ({ id: type.id, label: type.label }));
  return (
    <main>
      <h1>{tMenu("rubrics.proposalTemplates.label")}</h1>
      <ScreenHelp title={tHelp("proposalTemplates.title")} body={tHelp("proposalTemplates.body")} />
      {/* Lot 61 : un modèle par carte. Dans une « item-list », le formulaire passait en grille de trois
          colonnes et le mot d'accueil se retrouvait coincé dans la colonne du milieu. */}
      {templates.map((template) => {
        const key = template.id ?? "starter";
        const type = template.eventTypeId ? (typeLabel.get(template.eventTypeId) ?? "") : null;
        return (
          <section key={key} aria-labelledby={`proposal-template-title-${key}`} className="proposal-template">
            <div className="section-head">
              <h2 id={`proposal-template-title-${key}`}>{type === null ? t("forAll") : t("forType", { type })}</h2>
              <span className={template.starter ? "badge badge-ambre" : "badge"}>{template.starter ? t("starterBadge") : t("version", { version: template.version })}</span>
            </div>
            {template.starter ? <p className="field-hint">{t("starterHint")}</p> : null}
            <ProposalTemplateForm template={template} eventTypes={[]} formId={`proposal-template-${key}`} />
            {template.id ? (
              <details>
                <summary>{t("photosSummary", { count: template.photoCount })}</summary>
                <ProposalPhotosForm templateId={template.id} count={template.photoCount} version={template.version} />
              </details>
            ) : (
              <p className="field-hint">{t("photosAfterSave")}</p>
            )}
            {template.id && type !== null ? (
              <form action={removeProposalTemplateAction} className="proposal-template-remove">
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit" className="button-ghost">
                  {t("remove", { type })}
                </button>
              </form>
            ) : null}
          </section>
        );
      })}
      {freeTypes.length > 0 ? (
        <section aria-labelledby="proposal-template-new">
          <h2 id="proposal-template-new">{t("newTitle")}</h2>
          <ProposalTemplateForm template={null} eventTypes={freeTypes} formId="proposal-template-new" />
        </section>
      ) : null}
    </main>
  );
}
