import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { LinkBudgetView } from "@/modules/budget/service";
import { varianceDisplay } from "@/app/budget/variance-display";

// PRD-BUD-04 — budget de l'événement vu par un lien personnel : lecture seule,
// aucun formulaire, colonnes publiques uniquement. Lot 28b (Q33) : une ligne par
// catégorie, avec ses totaux (le détail et la validation au portail : lot 27).
// Lot 28c (BUD-09, D5) : TTC pour un particulier ; HT en dessous pour un
// client professionnel. Lot 26a (POR-01, POR-10) : en « catégories choisies »,
// ces catégories seules, sans total général (Bernard voit le traiteur et le
// lieu, pas le budget du mariage).
export async function ClientBudget({ view, locale }: { view: LinkBudgetView; locale: Locale }) {
  const t = await getTranslations("Budget");
  const tClient = await getTranslations("ClientSpace");
  const tLink = await getTranslations("LinkPortal");
  const professional = view.clientKind === "professional";
  const ht = (cents: number) => (professional ? <span className="budget-ht">{t("htAmount", { amount: formatAmount(cents, locale) })}</span> : null);

  if (view.categories.length === 0) return <p>{tClient("noBudgetYet")}</p>;

  return (
    <>
      {view.scope === "selected" ? <p>{tLink("budgetSelectedIntro")}</p> : null}
      {/* Zone défilante sur téléphone : le tableau reste lisible à 375 px (UX-05). */}
      <div role="region" tabIndex={0} aria-label={t("clientLinesTitle")}>
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
                  <td>
                    {formatAmount(category.estimatedCents, locale)}
                    {ht(category.ht.estimatedCents)}
                  </td>
                  <td>
                    {engaged ? formatAmount(category.committedCents, locale) : t("notSet")}
                    {engaged ? ht(category.ht.committedCents) : null}
                  </td>
                  <td className={variance.className}>
                    {t(variance.labelKey, {
                      amount: variance.amountCents === null ? "" : formatAmount(variance.amountCents, locale),
                    })}
                    {engaged ? ht(category.ht.varianceCents) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {view.scope === "all" ? (
            <tfoot>
              <tr>
                <th scope="row">{t("total")}</th>
                <td>
                  {formatAmount(view.totalEstimatedCents, locale)}
                  {ht(view.totalHt.estimatedCents)}
                </td>
                <td>
                  {formatAmount(view.totalCommittedCents, locale)}
                  {ht(view.totalHt.committedCents)}
                </td>
                <td>
                  {formatAmount(view.totalVarianceCents, locale)}
                  {ht(view.totalHt.varianceCents)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
