// Lot 72d (EVT-02, EVT-05, UX-06 ; C-22, C-25, C-27 ; E1, E2, E4, J9 ; page 15 des maquettes du lot 68) —
// les règles de l'en-tête de la fiche d'un évènement, sans accès à la base ni texte : l'action de l'en-tête
// (« Écrire aux mariés », ou « Ouvrir le Jour J » de J-N au lendemain), les quatre étapes de la frise en
// lecture, la ligne d'état qui la remplace (reporté, annulé, archivé) et le geste de l'étape suivante.
import type { EventDisplayStep, EventPhase, EventStatus, EventStatusDates } from "@symbola/contracts";
import { dateInTimeZone } from "@symbola/i18n";
import { displayStep } from "@/modules/events/service";

// L'écran du jour J existe pour un évènement signé et daté, et encore une fois clôturé (lot 29a).
const DAY_OF_STATUSES: readonly EventStatus[] = ["confirmed", "closed"];

type DatedEvent = { status: EventStatus; eventDate: string | null; timeZone: string };

function addDays(date: string, days: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function isDayOfScreenOpen(event: Pick<DatedEvent, "status" | "eventDate">): boolean {
  return DAY_OF_STATUSES.includes(event.status) && event.eventDate !== null;
}

// J9 : « Ouvrir le Jour J » prend la place de « Écrire aux mariés » de J-N au lendemain inclus, N étant le
// réglage de l'organisation ; les jours se comptent dans le fuseau de l'évènement (ARC-17).
export function headerAction(event: DatedEvent, leadDays: number, now: Date = new Date()): "day_of" | "write" {
  if (!isDayOfScreenOpen(event) || event.eventDate === null) return "write";
  const today = dateInTimeZone(now, event.timeZone);
  return today >= addDays(event.eventDate, -leadDays) && today <= addDays(event.eventDate, 1) ? "day_of" : "write";
}

export type TimelineStepView = {
  step: EventDisplayStep;
  state: "passed" | "current" | "upcoming";
  // La date à dire : franchie (« 12 mars »), en cours (« depuis le 2 avr. »), à venir (le jour J seul).
  date: string | null;
};

export type StatusLineView =
  | { kind: "postponed"; previousDate: string | null }
  | { kind: "cancelled"; date: string | null }
  | { kind: "archived" };

export type EventTimelineView = {
  // Reporté, annulé ou archivé : une ligne d'état remplace la frise (E1, critère 7).
  line: StatusLineView | null;
  steps: TimelineStepView[];
  current: EventDisplayStep | null;
  // Le geste de l'étape suivante, quand elle se franchit à la main (E2) : « Le contrat est signé… » pour
  // une demande, « Clôturer l'évènement… » le lendemain du jour J ; « Jour J » vient seul.
  gesture: "sign" | "close" | null;
};

export const TIMELINE_STEPS: readonly EventDisplayStep[] = ["request", "signed", "day_of", "closed"];

const STATUS_OF_STEP: Record<EventDisplayStep, EventStatus | null> = { request: "option", signed: "confirmed", day_of: null, closed: "closed" };

export function eventTimeline(input: {
  status: EventStatus;
  phase: EventPhase;
  dates: EventStatusDates;
  eventDate: string | null;
  postponedFromDate: string | null;
  archived: boolean;
  closingDue: boolean;
}): EventTimelineView {
  const line: StatusLineView | null = input.archived
    ? { kind: "archived" }
    : input.status === "postponed"
      ? { kind: "postponed", previousDate: input.postponedFromDate }
      : input.status === "cancelled"
        ? { kind: "cancelled", date: input.dates.cancelled ?? null }
        : null;
  const current = line ? null : displayStep(input.status, input.phase);
  const currentIndex = current ? TIMELINE_STEPS.indexOf(current) : -1;
  const steps = TIMELINE_STEPS.map((step, index): TimelineStepView => {
    const state = index < currentIndex ? "passed" : index === currentIndex ? "current" : "upcoming";
    const status = STATUS_OF_STEP[step];
    const recorded = status ? (input.dates[status] ?? null) : input.eventDate;
    const date = step === "day_of" ? input.eventDate : state === "upcoming" ? null : recorded;
    return { step, state, date };
  });
  const gesture = line ? null : current === "request" ? "sign" : current === "signed" && input.closingDue ? "close" : null;
  return { line, steps, current, gesture };
}
