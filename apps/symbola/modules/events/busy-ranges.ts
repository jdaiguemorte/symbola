// Lot 64 (HUB-29, RDV-02 ; D1 à D6 ; ADR 0109) — plages occupées, sans accès à la base : la règle qui
// s'applique à un évènement (son réglage propre, sinon celle de son type, sinon celle des évènements
// sans type), la plage en instants UTC (heure locale du fuseau de l'évènement, heure d'été comprise)
// et ce qui bloque (statuts sûrs ; options et reports en cours selon le réglage de l'organisation).
import { wallTimeToInstant } from "@/lib/calendar/ics";
import type { BusyRule, BusyRuleSource, EventStatus } from "@symbola/contracts";
import { FIRM_STATUSES, TENTATIVE_STATUSES } from "./lifecycle";

export type { BusyRule, BusyRuleSource };

export const BUSY_DAY_OFFSET_MIN = -7;
export const BUSY_DAY_OFFSET_MAX = 7;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// « 08:00:00 » (colonne time) ou « 08:00 » ⇒ « 08:00 ».
export function shortTime(value: string): string {
  return value.slice(0, 5);
}

function minutesOf(time: string): number {
  const [hours, minutes] = shortTime(time).split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

// Une règle valable : jours de -7 à 7, heures « HH:MM », la fin après le début (D6).
export function isValidBusyRule(rule: BusyRule): boolean {
  const days = [rule.startDayOffset, rule.endDayOffset];
  if (!days.every((day) => Number.isInteger(day) && day >= BUSY_DAY_OFFSET_MIN && day <= BUSY_DAY_OFFSET_MAX)) return false;
  if (!TIME.test(shortTime(rule.startTime)) || !TIME.test(shortTime(rule.endTime))) return false;
  return busyRuleMinutes(rule) > 0;
}

// Durée de la règle, en minutes (négative ou nulle si elle est à l'envers).
export function busyRuleMinutes(rule: BusyRule): number {
  return rule.endDayOffset * 1440 + minutesOf(rule.endTime) - (rule.startDayOffset * 1440 + minutesOf(rule.startTime));
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

// La règle d'un évènement : son réglage propre, sinon celle de son type, sinon celle de repli.
export function resolveBusyRule(input: { own: BusyRule | null; type: BusyRule | null; fallback: BusyRule }): { rule: BusyRule; source: BusyRuleSource } {
  if (input.own) return { rule: input.own, source: "event" };
  if (input.type) return { rule: input.type, source: "type" };
  return { rule: input.fallback, source: "fallback" };
}

// La plage d'un évènement daté, en instants UTC, à l'heure murale de son fuseau (ARC-17).
export function busyRange(eventDate: string, rule: BusyRule, timeZone: string): { start: Date; end: Date } {
  return {
    start: wallTimeToInstant(addDays(eventDate, rule.startDayOffset), shortTime(rule.startTime), timeZone),
    end: wallTimeToInstant(addDays(eventDate, rule.endDayOffset), shortTime(rule.endTime), timeZone),
  };
}

// Les dates (AAAA-MM-JJ) de début et de fin d'une règle pour un évènement daté : pour l'affichage.
export function busyRangeDates(eventDate: string, rule: BusyRule): { startDate: string; endDate: string } {
  return { startDate: addDays(eventDate, rule.startDayOffset), endDate: addDays(eventDate, rule.endDayOffset) };
}

// Bloque : confirmé, en préparation, clôturé (statuts sûrs) ; une option ou un report en cours
// seulement si l'organisation l'a réglé (D2). Jamais : annulé, essai, sans date.
export function isBlocking(event: { status: EventStatus; isDemo: boolean; eventDate: string | null }, optionsBlock: boolean): boolean {
  if (event.isDemo || event.eventDate === null) return false;
  if (FIRM_STATUSES.includes(event.status)) return true;
  return optionsBlock && TENTATIVE_STATUSES.includes(event.status);
}

// Plage qui touche la fenêtre [from, to[ ?
export function overlapsWindow(range: { start: Date; end: Date }, window: { from: Date; to: Date }): boolean {
  return range.start < window.to && range.end > window.from;
}
