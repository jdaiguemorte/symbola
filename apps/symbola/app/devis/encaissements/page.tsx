import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { SettingsLink } from "@/app/settings-link";
import { PageHeader } from "@/app/ui/page-header";
import { listUnpaidPayments } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { isQuotesModuleEnabled } from "../module-access";
import { UpcomingPayments } from "./upcoming-payments";
import { RevenueTiles } from "../revenue-tiles";

// DEV-03 — « Quand elle ouvre Encaissements, alors elle voit les échéances
// non payées triées par date, avec un total par mois. »
export default async function UpcomingPaymentsPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
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
      <PageHeader title={t("paymentsTitle")} actions={<SettingsLink href="/devis/parametres" label={t("settingsTitle")} />} />
      <ScreenHelp title={tHelp("quotesPayments.title")} body={tHelp("quotesPayments.body")} />
      {/* Lot 32a (FAC-12, D8) : signé, facturé, encaissé, sur l'année civile ; les échéances à venir dessous. */}
      <RevenueTiles organizationId={organizationId} locale={locale} basePath="/devis/encaissements" yearParam={(await searchParams).annee} />
      <UpcomingPayments organizationId={organizationId} view={view} locale={locale} headingLevel={2} />
    </main>
  );
}
