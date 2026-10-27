import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { QuoteVersionView } from "@/modules/quotes/service";
import { formatRate } from "../quote-display";

// DEV-01 — lignes et totaux d'une version (courante ou ancienne), en
// lecture : totaux HT, TVA par taux, TTC, toujours calculés côté serveur.
export async function QuoteVersionTable({ version, locale, caption }: { version: QuoteVersionView; locale: Locale; caption: string }) {
  const t = await getTranslations("Quotes");
  const { totals } = version;
  return (
    <div role="region" aria-label={caption} tabIndex={0} style={{ overflowX: "auto" }}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t("itemLabel")}</th>
            <th scope="col">{t("quantity")}</th>
            <th scope="col">{t("itemUnitPrice")}</th>
            <th scope="col">{t("lineDiscount")}</th>
            {version.vatApplicable ? <th scope="col">{t("itemVatRate")}</th> : null}
            <th scope="col">{t("lineTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {version.lines.map((line) => (
            <tr key={line.id}>
              <th scope="row">
                {line.label}
                {line.description ? (
                  <>
                    <br />
                    <small>{line.description}</small>
                  </>
                ) : null}
              </th>
              <td>
                {new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 3 }).format(line.quantityMilli / 1000)}{" "}
                {line.unit}
              </td>
              <td>{formatAmount(line.unitPriceCents, locale)}</td>
              <td>{line.discountBasisPoints > 0 ? `${formatRate(line.discountBasisPoints, locale)} %` : "—"}</td>
              {version.vatApplicable ? <td>{formatRate(line.vatRateBasisPoints, locale)} %</td> : null}
              <td>{formatAmount(line.netCents, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        <dt>{t("subtotal")}</dt>
        <dd>{formatAmount(totals.subtotalCents, locale)}</dd>
        {totals.globalDiscountCents > 0 ? (
          <>
            <dt>{t("globalDiscount")}</dt>
            <dd>− {formatAmount(totals.globalDiscountCents, locale)}</dd>
          </>
        ) : null}
        <dt>{t("totalHt")}</dt>
        <dd>{formatAmount(totals.totalHtCents, locale)}</dd>
        {totals.vatByRate.map((vat) => (
          <div key={vat.rateBasisPoints}>
            <dt>{t("vatAtRate", { rate: formatRate(vat.rateBasisPoints, locale) })}</dt>
            <dd>{formatAmount(vat.vatCents, locale)}</dd>
          </div>
        ))}
        <dt>{t("totalTtc")}</dt>
        <dd>
          <strong>{formatAmount(totals.totalTtcCents, locale)}</strong>
        </dd>
      </dl>
    </div>
  );
}
