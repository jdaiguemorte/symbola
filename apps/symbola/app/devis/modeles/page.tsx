// Lot 31a (FAC-01, HUB-21, HUB-26 ; décision D3) — modèles de devis par type d'événement :
// un devis type se crée en moins de cinq minutes. Modifier un modèle ne change aucun devis
// déjà créé (il garde la version dont il vient). Le modèle de départ est « à adapter ».
import Link from "next/link";
import { EmptyState } from "@/app/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { listQuoteTemplates } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isQuotesModuleEnabled } from "../module-access";
import { addStarterTemplatesAction, removeTemplateAction } from "./actions";
import { DuplicateTemplateForm, RenameTemplateForm } from "./template-forms";

export default async function QuoteTemplatesPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Quotes");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{tMenu("rubrics.quoteTemplates.label")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const [templates, eventTypes] = await Promise.all([listQuoteTemplates(organizationId), ensureEventTypes(organizationId, locale)]);
  const typeLabel = new Map(eventTypes.map((type) => [type.id, type.label]));

  return (
    <main>
      <h1>{tMenu("rubrics.quoteTemplates.label")}</h1>
      <ScreenHelp title={tHelp("quotesTemplates.title")} body={tHelp("quotesTemplates.body")} />
      <p role="note" className="adapt-warning">
        {t("templateAdaptWarning")}
      </p>
      {templates.length === 0 ? (
        // Lot 39c (UX-08) : l'écran vide enseigne.
        // Lot 67c (UX-08 ; R08) : le bouton de l'écran vide fait la chose (il pointait une ancre visible).
        <EmptyState
          screen="quoteTemplates"
          title={t("noTemplatesTitle")}
          action={
            <>
              <form action={addStarterTemplatesAction}>
                <button type="submit">{t("addStarterTemplates")}</button>
              </form>
              <Link href="/devis" className="button-link">
                {t("startFromQuote")}
              </Link>
            </>
          }
        />
      ) : (
        <ul className="item-list" aria-label={t("templatesTitle")}>
          {templates.map((template) => (
            <li key={template.id}>
              <h2>{template.name}</h2>
              <p className="meta">
                {t("templateVersion", { version: template.version })} —{" "}
                {template.eventTypeId ? (typeLabel.get(template.eventTypeId) ?? t("templateAllEventTypes")) : t("templateAllEventTypes")}
              </p>
              <p>
                {t("templateCounts", { sections: template.sectionCount, lines: template.lineCount, options: template.optionCount, schedule: template.scheduleCount })}
              </p>
              <details>
                <summary>{t("renameTemplateNamed", { name: template.name })}</summary>
                <RenameTemplateForm template={template} eventTypes={eventTypes.map((type) => ({ id: type.id, label: type.label }))} />
              </details>
              <DuplicateTemplateForm template={template} />
              <form action={removeTemplateAction}>
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit">{t("removeTemplate", { name: template.name })}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {templates.length > 0 ? (
        <form action={addStarterTemplatesAction} id="modeles-de-depart">
          <button type="submit">{t("addStarterTemplates")}</button>
        </form>
      ) : null}
      <p className="meta">
        {t("templatesFromQuoteHint")} <Link href="/devis">{t("quotesLink")}</Link>
      </p>
    </main>
  );
}
