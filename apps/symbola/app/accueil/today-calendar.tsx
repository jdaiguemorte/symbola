// Lot 63d (HUB-08, BUD-03, BUD-11, CHR-03 ; recette du 21/11/2026, maquette M3) — le calendrier du mois,
// à côté des priorités d'« Aujourd'hui » : évènements, rendez-vous, tâches (couleur de leur catégorie) et
// échéances de paiement non réglées (« Paiements »). « ‹ », « Ce mois-ci », « › » changent de mois
// (« ?mois= ») ; sur téléphone, la semaine en cours en liste, sous les priorités.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatMonth, type Locale } from "@symbola/i18n";
import { appointmentsCalendarColor, paymentsCalendarColor } from "@symbola/starter-templates";
import type { TaskCategory } from "@/modules/events/service";
import { addMonths } from "@/app/agenda/calendar";
import { calendarRange, currentWeek, monthWeeks } from "@/lib/today/calendar";
import { loadCalendarItems, type CalendarModules } from "@/lib/today/calendar-load";
import { TodayCalendarClient } from "./today-calendar-client";

function dayTitle(date: string, locale: Locale): string {
  const text = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

export async function TodayCalendar({
  organizationId,
  modules,
  month,
  today,
  locale,
  scope,
  categories,
  monthHref,
}: {
  organizationId: string;
  modules: CalendarModules;
  month: string;
  today: string;
  locale: Locale;
  scope: Set<string> | null;
  categories: TaskCategory[];
  monthHref: (month: string) => string;
}) {
  const t = await getTranslations("Today");
  const tHome = await getTranslations("Home");
  const tWords = await getTranslations("Today.words");
  const { from, until } = calendarRange(month, today);
  const { items, unavailable } = await loadCalendarItems({
    organizationId,
    modules,
    from,
    until,
    today,
    locale,
    scope,
    categories,
    words: { payments: t("calendar.payments"), standaloneTask: tWords("standaloneTaskTag") },
  });
  const weeks = monthWeeks(month, today, items);
  const week = currentWeek(today, items);
  const dayTitles = Object.fromEntries([...weeks.flat(), ...week].map((day) => [day.date, dayTitle(day.date, locale)]));
  const legend = [
    ...(modules.events ? [{ label: t("calendar.kind.event"), color: null }] : []),
    ...(modules.events ? categories.map((category) => ({ label: category.label, color: category.color })) : []),
    ...(modules.appointments ? [{ label: t("calendar.kind.appointment"), color: appointmentsCalendarColor() }] : []),
    ...(modules.budget ? [{ label: t("calendar.payments"), color: paymentsCalendarColor() }] : []),
  ];

  return (
    <section className="card today-calendar" aria-labelledby="today-calendar-title" data-tour="home-calendar">
      <div className="section-head">
        <h2 id="today-calendar-title">
          <span className="today-calendar-month">{formatMonth(`${month}-01`, locale)}</span>
          <span className="today-calendar-week">{t("calendar.weekTitle")}</span>
        </h2>
        <nav aria-label={t("calendar.navigate")} className="toolbar today-calendar-nav">
          <Link href={monthHref(addMonths(month, -1))} className="button-link" aria-label={t("calendar.previous")} scroll={false}>
            ‹
          </Link>
          <Link href={monthHref(today.slice(0, 7))} className="button-link" scroll={false}>
            {t("calendar.thisMonth")}
          </Link>
          <Link href={monthHref(addMonths(month, 1))} className="button-link" aria-label={t("calendar.next")} scroll={false}>
            ›
          </Link>
        </nav>
      </div>
      {unavailable.length > 0 ? (
        <p className="notice" role="status">
          {t("calendar.unavailable", { sources: unavailable.map((source) => t(`calendar.source.${source}`)).join(", ") })}
        </p>
      ) : null}
      <TodayCalendarClient weeks={weeks} week={week} labels={{ weekdays: tHome.raw("agendaWeekdays") as string[], dayTitles }} legend={legend} />
    </section>
  );
}
