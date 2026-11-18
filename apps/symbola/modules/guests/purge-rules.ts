// Lot 49 (RGP-08 ; D9 ; réponses 2 et 3 de la DPO) — règles pures de la purge des invités, en jours
// de Paris : comptée depuis le dernier jour de l'évènement (le brunch du lendemain compte) ou depuis
// son annulation ; régimes et allergies d'abord, le reste ensuite ; préavis avant chacune ; un seul
// report, motivé, jamais au-delà de la valeur de départ plus un report.
import type { EventStatus } from "@symbola/contracts";
import { addDays } from "./rsvp";

export type GuestRetention = { dietDays: number; allDays: number; maxPostponeDays: number };

export function purgeBaseDate(input: { status: EventStatus; cancelledOn: string | null; eventDate: string | null; keyMomentDates: string[] }): string | null {
  if (input.status === "cancelled" && input.cancelledOn) return input.cancelledOn;
  const dates = [...input.keyMomentDates, ...(input.eventDate ? [input.eventDate] : [])].sort();
  return dates.at(-1) ?? null;
}

const min = (a: string, b: string) => (a < b ? a : b);
const max = (a: string, b: string) => (a > b ? a : b);

export function purgeSchedule(baseDate: string, retention: GuestRetention, postponedUntil: string | null): { dietsDueOn: string; allDueOn: string; latestPostponeOn: string } {
  const dietsDueOn = addDays(baseDate, retention.dietDays);
  const allDueOn = addDays(baseDate, retention.allDays);
  const latestPostponeOn = addDays(allDueOn, retention.maxPostponeDays);
  if (!postponedUntil) return { dietsDueOn, allDueOn, latestPostponeOn };
  return {
    dietsDueOn: max(dietsDueOn, min(postponedUntil, addDays(dietsDueOn, retention.maxPostponeDays))),
    allDueOn: max(allDueOn, min(postponedUntil, latestPostponeOn)),
    latestPostponeOn,
  };
}

// L'échéance est atteinte le jour même (ADR 0024).
export function isDue(dueOn: string, today: string): boolean {
  return today >= dueOn;
}

export function noticeOn(dueOn: string, noticeDays: number): string {
  return addDays(dueOn, -noticeDays);
}

export function noticeActive(dueOn: string, today: string, noticeDays: number): boolean {
  return today >= noticeOn(dueOn, noticeDays) && today < dueOn;
}

export type PostponementProblem = "already_postponed" | "already_purged" | "reason_missing" | "too_early" | "too_late";

// La nouvelle date dépasse l'échéance en cours (régimes s'ils ne sont pas purgés, sinon le reste).
export function validatePostponement(input: {
  until: string;
  reason: string;
  today: string;
  schedule: { dietsDueOn: string; allDueOn: string; latestPostponeOn: string };
  dietsPurged?: boolean;
  alreadyPostponed: boolean;
  purged: boolean;
}): PostponementProblem | null {
  if (input.purged) return "already_purged";
  if (input.alreadyPostponed) return "already_postponed";
  if (input.reason.trim().length < 3) return "reason_missing";
  const pending = input.dietsPurged ? input.schedule.allDueOn : min(input.schedule.dietsDueOn, input.schedule.allDueOn);
  if (input.until <= input.today || input.until <= pending) return "too_early";
  if (input.until > input.schedule.latestPostponeOn) return "too_late";
  return null;
}
