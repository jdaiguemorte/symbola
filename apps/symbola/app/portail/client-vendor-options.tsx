import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { ClientVendorSlotOptions } from "@/modules/events/service";

// L11-EVT-11 — options proposées, par poste : seulement les prestataires
// consultés que la planner a montrés et les notes cochées « Clients ».
// Lot 26a : fichiers servis par le portail, pour l'événement du lien.
// Lot 27a (POR-09) : dans l'aperçu de la planner, les fichiers ne s'ouvrent pas.
export async function ClientVendorOptions({ groups, locale, preview = false }: { groups: ClientVendorSlotOptions[]; locale: Locale; preview?: boolean }) {
  const t = await getTranslations("ClientSpace");
  return (
    <section aria-labelledby="client-options-title">
      <h2 id="client-options-title">{t("vendorOptionsTitle")}</h2>
      <p>{t("vendorOptionsIntro")}</p>
      {groups.map((group) => (
        <section key={group.slotLabel} aria-label={group.slotLabel} className="client-options">
          <h3>{group.slotLabel}</h3>
          <ul className="option-cards">
            {group.options.map((option) => (
              <li key={option.candidateId} className="card">
                <h4>{option.vendorName}</h4>
                {option.notes.map((note, index) => (
                  <p key={index}>{note}</p>
                ))}
                {option.quoteAmountCents !== null ? <p className="strong">{t("vendorOptionQuote", { amount: formatAmount(option.quoteAmountCents, locale) })}</p> : null}
                {option.hasQuoteFile ? (
                  preview ? (
                    <span>{t("vendorOptionOpenQuote", { vendor: option.vendorName })}</span>
                  ) : (
                    <a href={`/portail/options/${option.candidateId}/devis`}>{t("vendorOptionOpenQuote", { vendor: option.vendorName })}</a>
                  )
                ) : null}
                {option.ribShared ? (
                  preview ? (
                    <span>{t("vendorOptionOpenRib", { vendor: option.vendorName })}</span>
                  ) : (
                    <a href={`/portail/options/${option.candidateId}/rib`}>{t("vendorOptionOpenRib", { vendor: option.vendorName })}</a>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
