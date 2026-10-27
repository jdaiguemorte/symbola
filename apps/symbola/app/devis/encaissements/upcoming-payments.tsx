import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { getEvent } from "@/modules/events/service";
import type { UnpaidPayment, UnpaidPaymentsView } from "@/modules/quotes/service";
import { OVERDUE_STYLE } from "../quote-display";

// DEV-03 — liste des échéances non payées (retards en tête, puis à venir
// groupées par mois avec leur total), partagée par l'écran
// « Encaissements » et le bloc du tableau de bord.
export async function UpcomingPayments({
  organizationId,
  view,
  locale,
  headingLevel,
}: {
  organizationId: string;
  view: UnpaidPaymentsView;
  locale: Locale;
  headingLevel: 2 | 3;
}) {
  const t = await getTranslations("Quotes");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const eventIds = [...new Set([...view.overdue, ...view.upcoming].map((payment) => payment.eventId))];
  const events = await Promise.all(eventIds.map((eventId) => getEvent(organizationId, eventId)));
  const names = new Map(
    events.flatMap((event) => (event ? [[event.id, event.clients.map((client) => client.firstName).join(" & ") || t("noClient")]] : [])),
  );

  const row = (payment: UnpaidPayment) => (
    <li key={payment.scheduleItemId}>
      {formatCalendarDate(payment.dueDate, locale)} — {formatAmount(payment.amountCents, locale)} — {payment.label} —{" "}
      <Link href={`/devis/${payment.quoteId}`}>{payment.quoteNumber}</Link> ({names.get(payment.eventId) ?? t("noClient")})
      {payment.overdue ? (
        <>
          {" "}
          <span style={OVERDUE_STYLE}>{t("overdue")}</span>
        </>
      ) : null}
    </li>
  );

  if (view.overdue.length === 0 && view.upcoming.length === 0) return <p>{t("noUnpaidPayments")}</p>;

  return (
    <>
      {view.overdue.length > 0 ? (
        <section aria-labelledby={`overdue-${headingLevel}`}>
          <Heading id={`overdue-${headingLevel}`}>
            {t("overdueTitle", { amount: formatAmount(view.overdueTotalCents, locale) })}
          </Heading>
          <ul>{view.overdue.map(row)}</ul>
        </section>
      ) : null}
      {view.months.map((month) => (
        <section key={month.month} aria-labelledby={`month-${headingLevel}-${month.month}`}>
          <Heading id={`month-${headingLevel}-${month.month}`}>
            {t("monthTotal", { month: formatMonth(`${month.month}-01`, locale), amount: formatAmount(month.totalCents, locale) })}
          </Heading>
          <ul>{view.upcoming.filter((payment) => payment.dueDate.startsWith(month.month)).map(row)}</ul>
        </section>
      ))}
    </>
  );
}
