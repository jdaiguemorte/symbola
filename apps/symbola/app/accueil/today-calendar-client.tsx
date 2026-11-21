"use client";

// Lot 63d (HUB-08, BUD-11, CHR-03 ; maquette M3) — le calendrier du mois d'« Aujourd'hui ». Pavé plein :
// un évènement ; pavé blanc à liseré : une tâche, un rendez-vous ou une échéance, de la couleur de sa
// catégorie, le libellé toujours écrit. Un clic sur un jour ouvre son détail dans une fenêtre ; un clic
// sur un élément ouvre son écran. Sur téléphone : la semaine en cours en liste.
import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CalendarDay, CalendarItem } from "@/lib/today/calendar";
import { CategorySwatch } from "@/app/taches/category-swatch";

// Au-delà, « + N » ouvre le détail du jour.
const SHOWN_PER_DAY = 3;

export type CalendarLabels = { weekdays: string[]; dayTitles: Record<string, string> };

function ItemLine({ item, compact }: { item: CalendarItem; compact: boolean }) {
  const t = useTranslations("Today");
  const kind = item.categoryLabel ?? t(`calendar.kind.${item.kind}`);
  return (
    <Link href={item.href} className={`calendar-item calendar-item-${item.kind}${item.overdue ? " is-overdue" : ""}`} title={compact ? `${kind} · ${item.label}` : undefined}>
      {item.kind !== "event" && item.color ? <CategorySwatch color={item.color} shape="bar" /> : null}
      <span className="calendar-item-label">{item.label}</span>
      {/* Le nom de la catégorie, toujours lu ; écrit en entier hors de la grille. */}
      <span className={compact ? "sr-only" : "calendar-item-kind"}>{` · ${kind}`}</span>
      {!compact && item.detail ? <span className="calendar-item-detail">{` · ${item.detail}`}</span> : null}
      {item.highPriority ? <span className={compact ? "sr-only" : "badge badge-ambre"}>{` ${t("calendar.high")}`}</span> : null}
      {item.overdue ? <span className={compact ? "sr-only" : "badge badge-terracotta"}>{` ${t("calendar.overdue")}`}</span> : null}
    </Link>
  );
}

export function TodayCalendarClient({ weeks, week, labels, legend }: { weeks: CalendarDay[][]; week: CalendarDay[]; labels: CalendarLabels; legend: { label: string; color: string | null }[] }) {
  const t = useTranslations("Today");
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState<CalendarDay | null>(null);
  const open = (day: CalendarDay) => {
    setOpened(day);
    dialog.current?.showModal();
  };

  return (
    <>
      <div className="calendar-month" role="table" aria-label={t("calendar.gridLabel")}>
        <div className="calendar-weekdays" role="row">
          {labels.weekdays.map((day, index) => (
            <span key={index} role="columnheader">
              {day}
            </span>
          ))}
        </div>
        {weeks.map((days) => (
          <div key={days[0]!.date} className="calendar-week" role="row">
            {days.map((day) => (
              <div key={day.date} role="cell" className={`calendar-day${day.inMonth ? "" : " is-outside"}${day.today ? " is-today" : ""}${day.weekend ? " is-weekend" : ""}`} aria-current={day.today ? "date" : undefined}>
                {day.inMonth ? (
                  <>
                    <button type="button" className="calendar-day-num" aria-label={t("calendar.openDay", { day: labels.dayTitles[day.date] ?? day.date, count: day.items.length })} onClick={() => open(day)}>
                      {day.day}
                    </button>
                    <ul>
                      {day.items.slice(0, SHOWN_PER_DAY).map((item) => (
                        <li key={item.key}>
                          <ItemLine item={item} compact />
                        </li>
                      ))}
                    </ul>
                    {day.items.length > SHOWN_PER_DAY ? (
                      <button type="button" className="calendar-more" onClick={() => open(day)}>
                        {t("calendar.more", { count: day.items.length - SHOWN_PER_DAY })}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="calendar-day-num" aria-hidden="true">
                    {day.day}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <ul className="calendar-legend" aria-label={t("calendar.legend")}>
        {legend.map((entry) => (
          <li key={entry.label}>
            {entry.color ? <CategorySwatch color={entry.color} /> : <span className="calendar-legend-event" aria-hidden="true" />}
            {entry.label}
          </li>
        ))}
      </ul>
      {/* Sur téléphone : la semaine en cours, en liste. */}
      <ol className="calendar-week-list" aria-label={t("calendar.weekLabel")}>
        {week.map((day) => (
          <li key={day.date} aria-current={day.today ? "date" : undefined}>
            <p className="calendar-week-day">{labels.dayTitles[day.date] ?? day.date}</p>
            {day.items.length === 0 ? (
              <p className="muted">{t("calendar.dayEmpty")}</p>
            ) : (
              <ul>
                {day.items.map((item) => (
                  <li key={item.key}>
                    <ItemLine item={item} compact={false} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <dialog ref={dialog} className="task-dialog" aria-labelledby="calendar-day-title" onClose={() => setOpened(null)}>
        <div className="task-dialog-head">
          <h2 id="calendar-day-title">{opened ? (labels.dayTitles[opened.date] ?? opened.date) : ""}</h2>
          <button type="button" className="button-ghost" onClick={() => dialog.current?.close()}>
            <span className="task-dialog-back">{t("calendar.back")}</span>
            <span className="task-dialog-x">{t("calendar.close")}</span>
          </button>
        </div>
        <div className="task-dialog-body">
          {opened && opened.items.length > 0 ? (
            <ul className="calendar-day-items">
              {opened.items.map((item) => (
                <li key={item.key}>
                  <ItemLine item={item} compact={false} />
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("calendar.dayEmpty")}</p>
          )}
        </div>
      </dialog>
    </>
  );
}
