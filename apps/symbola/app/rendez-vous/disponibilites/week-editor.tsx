"use client";

// Lot 64 (RDV-02 ; maquette M6) — « Ma semaine », à la manière de Calendly : une ligne par jour, un
// interrupteur ouvert ou fermé, les plages côte à côte (deux au plus), « + Plage », « Copier lundi sur
// les jours ouverts », un seul « Enregistrer » qui dit le nombre de jours modifiés. Les champs gardent
// les noms lus par l'action (d{jour}s{plage}, d{jour}e{plage}) : un jour fermé n'envoie rien.
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type Range = { startTime: string; endTime: string };
type Week = Record<number, Range[]>;

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_RANGE: Range = { startTime: "09:00", endTime: "18:00" };

function weekOf(rules: { weekday: number; startTime: string; endTime: string }[]): Week {
  const week: Week = {};
  for (const weekday of WEEKDAYS) week[weekday] = rules.filter((rule) => rule.weekday === weekday).slice(0, 2).map((rule) => ({ startTime: rule.startTime.slice(0, 5), endTime: rule.endTime.slice(0, 5) }));
  return week;
}

function sameDay(a: Range[], b: Range[]): boolean {
  return a.length === b.length && a.every((range, index) => range.startTime === b[index]!.startTime && range.endTime === b[index]!.endTime);
}

function problem(ranges: Range[]): "order" | "overlap" | null {
  if (ranges.some((range) => !range.startTime || !range.endTime || range.endTime <= range.startTime)) return "order";
  if (ranges.length === 2) {
    const [first, second] = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime)) as [Range, Range];
    if (second.startTime < first.endTime) return "overlap";
  }
  return null;
}

export function WeekEditor({ rules, isDefault, action }: { rules: { weekday: number; startTime: string; endTime: string }[]; isDefault: boolean; action: (formData: FormData) => void | Promise<void> }) {
  const t = useTranslations("Appointments");
  const initial = useMemo(() => weekOf(rules), [rules]);
  const [week, setWeek] = useState<Week>(initial);
  const changed = WEEKDAYS.filter((weekday) => !sameDay(week[weekday]!, initial[weekday]!)).length;
  const problems = Object.fromEntries(WEEKDAYS.map((weekday) => [weekday, problem(week[weekday]!)]));
  const blocked = WEEKDAYS.some((weekday) => problems[weekday] !== null);

  const setDay = (weekday: number, ranges: Range[]) => setWeek({ ...week, [weekday]: ranges });
  const copyMonday = () => {
    const monday = week[1]!;
    const next: Week = { ...week };
    for (const weekday of WEEKDAYS) if (weekday !== 1 && next[weekday]!.length > 0) next[weekday] = monday.map((range) => ({ ...range }));
    setWeek(next);
  };

  return (
    <form action={action} className="week-editor">
      <div className="week-editor-head">
        <span>{t("weekColumnDay")}</span>
        <span>{t("weekColumnRanges")}</span>
        <button type="button" className="button-secondary week-editor-copy" onClick={copyMonday} disabled={week[1]!.length === 0}>
          {t("weekCopyMonday")}
        </button>
      </div>
      {WEEKDAYS.map((weekday) => {
        const ranges = week[weekday]!;
        const open = ranges.length > 0;
        const day = t(`weekday.${weekday}`);
        return (
          <div key={weekday} className="week-editor-row" role="group" aria-labelledby={`week-day-${weekday}`}>
            <div className="week-editor-day">
              <button type="button" role="switch" aria-checked={open} className="toggle-switch" aria-label={t("weekDayOpen", { day })} onClick={() => setDay(weekday, open ? [] : [{ ...DEFAULT_RANGE }])} />
              <span id={`week-day-${weekday}`}>{day}</span>
            </div>
            <div className="week-editor-ranges">
              {open ? (
                ranges.map((range, index) => (
                  <span key={index} className="week-editor-range">
                    <input
                      type="time"
                      step={900}
                      required
                      name={`d${weekday}s${index}`}
                      value={range.startTime}
                      aria-label={t("weekRangeStart", { day, number: index + 1 })}
                      onChange={(event) => setDay(weekday, ranges.map((item, position) => (position === index ? { ...item, startTime: event.target.value } : item)))}
                    />
                    <span className="week-editor-to">{t("to")}</span>
                    <input
                      type="time"
                      step={900}
                      required
                      name={`d${weekday}e${index}`}
                      value={range.endTime}
                      aria-label={t("weekRangeEnd", { day, number: index + 1 })}
                      onChange={(event) => setDay(weekday, ranges.map((item, position) => (position === index ? { ...item, endTime: event.target.value } : item)))}
                    />
                    <button type="button" className="button-ghost week-editor-remove" aria-label={t("weekRangeRemove", { day, number: index + 1 })} onClick={() => setDay(weekday, ranges.filter((_, position) => position !== index))}>
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="week-editor-closed">{t("weekClosed")}</span>
              )}
              {problems[weekday] ? (
                <span className="week-editor-problem" role="alert">
                  {t(problems[weekday] === "overlap" ? "weekProblemOverlap" : "weekProblemOrder")}
                </span>
              ) : null}
            </div>
            <div className="week-editor-add">
              {open && ranges.length < 2 ? (
                <button type="button" className="button-ghost" aria-label={t("weekAddRangeFor", { day })} onClick={() => setDay(weekday, [...ranges, { startTime: ranges[0]!.endTime < "14:00" ? "14:00" : ranges[0]!.endTime, endTime: "18:00" }])}>
                  {t("weekAddRange")}
                </button>
              ) : open ? (
                <span className="week-editor-max">{t("weekMaxRanges")}</span>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="week-editor-foot">
        <span className="text-label text-ink-muted" aria-live="polite">
          {t("weekChanged", { count: changed })}
        </span>
        <button type="submit" disabled={blocked || (changed === 0 && !isDefault)}>
          {t("weekSave")}
        </button>
      </div>
    </form>
  );
}
