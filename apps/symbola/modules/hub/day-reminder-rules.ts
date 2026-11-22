// Lot 66b (JRJ-01, HUB-28 ; D2, D3 ; ADR 0112) — règles pures du rappel du jour J : le jour d'envoi
// (la veille de l'évènement, ou le jour même) et l'heure, dans le fuseau de l'évènement ; un envoi
// manqué part encore pendant le rattrapage, le jour même (comme les automatismes, ADR 0112). Le réglage
// d'un évènement remplace celui de l'organisation, cible par cible.
import type { DayReminderSetting, DayReminderTarget } from "@symbola/contracts";
import { sendWindowOpen } from "./send-time-rules";

export function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function previousDay(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function dayReminderSendDate(eventDate: string, moment: DayReminderSetting["moment"]): string {
  return moment === "eve" ? previousDay(eventDate) : eventDate;
}

export function dayReminderDue(input: { setting: DayReminderSetting; eventDate: string; timeZone: string; now: Date; catchUpHours: number }): boolean {
  if (!input.setting.enabled) return false;
  if (localDate(input.now, input.timeZone) !== dayReminderSendDate(input.eventDate, input.setting.moment)) return false;
  return sendWindowOpen({ now: input.now, sendTime: input.setting.sendTime, catchUpHours: input.catchUpHours, timeZone: input.timeZone });
}

export function effectiveDayReminder(organization: DayReminderSetting[], overrides: DayReminderSetting[]): DayReminderSetting[] {
  return organization.map((setting) => overrides.find((override) => override.target === setting.target) ?? setting);
}

export function dayReminderKey(eventId: string, target: DayReminderTarget, recipientId: string): string {
  return `day-reminder:${eventId}:${target}:${recipientId}`;
}
