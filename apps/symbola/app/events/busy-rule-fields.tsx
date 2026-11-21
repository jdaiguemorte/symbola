"use client";

// Lot 64 (HUB-29 ; maquettes M2, M4) — les champs d'une plage occupée : début et fin, chacun un jour
// (sept jours avant … sept jours après) et une heure ; un aperçu sur une frise de jours et une phrase
// en clair, mis à jour à chaque changement. Sans date (règle d'un type), l'aperçu prend un samedi.
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { BusyRule } from "@symbola/contracts";
import { addDays, BUSY_DAY_OFFSETS, busyDate, busyDayLabel, busyDuration, busyHour, busyMinutes, busyShortDate, capitalize, type BusyLocale } from "@/lib/events/busy-format";

// Un samedi, pour l'aperçu d'une règle de type.
const SAMPLE_SATURDAY = "2027-06-12";

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + (minutes || 0);
}

export function BusyRuleFields({ defaultRule, eventDate }: { defaultRule: BusyRule; eventDate?: string | null }) {
  const t = useTranslations("Busy");
  const locale = (useLocale() === "en" ? "en" : "fr") as BusyLocale;
  const [rule, setRule] = useState<BusyRule>(defaultRule);
  const id = useId();
  const words = { sameDay: t("sameDay"), dayBefore: (count: number) => t("dayBefore", { count }), dayAfter: (count: number) => t("dayAfter", { count }) };
  const date = eventDate ?? SAMPLE_SATURDAY;
  const optionLabel = (offset: number) => {
    const label = capitalize(busyDayLabel(offset, words));
    return eventDate ? `${label} — ${busyShortDate(addDays(eventDate, offset), locale)}` : label;
  };

  const valid = /^\d{2}:\d{2}$/.test(rule.startTime) && /^\d{2}:\d{2}$/.test(rule.endTime) && busyMinutes(rule) > 0;
  const firstDay = Math.min(rule.startDayOffset, -1);
  const lastDay = Math.max(rule.endDayOffset, 1);
  const days = Array.from({ length: lastDay - firstDay + 1 }, (_, index) => firstDay + index);
  const total = days.length * 1440;
  const left = ((rule.startDayOffset - firstDay) * 1440 + minutesOf(rule.startTime)) / total;
  const width = Math.max(0, busyMinutes(rule)) / total;
  const dayName = (offset: number) => (eventDate ? busyDate(addDays(date, offset), locale) : new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${addDays(date, offset)}T00:00:00Z`)));
  const sentence = !valid
    ? t("invalidOrder")
    : rule.startDayOffset === rule.endDayOffset
      ? t("sentenceSameDay", { day: dayName(rule.startDayOffset), start: busyHour(rule.startTime, locale), end: busyHour(rule.endTime, locale), duration: busyDuration(rule, locale) })
      : t("sentenceSpan", { startDay: dayName(rule.startDayOffset), start: busyHour(rule.startTime, locale), endDay: dayName(rule.endDayOffset), end: busyHour(rule.endTime, locale), duration: busyDuration(rule, locale) });

  const bound = (which: "start" | "end") => {
    const dayKey = which === "start" ? "startDayOffset" : "endDayOffset";
    const timeKey = which === "start" ? "startTime" : "endTime";
    return (
      <div className="busy-bound" role="group" aria-labelledby={`${id}-${which}-title`}>
        <span id={`${id}-${which}-title`} className="busy-bound-title">
          {t(which)}
        </span>
        <label className="busy-bound-field">
          <span>{t("day")}</span>
          <select name={dayKey} value={rule[dayKey]} onChange={(event) => setRule({ ...rule, [dayKey]: Number(event.target.value) })}>
            {BUSY_DAY_OFFSETS.map((offset) => (
              <option key={offset} value={offset}>
                {optionLabel(offset)}
              </option>
            ))}
          </select>
        </label>
        <label className="busy-bound-field">
          <span>{t("hour")}</span>
          <input type="time" name={timeKey} required step={300} value={rule[timeKey]} onChange={(event) => setRule({ ...rule, [timeKey]: event.target.value })} />
        </label>
      </div>
    );
  };

  return (
    <div className="busy-rule-fields">
      {bound("start")}
      {bound("end")}
      <div className="busy-preview">
        <p className="busy-preview-title">{eventDate ? t("previewTitle") : t("previewTitleSample")}</p>
        {/* Frise : la CSP refuse les attributs style ; les jours en grille, la plage en SVG. */}
        <div className="busy-timeline" aria-hidden="true">
          <div className="busy-timeline-days">
            {days.map((offset) => (
              <span key={offset}>{eventDate ? busyShortDate(addDays(date, offset), locale) : dayName(offset)}</span>
            ))}
          </div>
          <svg className="busy-timeline-bar" viewBox={`0 0 ${total} 10`} preserveAspectRatio="none" focusable="false">
            {valid ? <rect x={left * total} y={0} width={width * total} height={10} /> : null}
          </svg>
        </div>
        <p className={valid ? "busy-preview-sentence" : "busy-preview-sentence busy-preview-invalid"} aria-live="polite">
          {sentence}
        </p>
      </div>
    </div>
  );
}
