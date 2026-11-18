import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { requireLink } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { getLinkCashCalendar, LinkBudgetAccessDeniedError } from "@/modules/budget/service";
import { CashCalendarMonths } from "./cash-calendar-months";

// Lot 43 (BUD-11, BUD-06 ; D9) — le calendrier des sorties d'argent du client, mois par mois : les
// échéances de la planner et celles des prestataires, chacune avec son payeur, son statut et l'action
// utile (« Régler »). Un payeur à qui l'on ne montre que sa part ne voit que les siennes. Sur 375 px,
// un mois par bloc, sans tableau large.
export default async function CashCalendarPage() {
  const access = await requireLink("client");
  if (!access.rights.rubrics.includes("budget") || !(await isBudgetModuleEnabled(access.organizationId))) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("CashCalendar");
  const tHelp = await getTranslations("Help");
  let months;
  try {
    months = await getLinkCashCalendar(access.organizationId, access.linkId);
  } catch (error) {
    if (error instanceof LinkBudgetAccessDeniedError) notFound();
    throw error;
  }
  return (
    <main className="portal cash-calendar">
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("cashCalendar.title")} body={tHelp("cashCalendar.body")} />
      <CashCalendarMonths months={months} locale={locale} settleBase={access.rights.rubrics.includes("quotes") ? "/portail/reglement" : null} />
      <p>
        <a href="/portail">{t("backToSpace")}</a>
      </p>
    </main>
  );
}
