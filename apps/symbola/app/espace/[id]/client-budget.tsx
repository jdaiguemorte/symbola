import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { BudgetLinesView } from "@/modules/budget/service";
import { varianceDisplay } from "@/app/budget/variance-display";

// PRD-BUD-04 — budget de l'événement vu par le marié : lecture seule, aucun
// formulaire, colonnes publiques uniquement (poste, prévu, réel, écart).
export async function ClientBudget({ view, locale }: { view: BudgetLinesView; locale: Locale }) {
  const t = await getTranslations("Budget");
  const tClient = await getTranslations("ClientSpace");

  if (view.lines.length === 0) return <p>{tClient("noBudgetYet")}</p>;

  return (
    <table>
      <caption>{t("clientLinesTitle")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("vendorSlot")}</th>
          <th scope="col">{t("amounts.estimated")}</th>
          <th scope="col">{t("amounts.committed")}</th>
          <th scope="col">{t("variance")}</th>
        </tr>
      </thead>
      <tbody>
        {view.lines.map((line) => {
          const variance = varianceDisplay(line.varianceCents);
          return (
            <tr key={line.eventVendorSlotId}>
              <th scope="row">{line.label}</th>
              <td>{line.estimatedAmountCents === null ? t("notSet") : formatAmount(line.estimatedAmountCents, locale)}</td>
              <td>{line.committedAmountCents === null ? t("notSet") : formatAmount(line.committedAmountCents, locale)}</td>
              <td className={variance.className}>
                {t(variance.labelKey, {
                  amount: variance.amountCents === null ? "" : formatAmount(variance.amountCents, locale),
                })}
                {line.variancePercent !== null ? ` (${line.variancePercent > 0 ? "+" : ""}${line.variancePercent} %)` : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{t("total")}</th>
          <td>{formatAmount(view.totalEstimatedCents, locale)}</td>
          <td>{formatAmount(view.totalCommittedCents, locale)}</td>
          <td>{formatAmount(view.totalVarianceCents, locale)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
