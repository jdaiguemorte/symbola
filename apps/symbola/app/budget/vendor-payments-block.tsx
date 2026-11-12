// Lot 28b (BUD-03, décision D7) — bloc « Échéances prestataires » de l'accueil :
// échéances non payées en retard, puis celles des 7 prochains jours, trois au
// plus ; chaque ligne mène au budget de son événement. Absent sans module
// Budget (dégradation propre, ARC-06).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { listUpcomingVendorPayments } from "@/modules/budget/service";
import { HOME_BLOCK_LINES } from "@/app/accueil/home-blocks";

export async function VendorPaymentsBlock({ organizationId }: { organizationId: string }) {
  const t = await getTranslations("Budget");
  const locale = (await getLocale()) as Locale;
  const payments = await listUpcomingVendorPayments(organizationId, parisToday());
  const shown = payments.slice(0, HOME_BLOCK_LINES);
  return (
    <section className="card home-block" aria-labelledby="vendor-payments-title" data-urgent={payments.some((payment) => payment.overdue) ? "true" : undefined}>
      <div className="section-head">
        <h2 id="vendor-payments-title">{t("vendorPaymentsTitle")}</h2>
      </div>
      {payments.length === 0 ? <p>{t("vendorPaymentsEmpty")}</p> : null}
      {shown.length > 0 ? (
        <ul className="home-lines">
          {shown.map((payment) => (
            <li key={payment.id} className="home-line home-line-payment">
              <Link href={`/budget/${payment.eventId}#ligne-${payment.lineId}`} className="home-line-title">
                {t("vendorPaymentLine", { label: payment.label, line: payment.vendorName ?? payment.lineLabel })}
              </Link>
              <span className="home-line-meta">{payment.eventName}</span>
              <span className="home-line-amount">{formatAmount(payment.amountCents, locale)}</span>
              <span className={payment.overdue ? "home-line-when text-overdue" : "home-line-when"}>
                {payment.overdue ? `${t("vendorPaymentOverdue")} · ` : ""}
                {formatCalendarDate(payment.dueOn, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {payments.length > HOME_BLOCK_LINES ? <p className="home-more">{t("moreVendorPayments", { count: payments.length - HOME_BLOCK_LINES })}</p> : null}
    </section>
  );
}
