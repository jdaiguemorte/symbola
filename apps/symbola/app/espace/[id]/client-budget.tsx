import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { BudgetLinesView } from "@/modules/budget/service";
import { varianceDisplay } from "@/app/budget/variance-display";

// PRD-BUD-04 — budget de l'événement vu par le marié : lecture seule, aucun
// formulaire, colonnes publiques uniquement. Lot 28b (Q33) : une ligne par
// catégorie, avec ses totaux (le détail et la validation au portail : lot 27).
export async function ClientBudget({ view, locale }: { view: BudgetLinesView; locale: Locale }) {
  const t = await getTranslations("Budget");
  const tClient = await getTranslations("ClientSpace");

  if (view.categories.length === 0) return <p>{tClient("noBudgetYet")}</p>;

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
        {view.categories.map((category) => {
          const engaged = category.committedCents > 0 || category.varianceCents !== 0;
          const variance = varianceDisplay(engaged ? category.varianceCents : null);
          return (
            <tr key={category.eventVendorSlotId}>
              <th scope="row">{category.label}</th>
              <td>{formatAmount(category.estimatedCents, locale)}</td>
              <td>{engaged ? formatAmount(category.committedCents, locale) : t("notSet")}</td>
              <td className={variance.className}>
                {t(variance.labelKey, {
                  amount: variance.amountCents === null ? "" : formatAmount(variance.amountCents, locale),
                })}
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
