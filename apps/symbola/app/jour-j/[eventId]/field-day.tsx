"use client";

// Lot 30a (JRJ-01, JRJ-03, UX-05 ; décisions D2, D3 et D5) — écran de terrain du jour J :
// « Maintenant » et « Ensuite » en gros caractères, calculés sur l'appareil à l'heure
// de Paris et remis à jour chaque demi-minute (sans réseau aussi) ; barre du bas dans
// la zone du pouce : l'appel du contact de la séquence en cours, et quatre onglets.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { dayMoment, durationParts, timelineSpans, type DayMoment } from "./day-timeline";

export type FieldCall = { name: string; phone: string; tel: string };
export type FieldItem = {
  id: string;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  note: string | null;
  participants: string;
  calls: FieldCall[];
};

function clock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function FieldDay({ eventDate, items }: { eventDate: string; items: FieldItem[] }) {
  const t = useTranslations("DayOf");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const spans = new Map(timelineSpans(items).map((span) => [span.id, span]));
  const byId = new Map(items.map((item) => [item.id, item]));
  const moment: DayMoment | null = now ? dayMoment(items, eventDate, now) : null;
  const duration = (minutes: number) => {
    const { hours, minutes: rest } = durationParts(minutes);
    return hours === 0 ? t("durationMinutes", { minutes: rest }) : rest === 0 ? t("durationHours", { hours }) : t("durationHoursMinutes", { hours, minutes: rest });
  };
  const hoursOf = (id: string) => {
    const span = spans.get(id)!;
    return t("fieldHours", { start: clock(span.start), end: clock(span.end), duration: duration(span.end - span.start) });
  };

  const current = moment?.phase === "now" ? byId.get(moment.currentId) : undefined;
  const nextId = moment?.phase === "now" || moment?.phase === "pause" || moment?.phase === "before" ? moment.nextId : null;
  const next = nextId ? byId.get(nextId) : undefined;
  const primaryCall = current?.calls[0];

  return (
    <>
      <section id="maintenant" className="field-cards" aria-label={t("fieldSection")}>
        <article className="field-card field-card-now" aria-labelledby="field-now-title">
          <h2 id="field-now-title" className="field-kicker">
            {t("nowTitle")}
          </h2>
          {moment === null ? (
            <p className="field-now">…</p>
          ) : moment.phase === "now" && current ? (
            <>
              <p className="field-now">{current.label}</p>
              <p className="field-line">{hoursOf(current.id)}</p>
              {current.location ? <p className="field-line">{current.location}</p> : null}
              {current.participants ? <p className="field-line">{current.participants}</p> : null}
              {current.note ? <p className="field-note">{current.note}</p> : null}
              <p className="field-line">{t("remaining", { duration: duration(moment.endsInMinutes) })}</p>
              {current.calls.length > 0 ? (
                <ul className="field-calls">
                  {current.calls.map((call) => (
                    <li key={call.tel + call.name}>
                      <a className="field-action" href={call.tel} aria-label={t("callLabel", { name: call.name, phone: call.phone })}>
                        {t("callName", { name: call.name })}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : moment.phase === "pause" ? (
            <>
              <p className="field-now">{t("pause")}</p>
              <p className="field-line">{t("pauseUntil", { time: clock(spans.get(moment.nextId)!.start) })}</p>
            </>
          ) : moment.phase === "before" ? (
            <p className="field-now">{moment.daysUntil === 1 ? t("beforeTomorrow") : t("beforeDays", { days: moment.daysUntil })}</p>
          ) : moment.phase === "over" ? (
            <p className="field-now">{t("over")}</p>
          ) : (
            <p className="field-now">{t("programEmpty")}</p>
          )}
        </article>
        <article className="field-card" aria-labelledby="field-next-title">
          <h2 id="field-next-title" className="field-kicker">
            {t("nextTitle")}
          </h2>
          {next ? (
            <>
              <p className="field-next">{next.label}</p>
              <p className="field-line">
                {moment && (moment.phase === "now" || moment.phase === "pause") && moment.nextStartsInMinutes !== null
                  ? t("nextAt", { time: clock(spans.get(next.id)!.start), duration: duration(moment.nextStartsInMinutes) })
                  : hoursOf(next.id)}
              </p>
              {next.location ? <p className="field-line">{next.location}</p> : null}
              {next.participants ? <p className="field-line">{next.participants}</p> : null}
            </>
          ) : (
            <p className="field-line">{moment === null ? "…" : t("nothingNext")}</p>
          )}
        </article>
      </section>

      <nav className="field-bar" aria-label={t("fieldBar")}>
        {primaryCall ? (
          <a className="field-action field-bar-call" href={primaryCall.tel} aria-label={t("callLabel", { name: primaryCall.name, phone: primaryCall.phone })}>
            {t("callName", { name: primaryCall.name })}
          </a>
        ) : null}
        <ul className="field-tabs">
          <li>
            <a href="#maintenant">{t("navNow")}</a>
          </li>
          <li>
            <a href="#programme">{t("navProgram")}</a>
          </li>
          <li>
            <a href="#contacts">{t("navContacts")}</a>
          </li>
          <li>
            <a href="#documents">{t("navDocuments")}</a>
          </li>
        </ul>
      </nav>
    </>
  );
}
