// Lot 58 (PAR-09, étape 4 ; réponse de Julien du 18/11 ; ADR 0097) — le tableau de bord discret du temps
// passé : seulement les évènements clôturés dont la planner a saisi le temps. Il n'est lié que depuis une
// clôture qui a un temps saisi ; absent de l'accueil, sans rappel. Interne : ni client ni comptable.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { loadClosing } from "@/lib/closing/load";
import { eventNames, getEventNamesByIds, listEventClosings } from "@/modules/events/service";
import { isEventsModuleEnabled } from "../module-access";

export default async function ClosingDashboardPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) notFound();
  const t = await getTranslations("ClosingDashboard");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const closings = (await listEventClosings(organizationId)).filter((closing) => closing.closedAt !== null && closing.timeSpentMinutes !== null);
  const names = await getEventNamesByIds(organizationId, closings.map((closing) => closing.eventId));
  const rows = (
    await Promise.all(closings.map(async (closing) => ({ closing, state: await loadClosing(organizationId, closing.eventId) })))
  ).filter((row) => row.state !== null);
  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("closingDashboard.title")} body={tHelp("closingDashboard.body")} />
      {rows.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="list-table-wrap" role="region" aria-label={t("tableLabel")} tabIndex={0}>
          <table className="list-table">
            <thead>
              <tr>
                <th scope="col">{t("event")}</th>
                <th scope="col">{t("closedOn")}</th>
                <th scope="col">{t("hours")}</th>
                <th scope="col">{t("margin")}</th>
                <th scope="col">{t("perHour")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ closing, state }) => (
                <tr key={closing.eventId}>
                  <th scope="row">
                    <Link href={`/events/${closing.eventId}/cloture`}>{names[closing.eventId] || eventNames([])}</Link>
                  </th>
                  <td className="num">{formatDate(new Date(closing.closedAt!), locale)}</td>
                  <td className="num">{t("hoursValue", { hours: Math.round((closing.timeSpentMinutes! / 60) * 10) / 10 })}</td>
                  <td className="num">{formatAmount(state!.financial.marginCents, locale)}</td>
                  <td className="num">{state!.financial.marginPerHourCents === null ? "—" : formatAmount(state!.financial.marginPerHourCents, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
