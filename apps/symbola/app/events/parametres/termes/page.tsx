// Lot 53 (HUB-24 ; D8 ; ADR 0095) — « Termes des clients » : pour chaque type d'évènement, le terme qui
// désigne les clients, par langue, avec son genre et son nombre ; sans réglage, le terme du vocabulaire
// du type (ADR 0045).
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { listEventTypeVocabulary, suggestedClientTerms } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled } from "../../module-access";
import { AutosaveList } from "@/app/ui/autosave-list";
import { ClientTermRow } from "./client-term-row";

export default async function ClientTermsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("ClientTerms");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  await ensureEventTypes(organizationId, (await getLocale()) as Locale);
  const types = await listEventTypeVocabulary(organizationId);
  const suggestions = { fr: suggestedClientTerms("fr"), en: suggestedClientTerms("en") };
  const fallback = (audience: "couple" | "clients", locale: "fr" | "en") => suggestions[locale].find((term) => term.key === audience) ?? suggestions[locale][0]!;
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("clientTerms.title")} body={tHelp("clientTerms.body")} />
      <p>{t("intro")}</p>
      {/* Lot 62b (UX-13, D1) : un tableau, une ligne par type et par langue, enregistrée à la sortie du champ. */}
      <section className="card" aria-labelledby="client-terms-table">
        <h2 id="client-terms-table" className="sr-only">
          {t("tableLabel")}
        </h2>
        {(["fr", "en"] as const).map((locale) => (
          <datalist key={locale} id={`client-terms-${locale}`}>
            {suggestions[locale].map((suggestion) => (
              <option key={suggestion.term} value={suggestion.term} />
            ))}
          </datalist>
        ))}
        <AutosaveList>
          <div className="edit-list-scroll settings-list">
          <div className="edit-list client-terms-list" role="table" aria-label={t("tableLabel")}>
            <div className="edit-list-head" role="row">
              <span role="columnheader">{t("type")}</span>
              <span role="columnheader">{t("term")}</span>
              <span role="columnheader">{t("gender")}</span>
              <span role="columnheader">{t("number")}</span>
              <span role="columnheader">{t("columnState")}</span>
            </div>
            {types.flatMap((type) =>
              (["fr", "en"] as const).map((locale) => (
                <ClientTermRow key={`${type.eventTypeId}-${locale}`} eventTypeId={type.eventTypeId} typeLabel={type.label} locale={locale} current={type.terms[locale]} fallback={fallback(type.audience, locale)} listId={`client-terms-${locale}`} />
              )),
            )}
          </div>
          </div>
        </AutosaveList>
      </section>
    </main>
  );
}
