// Lot 71b (HUB-14, PAR-01, UX-02 ; spécification du lot 71, § 5.2 ; maquette 06) — la page « Reprendre un
// mariage en cours », vide, en cours ou terminée : le titre (le mariage, s'il existe), la phrase, le
// compteur « 3 fichiers sur 6 », les six lignes dans l'ordre, puis ce qui vient ensuite. Terminée, elle
// compte ce qui reste à compléter et passe la main à la fiche : jamais « tout est à jour » (C-55).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { doneMoment } from "@/lib/tasks/task-lines";
import type { TakeoverPageModel } from "@/lib/takeover/flow";
import { TakeoverStep } from "./takeover-step";

function listFormat(items: string[], locale: Locale): string {
  return new Intl.ListFormat(locale === "fr" ? "fr-FR" : "en-GB", { style: "long", type: "conjunction" }).format(items);
}

export async function TakeoverView({ model }: { model: TakeoverPageModel }) {
  const t = await getTranslations("Takeover");
  const tHelp = await getTranslations("Help");
  const tEvents = await getTranslations("Events");
  const locale = (await getLocale()) as Locale;
  const started = doneMoment(model.createdAt.toISOString(), locale);
  const lastDecision = model.rows.map((row) => row.at ?? row.decidedAt).filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const finished = model.state === "done" && lastDecision ? doneMoment(lastDecision.toISOString(), locale) : null;

  const subtitle = model.eventId
    ? [
        model.eventDate ? t("eventDate", { date: formatCalendarDate(model.eventDate, locale) }) : t("eventNoDate"),
        finished
          ? t("doneSummary", { date: finished.date, time: finished.time })
          : model.id
            ? started.day === parisToday()
              ? t("startedToday", { time: started.time })
              : t("startedOn", { date: started.date, time: started.time })
            : null,
        model.state === "done" ? null : t("nothingWritten"),
      ]
        .filter(Boolean)
        .join(" · ")
    : t("intro", { days: model.undoRetentionDays });

  const points = model.toComplete.map((point) => t(`point.${point.key}`, { count: point.count }));

  return (
    <main className="takeover-page">
      <p className="takeover-back">
        {model.eventId && model.eventName ? <Link href={`/events/${model.eventId}`}>‹ {model.eventName}</Link> : <Link href="/events">‹ {tEvents("title")}</Link>}
      </p>
      <div className="takeover-head">
        <div>
          <h1>{model.eventName ? t("titleEvent", { event: model.eventName }) : t("title")}</h1>
          <p className="meta">{subtitle}</p>
        </div>
        <p className="takeover-progress" role="status">
          {t("progress", { settled: model.progress.settled, total: model.progress.total })}
        </p>
      </div>
      <ScreenHelp title={tHelp("takeover.title")} body={tHelp("takeover.body")} />

      {model.openTakeovers.length > 0 ? (
        <section className="notice takeover-open" aria-labelledby="takeover-open-title">
          <h2 id="takeover-open-title">{t("openTitle")}</h2>
          <ul>
            {model.openTakeovers.map((open) => {
              const name = open.eventName ?? t("openUnnamed");
              return (
                <li key={open.id}>
                  {t("openLine", { event: name, progress: t("progress", { settled: open.progress.settled, total: open.progress.total }) })}{" "}
                  <Link href={`/reprise/${open.id}`} aria-label={t("openContinue", { event: name })}>
                    {t("action.continue")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {model.state === "done" ? (
        <section className="takeover-done" aria-labelledby="takeover-done-title">
          <h2 id="takeover-done-title">{t("doneTitle", { count: points.length })}</h2>
          {points.length > 0 ? <p>{t("doneBody", { list: listFormat(points, locale) })}</p> : null}
          {model.eventId ? (
            <Link href={`/events/${model.eventId}#a-completer`} className="button-link button-link-primary">
              {t("openToComplete")}
            </Link>
          ) : null}
        </section>
      ) : null}

      <ol className="takeover-steps" aria-label={t("stepsLabel")}>
        {model.rows.map((row) => (
          <TakeoverStep key={row.kind} row={row} page={model} />
        ))}
      </ol>

      <div className="takeover-foot">
        {model.state === "done" ? (
          <p>
            {model.withdrawUntil ? <>{t("withdrawUntil", { date: formatCalendarDate(parisToday(model.withdrawUntil), locale), days: model.undoRetentionDays })} </> : null}
            <Link href="/reprise">{t("another")}</Link>
          </p>
        ) : model.eventId ? (
          <p>
            {t("laterOnEvent")} <Link href={`/events/${model.eventId}`}>{t("action.openEvent")}</Link>
          </p>
        ) : (
          <p>
            {t("several")} <Link href="/aide/ecrans/takeover">{t("howToExport")}</Link>
          </p>
        )}
      </div>
    </main>
  );
}
