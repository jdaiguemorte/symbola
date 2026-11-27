// Lot 32a (HUB-08, UX-01, UX-06 ; décisions D2 à D4) — l'écran « Aujourd'hui » : « À traiter en
// premier », le reste par groupe (replié au-delà de quatre lignes), puis « Mes évènements ». Lot 65c :
// sept lignes en premier, par nature. Chaque ligne dit ce qu'il faut faire, pour quel évènement, quand, qui doit agir,
// et propose l'action en un clic.
import { TaskLine } from "@/app/ui/task-line";
import type { TaskLineView } from "@/lib/tasks/task-line";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { EventSummary } from "@symbola/contracts";
import { eventNames } from "@/modules/events/service";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "@/app/events/event-status";
import type { RankedItem, TodayGroup } from "@/lib/today/rank";
import type { TodaySource, TodayWords } from "@/lib/today/load";
import { completeTaskAction } from "./actions";
import { completeStandaloneTaskAction } from "@/app/taches/standalone-actions";
import { NoteReminderButton } from "./note-reminder";

type TodayTranslator = Awaited<ReturnType<typeof getTranslations<"Today">>>;

export function todayWords(t: TodayTranslator): TodayWords {
  return {
    clientTask: t("words.clientTask"),
    amount: (label, amount) => t("words.amount", { label, amount }),
    decision: (title) => t("words.decision", { title }),
    paymentDeclaration: (label, amount) => t("words.paymentDeclaration", { label, amount }),
    quoteFollowUp: (number) => t("words.quoteFollowUp", { number }),
    prospectFollowUp: t("words.prospectFollowUp"),
    depositBlocked: (number) => t("words.depositBlocked", { number }),
    vendorContract: (vendor, slot) => t("words.vendorContract", { vendor, slot }),
    dateConflict: (count) => t("words.dateConflict", { count }),
    // Lot 58 (PAR-09) : l'évènement passé dont la liste de clôture attend.
    closingDue: t("words.closingDue"),
    linkRenewal: (name) => t("words.linkRenewal", { name }),
    guestPurge: (stage) => t(stage === "diets" ? "words.guestPurgeDiets" : "words.guestPurgeAll"),
    guestOpposition: (count) => t("words.guestOpposition", { count }),
    appointment: (time, type, person) => t("words.appointment", { time, type, person }),
    appointmentChange: (change, time, type, person) => t(`words.appointmentChange.${change}`, { time, type, person }),
    calendarSourceError: (label) => t("words.calendarSourceError", { label }),
    prospectRequest: (names, when) => (when ? t("words.prospectRequest", { names, when }) : t("words.prospectRequestNoDate", { names })),
    prospectRequestDateTaken: t("words.prospectRequestDateTaken"),
    prospectToReview: (count) => t("words.prospectToReview", { count }),
    // Lot 45 (CRM-06, POR-07, CRM-07).
    followUpReady: (names) => t("words.followUpReady", { names }),
    questionnaireFinished: (names, questionnaire) => t("words.questionnaireFinished", { names, questionnaire }),
    contactDuplicates: (count) => t("words.contactDuplicates", { count }),
    vendorAnswer: (vendor, slot, answer) => t(`words.vendorAnswer.${answer}`, { vendor, slot }),
    vendorChoice: (vendor, slot) => t("words.vendorChoice", { vendor, slot }),
    vendorRoadmap: (vendor) => t("words.vendorRoadmap", { vendor }),
    transferDeclaration: (name, amount) => t("words.transferDeclaration", { name, amount }),
    // Lot 48a (PRE-05, PRE-10, SEC-27).
    vendorDocument: (vendor, document, reason) => t(`words.vendorDocument.${reason}`, { vendor, document }),
    vendorBankCheck: (vendor) => t("words.vendorBankCheck", { vendor }),
    standaloneTask: t("words.standaloneTaskTag"),
  };
}

