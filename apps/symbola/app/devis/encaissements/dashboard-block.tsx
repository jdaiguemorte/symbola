import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { getQuoteSettings, listUnpaidPayments, type UnpaidPaymentsView } from "@/modules/quotes/service";
import { UpcomingPayments } from "./upcoming-payments";

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
  return (
    <section aria-labelledby="dashboard-payments-title">
      <h2 id="dashboard-payments-title">{t("dashboardPaymentsTitle")}</h2>
      {view ? (
        <UpcomingPayments organizationId={organizationId} view={view} locale={locale} headingLevel={3} />
      ) : (
        <p role="status">{t("dashboardPaymentsUnavailable")}</p>
      )}
      <p>
        <Link href="/devis/encaissements">{t("allPaymentsLink")}</Link>
      </p>
    </section>
  );
}
