// Lot 53 (HUB-24 ; D8 ; ADR 0095) — « Termes des clients » : pour chaque type d'évènement, le terme qui
// désigne les clients, par langue, avec son genre et son nombre ; sans réglage, le terme du vocabulaire
// du type (ADR 0045). Lot 74g : un bloc de la rubrique « Types d'évènements et termes des clients »
// (/events/parametres/types#termes), tableau et enregistrement inchangés.
import { getTranslations } from "next-intl/server";
import { listEventTypeVocabulary, suggestedClientTerms } from "@/modules/events/service";
import { AutosaveList } from "@/app/ui/autosave-list";
import { ClientTermRow } from "./client-term-row";

export async function ClientTermsBlock({ organizationId }: { organizationId: string }) {
  const t = await getTranslations("ClientTerms");
  const types = await listEventTypeVocabulary(organizationId);
  const suggestions = { fr: suggestedClientTerms("fr"), en: suggestedClientTerms("en") };
  const fallback = (audience: "couple" | "clients", locale: "fr" | "en") => suggestions[locale].find((term) => term.key === audience) ?? suggestions[locale][0]!;
  return (
    <>
      <h2 id="termes-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      {/* Lot 62b (UX-13, D1) : un tableau, une ligne par type et par langue, enregistrée à la sortie du champ. */}
      <div className="card">
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
      </div>
    </>
  );
}
