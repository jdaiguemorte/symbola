import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { getEvent } from "@/modules/events/service";
import { getQuoteSettings, listUnpaidPayments, type UnpaidPaymentsView } from "@/modules/quotes/service";
import { HOME_BLOCK_LINES } from "@/app/accueil/home-blocks";

// HUB-02 / DEV-03 — bloc « Encaissements à venir » du tableau de bord :
// retards en tête, puis les N prochains jours (90 proposés, paramétrable).
// S'il ne répond pas en 2 secondes, il s'affiche « indisponible » et le
// reste de la page fonctionne (dégradation propre, CLAUDE.md §2.3).
export const DASHBOARD_BLOCK_TIMEOUT_MS = 2000;

export async function loadDashboardPayments(
  organizationId: string,
  timeoutMs: number = DASHBOARD_BLOCK_TIMEOUT_MS,
  load: (organizationId: string) => Promise<UnpaidPaymentsView> = async (id) => {
    const settings = await getQuoteSettings(id);
    return listUnpaidPayments(id, { horizonDays: settings.upcomingHorizonDays });
  },
): Promise<UnpaidPaymentsView | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([load(organizationId), timeout]);
  } catch {
    console.warn(`encaissements indisponibles pour l'organisation ${organizationId}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function UpcomingPaymentsBlock({ organizationId }: { organizationId: string }) {
  const t = await getTranslations("Quotes");
  const locale = (await getLocale()) as Locale;
  const view = await loadDashboardPayments(organizationId);
  // Lot 20 (décision 4) : retards puis prochaines échéances, trois au plus ;
  // chaque ligne mène à son devis.
  const payments = view ? [...view.overdue, ...view.upcoming] : [];
  const shown = payments.slice(0, HOME_BLOCK_LINES);
  const events = await Promise.all([...new Set(shown.map((payment) => payment.eventId))].map((eventId) => getEvent(organizationId, eventId)));
  const names = new Map(events.flatMap((event) => (event ? [[event.id, event.clients.map((client) => client.firstName).join(" & ") || t("noClient")]] : [])));
  return (
    <section className="card home-block" aria-labelledby="dashboard-payments-title" data-tour="home-payments" data-urgent={view && view.overdue.length > 0 ? "true" : undefined}>
      <div className="section-head">
        <h2 id="dashboard-payments-title">{t("dashboardPaymentsTitle")}</h2>
        <Link href="/devis/encaissements">{t("allPaymentsLink")}</Link>
      </div>
      {!view ? <p role="status">{t("dashboardPaymentsUnavailable")}</p> : null}
      {view && payments.length === 0 ? <p>{t("noUnpaidPayments")}</p> : null}
      {shown.length > 0 ? (
        <ul className="home-lines">
          {shown.map((payment) => (
            <li key={payment.scheduleItemId} className="home-line home-line-payment">
              <Link href={`/devis/${payment.quoteId}`} className="home-line-title">
                {t("dashboardPaymentLine", { label: payment.label, number: payment.quoteNumber })}
              </Link>
              <span className="home-line-meta">{names.get(payment.eventId) ?? t("noClient")}</span>
              <span className="home-line-amount">{formatAmount(payment.amountCents, locale)}</span>
              <span className={payment.overdue ? "home-line-when text-overdue" : "home-line-when"}>
                {payment.overdue ? `${t("overdue")} · ` : ""}
                {formatCalendarDate(payment.dueDate, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {payments.length > HOME_BLOCK_LINES ? <p className="home-more">{t("moreDashboardPayments", { count: payments.length - HOME_BLOCK_LINES })}</p> : null}
    </section>
  );
}
