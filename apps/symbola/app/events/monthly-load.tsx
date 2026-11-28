// Lot 32b (EVT-07 ; décision D11) — la charge des douze prochains mois : évènements confirmés et
// options (prospect, devis envoyé) par mois, en tableau. La barre est un repère visuel ; les
// chiffres font foi (styles en ligne interdits par la CSP : un élément <progress>).
// Lot 72f (E8 ; page 17 des maquettes du lot 68) : sous le calendrier de la vue « Calendrier », réduite aux mois
// qui ont un évènement (plus de lignes de zéros) ; rien quand aucun mois n'en a.
import { getTranslations } from "next-intl/server";
import { formatMonth, type Locale } from "@symbola/i18n";
import type { MonthLoad } from "@/lib/portfolio/portfolio";

export async function MonthlyLoad({ load, locale }: { load: MonthLoad[]; locale: Locale }) {
  const t = await getTranslations("EventsList");
  if (load.length === 0) return null;
  const max = Math.max(1, ...load.map((entry) => entry.confirmed + entry.options));
  return (
    <section className="card" aria-labelledby="monthly-load-title">
      <h2 id="monthly-load-title">{t("loadTitle")}</h2>
      {/* Lot 62a (NFR-19) : trois colonnes courtes, sans largeur minimale ; si la place manque quand
          même, le tableau défile dans sa zone, jamais la page. */}
      <div role="region" aria-label={t("loadTableLabel")} tabIndex={0}>
        <table className="data-table load-table">
          <thead>
            <tr>
              <th scope="col">{t("loadMonth")}</th>
              <th scope="col" className="num">
                {t("loadConfirmed")}
              </th>
              <th scope="col" className="num">
                {t("loadOptions")}
              </th>
              <th scope="col" className="load-bar-cell">
                <span className="sr-only">{t("loadBar")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {load.map((entry) => (
              <tr key={entry.month}>
                <th scope="row">{formatMonth(`${entry.month}-01`, locale)}</th>
                <td className="num">{entry.confirmed}</td>
                <td className="num">{entry.options}</td>
                <td className="load-bar-cell">
                  <progress aria-hidden="true" value={entry.confirmed + entry.options} max={max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
