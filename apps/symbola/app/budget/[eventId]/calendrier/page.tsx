// Lot 43 (BUD-11 ; D9) — le calendrier des sorties d'argent de l'évènement, côté planner : la même vue
// que celle du client, mois par mois (« qu'est-ce qu'on doit payer en mai ? »), filtrable par payeur.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { getEvent } from "@/modules/events/service";
import { getCashCalendar, listEventPayers } from "@/modules/budget/service";
import { CashCalendarMonths } from "@/app/portail/calendrier/cash-calendar-months";
import { isBudgetModuleEnabled, isValidId } from "../../module-access";

export default async function EventCashCalendarPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ payeur?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { eventId } = await params;
  const { payeur } = await searchParams;
  const t = await getTranslations("CashCalendar");
  const tHelp = await getTranslations("Help");
  if (!(await isBudgetModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(eventId)) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event) notFound();
  const locale = (await getLocale()) as Locale;
  const payers = await listEventPayers(organizationId, eventId);
  const payerId = payeur && payers.some((payer) => payer.id === payeur) ? payeur : null;
  const months = await getCashCalendar(organizationId, eventId, { payerId });
  return (
    <main>
      <PageHeader
        title={t("title")}
        subtitle={event.clients.map((client) => client.firstName).join(" & ")}
        actions={
          <Link href={`/budget/${eventId}`} className="button-link">
            {t("backToBudget")}
          </Link>
        }
      />
      <ScreenHelp title={tHelp("budgetCashCalendar.title")} body={tHelp("budgetCashCalendar.body")} />
      <form method="get" aria-label={t("filterLabel")} className="filter-bar">
        <label htmlFor="cash-payer">{t("filterPayer")}</label>
        <select id="cash-payer" name="payeur" defaultValue={payerId ?? ""}>
          <option value="">{t("allPayers")}</option>
          {payers.map((payer) => (
            <option key={payer.id} value={payer.id}>
              {payer.name}
            </option>
          ))}
        </select>
        <button type="submit">{t("filterSubmit")}</button>
      </form>
      <CashCalendarMonths months={months} locale={locale} settleBase={null} />
    </main>
  );
}
