// Lot 71d (HUB-14, BUD-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-58, C-53, C-55, C-56,
// P-07) — « Vérifier : ce qui va être écrit » pour un budget : les nombres que le bilan redira, ce que
// l'import ne fera pas, et le budget tel qu'il sera, poste par poste (deux postes, puis « tout
// afficher »). Le bouton dit ce qu'il fait et combien : « Importer les 14 lignes ».
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { BudgetPlan, BudgetPlanLine } from "@/lib/import/budget-plan";
import { planBySlot } from "@/lib/import/budget-plan";
import { ImportFiguresList } from "../../import-figures";

const SHOWN_SLOTS = 2;

function linePaid(line: BudgetPlanLine): number {
  return line.payments.length > 0 ? line.payments.filter((payment) => payment.paid).reduce((sum, payment) => sum + payment.amountCents, 0) : (line.paidCents ?? 0);
}

function lineToPay(line: BudgetPlanLine): number | null {
  if (line.payments.length > 0) return line.payments.filter((payment) => !payment.paid).reduce((sum, payment) => sum + payment.amountCents, 0);
  return line.realCents === null ? null : Math.max(line.realCents - linePaid(line), 0);
}

export async function BudgetVerify({ plan, rejectedCount }: { plan: BudgetPlan; rejectedCount: number }) {
  const t = await getTranslations("ImportFigures");
  const locale = (await getLocale()) as Locale;
  const slots = planBySlot(plan.lines);
  const money = (cents: number | null) => (cents === null ? <span className="meta">{t("notGiven")}</span> : formatAmount(cents, locale));
  const dash = <span aria-label={t("none")}>—</span>;

  const slotRows = (slot: (typeof slots)[number]) => (
    <tbody key={slot.slotKey}>
      <tr className="verify-slot">
        <th scope="rowgroup" colSpan={7}>
          {slot.slotLabel}
          {slot.newSlot ? <span className="meta"> · {t("newSlot")}</span> : null}
        </th>
      </tr>
      {slot.lines.map((line) => {
        const toPay = lineToPay(line);
        const paid = linePaid(line);
        return (
          <tr key={line.rowIndex}>
            <th scope="row">{line.lineLabel ?? t("withoutDetail")}</th>
            <td>{line.vendorName ?? <span className="meta">{t("toFind")}</span>}</td>
            <td className="amount">{money(line.plannedCents)}</td>
            <td className="amount">{money(line.realCents)}</td>
            <td className="amount">{paid > 0 ? formatAmount(paid, locale) : dash}</td>
            <td className="amount">{toPay && toPay > 0 ? formatAmount(toPay, locale) : dash}</td>
            <td>{line.nextDueOn ? formatCalendarDate(line.nextDueOn, locale) : dash}</td>
          </tr>
        );
      })}
    </tbody>
  );

  const head = (
    <thead>
      <tr>
        <th scope="col">{t("colLine")}</th>
        <th scope="col">{t("colVendor")}</th>
        <th scope="col" className="amount">
          {t("colPlanned")}
        </th>
        <th scope="col" className="amount">
          {t("colReal")}
        </th>
        <th scope="col" className="amount">
          {t("colPaid")}
        </th>
        <th scope="col" className="amount">
          {t("colToPay")}
        </th>
        <th scope="col">{t("colNext")}</th>
      </tr>
    </thead>
  );
  const rest = slots.slice(SHOWN_SLOTS);
  const restLines = rest.reduce((sum, slot) => sum + slot.lines.length, 0);
  const totals = (
    <tfoot>
      <tr>
        <th scope="row" colSpan={2}>
          {t("total")}
        </th>
        <td className="amount">{formatAmount(plan.figures.plannedCents, locale)}</td>
        <td className="amount">{formatAmount(plan.figures.realCents, locale)}</td>
        <td className="amount">{formatAmount(plan.figures.paidCents, locale)}</td>
        <td className="amount">{formatAmount(plan.figures.toPayCents, locale)}</td>
        <td />
      </tr>
    </tfoot>
  );

  return (
    <section aria-labelledby="verify-title" className="card budget-verify">
      <h2 id="verify-title">{t("verifyTitle")}</h2>
      <ImportFiguresList figures={plan.figures} done={false} />
      <p className="meta">{rejectedCount > 0 ? t("notImported", { count: rejectedCount }) : t("notImportedNone")}</p>
      <div className="list-table-wrap" role="region" aria-label={t("verifyCaption")} tabIndex={0}>
        <table className="list-table verify-table">
          <caption className="sr-only">{t("verifyCaption")}</caption>
          {head}
          {slots.slice(0, SHOWN_SLOTS).map(slotRows)}
          {rest.length === 0 ? totals : null}
        </table>
      </div>
      {rest.length > 0 ? (
        <details className="verify-more">
          <summary>{t("showAll", { slots: rest.length, lines: restLines })}</summary>
          <div className="list-table-wrap" role="region" aria-label={t("verifyCaptionMore")} tabIndex={0}>
            <table className="list-table verify-table">
              <caption className="sr-only">{t("verifyCaptionMore")}</caption>
              {head}
              {rest.map(slotRows)}
              {totals}
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
