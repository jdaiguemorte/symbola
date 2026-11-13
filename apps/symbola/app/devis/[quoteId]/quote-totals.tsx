import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { QuoteLine, QuoteVersionView } from "@/modules/quotes/service";
import { formatRate } from "../quote-display";

// DEV-01 — lignes et totaux d'une version (courante ou ancienne), en
// lecture : totaux HT, TVA par taux, TTC, toujours calculés côté serveur.
// Lot 31a (FAC-01, D2) : lignes groupées par section (sous-total de chacune), options
// marquées « choisie » ou « non retenue » (hors du total).
export async function QuoteVersionTable({ version, locale, caption }: { version: QuoteVersionView; locale: Locale; caption: string }) {
  const t = await getTranslations("Quotes");
  const { totals } = version;
  const columns = version.vatApplicable ? 6 : 5;
  const groups: { id: string | null; title: string | null; subtotalCents: number | null; lines: QuoteLine[] }[] = [
    { id: null, title: null, subtotalCents: null, lines: version.lines.filter((line) => line.sectionId === null || !version.sections.some((section) => section.id === line.sectionId)) },
    ...version.sections.map((section) => ({ id: section.id, title: section.title, subtotalCents: section.subtotalCents, lines: version.lines.filter((line) => line.sectionId === section.id) })),
  ].filter((group) => group.title !== null || group.lines.length > 0);
  return (
    <div role="region" aria-label={caption} tabIndex={0}>
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
        {groups.map((group) => (
        <tbody key={group.id ?? "sans-section"}>
          {group.title !== null ? (
            <tr className="quote-section-row">
              <th scope="colgroup" colSpan={columns}>
                {group.title}
              </th>
            </tr>
          ) : null}
          {group.lines.map((line) => (
            <tr key={line.id} className={line.isOption && !line.optionChosen ? "quote-option-unchosen" : undefined}>
              <th scope="row">
                {line.label}
                {line.isOption ? (
                  <>
                    {" "}
                    <span className="badge">{line.optionChosen ? t("optionChosen") : t("optionNotChosen")}</span>
                  </>
                ) : null}
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
          {group.title !== null ? (
            <tr className="quote-section-subtotal">
              <th scope="row" colSpan={columns - 1}>
                {t("sectionSubtotal", { title: group.title })}
              </th>
              <td>{formatAmount(group.subtotalCents ?? 0, locale)}</td>
            </tr>
          ) : null}
        </tbody>
        ))}
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
