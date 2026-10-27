import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { getEReporting, type EReportingView } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isQuotesModuleEnabled } from "../module-access";
import { bimonthlyPeriods } from "./csv";
import { requestedPeriod } from "./period";

// DEV-04 — e-reporting des clients particuliers : données à déclarer sur la
// plateforme agréée, période par période (export seulement au lot 4, pas de
// transmission automatique). Jamais de donnée d'essai.
export default async function EReportingPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("eReportingTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const period = requestedPeriod(await searchParams);
  let view: EReportingView | null = null;
  try {
    view = await getEReporting(organizationId, period);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  const year = Number(period.from.slice(0, 4));
  const query = `from=${period.from}&to=${period.to}`;

  return (
    <main>
      <h1>{t("eReportingTitle")}</h1>
      <HelpButton title={tHelp("quotesEReporting.title")} body={tHelp("quotesEReporting.body")} />
      <p>{t("eReportingIntro")}</p>
      <nav aria-label={t("eReportingPeriods", { year })}>
        <ul>
          {bimonthlyPeriods(year).map((candidate) => (
            <li key={candidate.from}>
              <Link href={`/devis/e-reporting?from=${candidate.from}&to=${candidate.to}`} aria-current={candidate.from === period.from ? "page" : undefined}>
                {t("periodLabel", { from: formatCalendarDate(candidate.from, locale), to: formatCalendarDate(candidate.to, locale) })}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {view ? (
        <section aria-labelledby="e-reporting-summary">
          <h2 id="e-reporting-summary">
            {t("periodLabel", { from: formatCalendarDate(view.from, locale), to: formatCalendarDate(view.to, locale) })}
          </h2>
          <dl>
            <dt>{t("eReportingInvoiced")}</dt>
            <dd>
              {formatAmount(view.totals.invoicedTtcCents, locale)} ({t("countInvoices", { count: view.invoices.length })})
            </dd>
            <dt>{t("eReportingCredited")}</dt>
            <dd>
              {formatAmount(view.totals.creditedTtcCents, locale)} ({t("countCreditNotes", { count: view.creditNotes.length })})
            </dd>
            <dt>{t("eReportingNet")}</dt>
            <dd>{formatAmount(view.totals.netTtcCents, locale)}</dd>
            <dt>{t("eReportingCollected")}</dt>
            <dd>
              {formatAmount(view.totals.collectedCents, locale)} ({t("countPayments", { count: view.payments.length })})
            </dd>
          </dl>
          <p>
            <a href={`/devis/e-reporting/export?${query}`}>{t("downloadEReporting")}</a>
          </p>
        </section>
      ) : (
        <p role="alert">{t("invalidPeriod")}</p>
      )}
    </main>
  );
}
