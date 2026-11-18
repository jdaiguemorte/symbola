// Lot 43 (BUD-11 ; D9) — les mois du calendrier des sorties d'argent : un bloc par mois (total, reste
// à sortir), une ligne par échéance (date, libellé, à qui, montant, payeur, statut, « Régler »). Le
// même rendu sert le portail et le budget de la planner.
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import type { CashCalendarMonth } from "@symbola/contracts";

export async function CashCalendarMonths({ months, locale, settleBase }: { months: CashCalendarMonth[]; locale: Locale; settleBase: string | null }) {
  const t = await getTranslations("CashCalendar");
  if (months.length === 0) return <p>{t("empty")}</p>;
  return (
    <>
      {months.map((month) => (
        <section key={month.month} aria-labelledby={`cash-${month.month}`} className="card cash-month">
          <h2 id={`cash-${month.month}`}>{formatMonth(`${month.month}-01`, locale)}</h2>
          <p className="meta">{t("monthTotals", { total: formatAmount(month.totalCents, locale), remaining: formatAmount(month.remainingCents, locale) })}</p>
          <ul className="cash-entries">
            {month.entries.map((entry) => (
              <li key={`${entry.source}-${entry.id}`} className="cash-entry" data-status={entry.status}>
                <span className="cash-entry-main">
                  <strong>{entry.label}</strong>
                  <span className="meta"> · {entry.counterpart}</span>
                </span>
                <span className="cash-entry-amount">{formatAmount(entry.amountCents, locale)}</span>
                <span className="meta">
                  {formatCalendarDate(entry.dueOn, locale)} · {t("payer", { name: entry.payerName })} · {t(`status.${entry.status}`)}
                </span>
                {entry.settleScheduleItemId && settleBase && entry.status === "upcoming" ? (
                  <a href={`${settleBase}/${entry.settleScheduleItemId}`}>
                    <span aria-hidden="true">{t("settle")}</span>
                    <span className="sr-only">{t("settleLabel", { label: entry.label })}</span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
