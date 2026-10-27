import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { PaymentMethod, QuoteDetail } from "@/modules/quotes/service";
import { formatRate, OVERDUE_STYLE, PAID_STYLE } from "../quote-display";
import { removeScheduleItemAction } from "./schedule-actions";
import { AddScheduleItemForm, EditScheduleItemForm, MarkPaidForm, MarkUnpaidForm } from "./schedule-forms";

// DEV-03 — échéancier de la version courante : acomptes (montant ou
// pourcentage du TTC), solde calculé ; composition sur un brouillon,
// paiements sur un devis envoyé ou signé.
export async function ScheduleSection({
  quote,
  methods,
  locale,
  today,
}: {
  quote: QuoteDetail;
  methods: PaymentMethod[];
  locale: Locale;
  today: string;
}) {
  const t = await getTranslations("Quotes");
  const { current } = quote;
  const { schedule } = current;
  const isDraft = current.sentAt === null;
  const payable = !isDraft && (quote.status === "sent" || quote.status === "signed");

  return (
    <section aria-labelledby="schedule-title">
      <h2 id="schedule-title">{t("scheduleTitle")}</h2>
      {schedule.items.length === 0 ? <p>{t("noScheduleItems")}</p> : null}
      <ul>
        {schedule.items.map((item) => (
          <li key={item.id}>
            <p>
              <strong>{item.label}</strong> — {formatCalendarDate(item.dueDate, locale)} — {formatAmount(item.amountCents, locale)}
              {item.percentageBasisPoints !== null
                ? ` (${t("percentOfTotal", { rate: formatRate(item.percentageBasisPoints, locale) })})`
                : ""}{" "}
              {item.paidOn ? (
                <span style={PAID_STYLE}>
                  {t("paidOnWith", {
                    date: formatCalendarDate(item.paidOn, locale),
                    method: item.paymentMethodLabel ?? "—",
                  })}
                </span>
              ) : item.overdue ? (
                <span style={OVERDUE_STYLE}>{t("overdue")}</span>
              ) : null}
            </p>
            {isDraft ? (
              <>
                <details>
                  <summary>{t("editScheduleItemNamed", { label: item.label })}</summary>
                  <EditScheduleItemForm quoteId={quote.id} item={item} />
                </details>
                <form action={removeScheduleItemAction}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <input type="hidden" name="scheduleItemId" value={item.id} />
                  <button type="submit">{t("removeScheduleItem", { label: item.label })}</button>
                </form>
              </>
            ) : null}
            {payable && !item.paidOn ? (
              methods.length === 0 ? (
                <p>
                  {t("noPaymentMethods")} <Link href="/devis/parametres">{t("settingsTitle")}</Link>
                </p>
              ) : (
                <details>
                  <summary>{t("markPaidNamed", { label: item.label })}</summary>
                  <MarkPaidForm quoteId={quote.id} item={item} methods={methods} today={today} />
                </details>
              )
            ) : null}
            {payable && item.paidOn ? <MarkUnpaidForm quoteId={quote.id} item={item} /> : null}
          </li>
        ))}
      </ul>
      <p>
        {t("scheduledTotal", { amount: formatAmount(schedule.scheduledCents, locale) })} —{" "}
        <strong>{t("balance", { amount: formatAmount(schedule.balanceCents, locale) })}</strong>
      </p>
      {schedule.exceedsTotal ? <p role="alert">{t("scheduleExceedsTotal")}</p> : null}
      {isDraft ? <AddScheduleItemForm quoteId={quote.id} /> : null}
    </section>
  );
}
