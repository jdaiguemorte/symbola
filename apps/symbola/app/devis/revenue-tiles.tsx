// Lot 32a (FAC-12 ; D8) — les trois chiffres de l'année civile, en tête de « Devis et factures » et
// de « Encaissements » : signé (devis signés, TTC, à la date de signature), facturé (factures moins
// avoirs, à la date d'émission), encaissé (encaissements moins annulations, arrhes comprises, à la
// date du paiement). L'année en cours par défaut ; les essais en sont exclus.
import { getTranslations } from "next-intl/server";
import { formatAmount, parisToday, type Locale } from "@symbola/i18n";
import { getRevenueSummary } from "@/modules/quotes/service";

const YEARS_BACK = 4;

export function parseRevenueYear(value: string | undefined, currentYear: number): number {
  const year = Number(value);
  return value && /^\d{4}$/.test(value) && year >= 2000 && year <= 2100 ? year : currentYear;
}

export async function RevenueTiles({
  organizationId,
  locale,
  basePath,
  yearParam,
  preserve = {},
}: {
  organizationId: string;
  locale: Locale;
  basePath: string;
  yearParam: string | undefined;
  preserve?: Record<string, string>;
}) {
  const t = await getTranslations("Today");
  const currentYear = Number(parisToday().slice(0, 4));
  const year = parseRevenueYear(yearParam, currentYear);
  const summary = await getRevenueSummary(organizationId, year);
  const years = [...new Set([currentYear + 1, ...Array.from({ length: YEARS_BACK + 1 }, (_, index) => currentYear - index), year])].sort((a, b) => b - a);
  return (
    <section className="card" aria-labelledby="revenue-title">
      <div className="section-head">
        <h2 id="revenue-title">{t("revenue.title")}</h2>
        <form method="get" action={basePath} className="inline-form compact-form">
          {Object.entries(preserve).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <label>
            {t("revenue.year")}{" "}
            <select name="annee" defaultValue={String(year)}>
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button-ghost">
            {t("revenue.show")}
          </button>
        </form>
      </div>
      <dl className="health-tiles">
        <div>
          <dt>{t("revenue.signed")}</dt>
          <dd>{formatAmount(summary.signedCents, locale)}</dd>
        </div>
        <div>
          <dt>{t("revenue.invoiced")}</dt>
          <dd>{formatAmount(summary.invoicedCents, locale)}</dd>
        </div>
        <div>
          <dt>{t("revenue.collected")}</dt>
          <dd>{formatAmount(summary.collectedCents, locale)}</dd>
        </div>
      </dl>
      <p className="meta">{t("revenue.hint")}</p>
    </section>
  );
}
