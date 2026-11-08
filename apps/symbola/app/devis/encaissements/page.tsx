import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { listUnpaidPayments } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { isQuotesModuleEnabled } from "../module-access";
import { UpcomingPayments } from "./upcoming-payments";

// DEV-03 — « Quand elle ouvre Encaissements, alors elle voit les échéances
// non payées triées par date, avec un total par mois. »
export default async function UpcomingPaymentsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("paymentsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const view = await listUnpaidPayments(organizationId);
  return (
    <main>
      <h1>{t("paymentsTitle")}</h1>
      <ScreenHelp title={tHelp("quotesPayments.title")} body={tHelp("quotesPayments.body")} />
      <UpcomingPayments organizationId={organizationId} view={view} locale={locale} headingLevel={2} />
    </main>
  );
}