// « Vendredi 13 novembre 2026 » : la date du jour, à Paris.
export function longDate(now: Date, locale: Locale): string {
  const text = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(now);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

const GROUP_BADGE: Record<TodayGroup, string> = { overdue: "badge badge-terracotta", today: "badge badge-sauge", waiting: "badge badge-ambre", upcoming: "badge" };
const GROUP_VISIBLE = 4;

function whenLabel(item: RankedItem, t: TodayTranslator, locale: Locale): string {
  if (item.group === "overdue") return t("due.overdue", { days: item.daysLate });
  if (item.group === "today" && item.dueOn !== null) return t("due.today");
  if (item.dueOn !== null) return t("due.on", { date: formatCalendarDate(item.dueOn, locale) });
  if (item.since !== null) return t("due.since", { date: formatCalendarDate(item.since, locale) });
  return t(`group.${item.group}`);
}

function actorLabel(item: RankedItem, t: TodayTranslator): string {
  return item.actor.kind === "vendor" ? t("actor.vendor", { name: item.actor.name }) : t(`actor.${item.actor.kind}`);
}

export async function TodayItemLine({ item, locale, returnTo, taskLine }: { item: RankedItem; locale: Locale; returnTo: "home" | "event"; taskLine?: TaskLineView | undefined }) {
  // Lot 70c (CHR-02, HUB-08 ; D3, M3, M4) : une tâche prend la ligne type allégée — titre en encre qui ouvre
  // le panneau, nom du mariage en lien séparé vers sa fiche, échéance et son état, qui s'en charge, « Fait »
  // (confiée aux mariés comprise), sans menu ; « Ouvrir » disparaît.
  if (taskLine) return <TaskLine line={taskLine} form="today" shortcuts={[]} assignOptions={[]} />;
  const t = await getTranslations("Today");
  const meta = [returnTo === "home" ? item.eventNames : null, item.detail].filter((part): part is string => Boolean(part)).join(" · ");
  return (
    <li className="today-item" data-group={item.group}>
      <div className="today-item-body">
        <Link href={item.href} className="today-item-title">
          {item.title}
        </Link>
        {meta ? <p className="today-item-meta">{meta}</p> : null}
        <p className="today-item-tags">
          <span className={GROUP_BADGE[item.group]}>{whenLabel(item, t, locale)}</span>
          <span className="today-item-actor">{actorLabel(item, t)}</span>
        </p>
      </div>
      {item.action?.kind === "check_task" ? (
        <form action={completeTaskAction} className="today-action">
          <input type="hidden" name="eventId" value={item.action.eventId} />
          <input type="hidden" name="taskId" value={item.action.taskId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" aria-label={t("action.checkTaskLabel", { label: item.title })}>
            {t("action.checkTask")}
          </button>
        </form>
      ) : item.action?.kind === "check_standalone_task" ? (
        <form action={completeStandaloneTaskAction} className="today-action">
          <input type="hidden" name="taskId" value={item.action.taskId} />
          <button type="submit" aria-label={t("action.checkTaskLabel", { label: item.title })}>
            {t("action.checkTask")}
          </button>
        </form>
      ) : item.action?.kind === "remind_vendor" && item.actor.kind === "vendor" ? (
        <NoteReminderButton eventId={item.action.eventId} candidateId={item.action.candidateId} vendorName={item.actor.name} />
      ) : (
        <div className="today-action">
          <Link href={item.href} className="button-link" aria-label={t("action.openLabel", { title: item.title })}>
            {t("action.open")}
          </Link>
        </div>
      )}
    </li>
  );
}

// ARC-07 : une source lente ou en panne est signalée ; le reste de la liste s'affiche.
export async function UnavailableNotice({ sources }: { sources: TodaySource[] }) {
  if (sources.length === 0) return null;
  const t = await getTranslations("Today");
  return (
    <p className="notice" role="status">
      {t("unavailable", { sources: sources.map((source) => t(`source.${source}`)).join(", ") })}
    </p>
  );
}
