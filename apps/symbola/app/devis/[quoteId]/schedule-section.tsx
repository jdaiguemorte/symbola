import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale, formatDate } from "@symbola/i18n";
import type { PaymentMethod, QuoteDetail } from "@/modules/quotes/service";
import { formatRate, OVERDUE_CLASS, PAID_CLASS } from "../quote-display";
import { removeScheduleItemAction } from "./schedule-actions";
import { AddScheduleItemForm, EditScheduleItemForm, MarkPaidForm, MarkUnpaidForm } from "./schedule-forms";
import { DisclosureButton, DisclosureGroup, DisclosurePanel } from "./disclosure";

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
  const tRubrics = await getTranslations("QuoteRubrics");
  const { current } = quote;
  const { schedule } = current;
  const isDraft = current.sentAt === null;
  const payable = !isDraft && (quote.status === "sent" || quote.status === "signed");

  return (
    <section id="echeancier" aria-labelledby="schedule-title">
      <h2 id="schedule-title">{t("scheduleTitle")}</h2>
      {schedule.items.length === 0 ? <p>{t("noScheduleItems")}</p> : null}
      {/* Lot 62d (UX-13) : une échéance par ligne ; sur un brouillon, elle s'ouvre en place, une seule à la fois. */}
      <DisclosureGroup>
      <ul className="item-list quote-schedule">
        {schedule.items.map((item) => (
          <li key={item.id}>
            <p>
              <strong>{item.label}</strong> — {formatCalendarDate(item.dueDate, locale)} — {formatAmount(item.amountCents, locale)}
              {item.percentageBasisPoints !== null
                ? ` (${t("percentOfTotal", { rate: formatRate(item.percentageBasisPoints, locale) })})`
                : ""}{" "}
              {item.paidOn ? (
                <span className={PAID_CLASS}>
                  {t("paidOnWith", {
                    date: formatCalendarDate(item.paidOn, locale),
                    method: item.paymentMethodLabel ?? "—",
                  })}
                </span>
              ) : item.overdue ? (
                <span className={OVERDUE_CLASS}>{t("overdue")}</span>
              ) : null}
            </p>
            {/* Lot 23b (D2) : une annulation ne s'efface pas ; l'historique la montre avec son motif. */}
            {item.payments.some((entry) => entry.kind === "reversal") ? (
              <ul aria-label={t("paymentHistory", { label: item.label })}>
                {item.payments.map((entry) => (
                  <li key={entry.id}>
                    {entry.kind === "received"
                      ? t("paymentReceivedEntry", {
                          date: formatCalendarDate(entry.paidOn ?? "", locale),
                          method: entry.paymentMethodLabel ?? "—",
                        })
                      : t("paymentReversedEntry", { date: formatDate(new Date(entry.recordedAt), locale), reason: entry.reason ?? "" })}
                  </li>
                ))}
              </ul>
            ) : null}
            {isDraft ? (
              <>
                <div className="quote-row-actions">
                  <DisclosureButton className="quote-row-button" id={`echeance-${item.id}`} label={t("editScheduleItemNamed", { label: item.label })}>
                    {tRubrics("edit")}
                  </DisclosureButton>
                  <form action={removeScheduleItemAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="scheduleItemId" value={item.id} />
                    <button type="submit" className="quote-row-button quote-remove" aria-label={t("removeScheduleItem", { label: item.label })}>
                      {tRubrics("remove")}
                    </button>
                  </form>
                </div>
                <DisclosurePanel id={`echeance-${item.id}`} className="quote-edit-panel">
                  <EditScheduleItemForm quoteId={quote.id} item={item} />
                </DisclosurePanel>
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
            {payable && item.paidOn ? (
              <div className="quote-edit-panel">
                <MarkUnpaidForm quoteId={quote.id} item={item} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      </DisclosureGroup>
      <p>
        {t("scheduledTotal", { amount: formatAmount(schedule.scheduledCents, locale) })} —{" "}
        <strong>{t("balance", { amount: formatAmount(schedule.balanceCents, locale) })}</strong>
      </p>
      {schedule.exceedsTotal ? <p role="alert">{t("scheduleExceedsTotal")}</p> : null}
      {isDraft ? <AddScheduleItemForm quoteId={quote.id} /> : null}
    </section>
  );
}
