"use client";

// Lot 64 (RDV-02, RDV-03 ; maquette M8) — choisir un créneau, à la manière des outils du marché : le
// mois (les jours libres en émeraude, les autres barrés, sans dire pourquoi), puis les heures du jour
// choisi ; un clic sur une heure la transforme en « 10:00 | Suivant ». Partagé par la page publique
// de réservation et le déplacement par lien (/rdv). Heures de Paris (ARC-17).
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";

const ZONE = "Europe/Paris";

function zonedDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function monthCells(month: string): (string | null)[] {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const lead = (new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay() + 6) % 7; // lundi d'abord
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, monthIndex - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function SlotPicker({
  slots,
  locale,
  today,
  initialSlot = null,
  chooseLabel,
  onChoose,
  notice = null,
  emptyText,
  headingRef,
  pending = false,
}: {
  slots: string[];
  locale: string;
  today: string;
  initialSlot?: string | null;
  chooseLabel: string;
  onChoose: (slot: string) => void;
  notice?: ReactNode;
  emptyText: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  pending?: boolean;
}) {
  const t = useTranslations("Appointments.public");
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  const time = new Intl.DateTimeFormat(tag, { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });
  const longDay = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shortDay = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const monthName = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayNames = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2027, 2, 1 + index))));
  const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slot of slots) {
      const date = zonedDate(new Date(slot));
      map.set(date, [...(map.get(date) ?? []), slot]);
    }
    return map;
  }, [slots]);
  const sortedDays = [...byDay.keys()].sort();
  const firstDay = sortedDays[0] ?? today;
  const lastDay = sortedDays.at(-1) ?? today;
  const startDay = initialSlot && byDay.has(zonedDate(new Date(initialSlot))) ? zonedDate(new Date(initialSlot)) : firstDay;
  const [month, setMonth] = useState(startDay.slice(0, 7));
  const [day, setDay] = useState<string | null>(byDay.has(startDay) ? startDay : null);
  const [slot, setSlot] = useState<string | null>(initialSlot);
  // Le bouton d'une heure devient « 10:00 | Suivant » : le focus passe à « Suivant » (WCAG 2.4.3).
  const chooseRef = useRef<HTMLButtonElement>(null);
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current && slot) chooseRef.current?.focus();
  }, [slot]);
  const cells = monthCells(month);
  const daySlots = day ? (byDay.get(day) ?? []) : [];

  return (
    <>
      <section className="booking-calendar" aria-labelledby="calendar-title">
        <h2 id="calendar-title" ref={headingRef} tabIndex={-1}>
          {t("chooseDay")}
        </h2>
        {notice}
        <div className="booking-month">
          <button type="button" className="button-secondary booking-month-nav" aria-label={t("previousMonth")} disabled={month <= firstDay.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <p className="booking-month-name" aria-live="polite">
            {monthName.format(dayOf(`${month}-01`))}
          </p>
          <button type="button" className="button-secondary booking-month-nav" aria-label={t("nextMonth")} disabled={month >= lastDay.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
        <div className="booking-grid" role="grid" aria-label={monthName.format(dayOf(`${month}-01`))}>
          <div role="row" className="booking-grid-row">
            {weekdayNames.map((name) => (
              <span key={name} role="columnheader" className="booking-weekday">
                {name}
              </span>
            ))}
          </div>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <div key={row} role="row" className="booking-grid-row">
              {cells.slice(row * 7, row * 7 + 7).map((date, index) => {
                if (!date) return <span key={index} role="gridcell" className="booking-day booking-day-empty" />;
                const available = byDay.has(date);
                const selected = date === day;
                return (
                  <span key={date} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      className={selected ? "booking-day booking-day-selected" : available ? "booking-day booking-day-available" : "booking-day booking-day-off"}
                      disabled={!available}
                      aria-label={`${longDay.format(dayOf(date))}, ${available ? t("dayAvailable") : t("dayUnavailable")}`}
                      aria-pressed={selected}
                      onClick={() => {
                        setDay(date);
                        setSlot(null);
                      }}
                    >
                      {Number(date.slice(8))}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <p className="booking-zone">{t("timeZone")}</p>
      </section>
      <section className="booking-times" aria-labelledby="times-title">
        <h2 id="times-title">{day ? longDay.format(dayOf(day)) : t("pickDayFirst")}</h2>
        {slots.length === 0 ? <p>{emptyText}</p> : null}
        <ul className="booking-time-list">
          {daySlots.map((candidate) => (
            <li key={candidate}>
              {candidate === slot ? (
                <span className="booking-time-pick">
                  <span className="booking-time-chosen">{time.format(new Date(candidate))}</span>
                  <button ref={chooseRef} type="button" disabled={pending} onClick={() => onChoose(candidate)} aria-label={t("chooseWithSlot", { action: chooseLabel, slot: `${shortDay.format(dayOf(day!))} ${time.format(new Date(candidate))}` })}>
                    {chooseLabel}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="booking-time"
                  onClick={() => {
                    picked.current = true;
                    setSlot(candidate);
                  }}
                >
                  {time.format(new Date(candidate))}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="booking-delay">{t("delayNotice")}</p>
      </section>
    </>
  );
}
