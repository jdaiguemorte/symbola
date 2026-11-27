// Lot 71f (HUB-08, UX-01 ; spécification du lot 71, § 5.6 ; maquette 09, « Aujourd'hui » ; C-15, C-20,
// C-53) — sur « Aujourd'hui », la section « Reprises en cours » : une ligne par mariage en reprise, le nom
// du mariage en lien séparé (M4), où en est sa reprise et le geste qui la continue. Aucune relance n'y
// naît d'un import ; le compteur des points de l'accueil ne compte pas les reprises (C-20). Le même calcul
// que la fiche et la liste (lib/takeover/checklist.ts) : un nombre annoncé ici est celui de la fiche.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { getEventNamesByIds } from "@/modules/events/service";
import type { TakeoverViewer } from "@/modules/hub/service";
import { listTakeoversInProgress } from "@/lib/takeover/checklist";

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
}

export async function TakeoversInProgress({ organizationId, viewer, locale, today }: { organizationId: string; viewer: TakeoverViewer | null; locale: Locale; today: string }) {
  const entries = await listTakeoversInProgress(organizationId, viewer);
  if (entries.length === 0) return null;
  const t = await getTranslations("TakeoverSheet");
  const names = await getEventNamesByIds(organizationId, entries.map((entry) => entry.eventId));
  const when = (date: Date) => {
    const day = parisToday(date);
    const gap = dayNumber(today) - dayNumber(day);
    return gap === 0 ? t("today") : gap === 1 ? t("yesterday") : t("onDate", { date: formatCalendarDate(day, locale) });
  };
  return (
    <section className="card takeovers-in-progress" aria-labelledby="takeovers-in-progress-title">
      <div className="section-head">
        <h2 id="takeovers-in-progress-title">{t("inProgressTitle")}</h2>
        <p className="meta">{t("inProgressCount", { count: entries.length })}</p>
      </div>
      <ul>
        {entries.map((entry) => {
          const name = names[entry.eventId] ?? "";
          const parts =
            entry.mark.kind === "files"
              ? [t("inProgressFiles", { settled: entry.mark.settled, total: entry.mark.total }), entry.running ? t("inProgressRunning", { step: t(`runningStep.${entry.running}`) }) : null]
              : [entry.finishedAt ? t("inProgressFinished", { when: when(entry.finishedAt) }) : null, t("inProgressPoints", { count: entry.mark.count })];
          return (
            <li key={entry.takeoverId}>
              <Link href={`/events/${entry.eventId}`}>{name}</Link>
              <span className="meta">· {parts.filter(Boolean).join(" · ")}</span>
              {entry.mark.kind === "files" ? (
                <Link className="button-link takeover-in-progress-action" href={`/reprise/${entry.takeoverId}`} aria-label={t("inProgressContinueFor", { event: name })}>
                  {t("inProgressContinue")}
                </Link>
              ) : (
                <Link className="button-link takeover-in-progress-action" href={`/events/${entry.eventId}#a-completer`} aria-label={t("inProgressSeeRestFor", { event: name })}>
                  {t("inProgressSeeRest")}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
