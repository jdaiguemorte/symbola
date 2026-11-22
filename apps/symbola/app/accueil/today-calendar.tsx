// Lot 63d (HUB-08, BUD-03, BUD-11, CHR-03 ; recette du 21/11/2026, maquette M3) — le calendrier du mois,
// à côté des priorités d'« Aujourd'hui » : évènements, rendez-vous, tâches (couleur de leur catégorie) et
// échéances de paiement non réglées (« Paiements »). « ‹ », « Ce mois-ci », « › » changent de mois
// (« ?mois= ») ; sur téléphone, la semaine en cours en liste, sous les priorités.
// Lot 65c (HUB-08 ; maquette M15) : sous la liste, sur toute la largeur ; trois vues, « Mois »,
// « Semaine » et « Liste » (« ?vue= », « ?semaine= ») ; « ‹ », « Aujourd'hui », « › » feuillettent le
// mois, ou la semaine.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatMonth, type Locale } from "@symbola/i18n";
import { appointmentsCalendarColor, paymentsCalendarColor } from "@symbola/starter-templates";
import type { TaskCategory } from "@/modules/events/service";
import { addMonths } from "@/app/agenda/calendar";
import { addDays, CALENDAR_VIEWS, currentWeek, listDays, mondayOf, monthWeeks, viewRange, weekDays, type CalendarView } from "@/lib/today/calendar";
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
  view,
  week: shownWeek,
  href,
}: {
  organizationId: string;
  modules: CalendarModules;
  month: string;
  today: string;
  locale: Locale;
  scope: Set<string> | null;
  categories: TaskCategory[];
  view: CalendarView;
  // Le lundi de la semaine montrée (vue « Semaine »).
  week: string;
  href: (target: { view: CalendarView; month: string; week: string }) => string;
}) {
  const t = await getTranslations("Today");
  const tHome = await getTranslations("Home");
  const tWords = await getTranslations("Today.words");
  const { from, until } = viewRange(view, month, shownWeek, today);
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
  const weeks = view === "semaine" ? [weekDays(shownWeek, today, items)] : monthWeeks(month, today, items);
  const week = view === "semaine" ? weeks[0]! : currentWeek(today, items);
  const list = view === "liste" ? listDays(month, today, items) : [];
  const dayTitles = Object.fromEntries([...weeks.flat(), ...week, ...list].map((day) => [day.date, dayTitle(day.date, locale)]));
  const step = (direction: -1 | 1) =>
    view === "semaine" ? href({ view, month: addDays(shownWeek, 7 * direction).slice(0, 7), week: addDays(shownWeek, 7 * direction) }) : href({ view, month: addMonths(month, direction), week: shownWeek });
  const current = href({ view, month: today.slice(0, 7), week: mondayOf(today) });
  const title = view === "semaine" ? t("calendar.weekOf", { date: dayTitle(shownWeek, locale) }) : formatMonth(`${month}-01`, locale);
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
          <span className="today-calendar-month">{title}</span>
          <span className="today-calendar-week">{t("calendar.weekTitle")}</span>
        </h2>
        <nav aria-label={t("calendar.navigate")} className="toolbar today-calendar-nav">
          <Link href={step(-1)} className="button-link" aria-label={t(view === "semaine" ? "calendar.previousWeek" : "calendar.previous")} scroll={false}>
            ‹
          </Link>
          <Link href={current} className="button-link" scroll={false}>
            {t("calendar.today")}
          </Link>
          <Link href={step(1)} className="button-link" aria-label={t(view === "semaine" ? "calendar.nextWeek" : "calendar.next")} scroll={false}>
            ›
          </Link>
        </nav>
        <nav aria-label={t("calendar.views")} className="pills today-calendar-views">
          {CALENDAR_VIEWS.map((entry) => (
            <Link key={entry} href={href({ view: entry, month, week: entry === "semaine" && view !== "semaine" ? mondayOf(month === today.slice(0, 7) ? today : `${month}-01`) : shownWeek })} aria-current={entry === view ? "page" : undefined} scroll={false}>
              {t(`calendar.view.${entry}`)}
            </Link>
          ))}
        </nav>
      </div>
      {unavailable.length > 0 ? (
        <p className="notice" role="status">
          {t("calendar.unavailable", { sources: unavailable.map((source) => t(`calendar.source.${source}`)).join(", ") })}
        </p>
      ) : null}
      <TodayCalendarClient view={view} weeks={weeks} week={week} list={list} labels={{ weekdays: tHome.raw("agendaWeekdays") as string[], dayTitles }} legend={legend} />
    </section>
  );
}
