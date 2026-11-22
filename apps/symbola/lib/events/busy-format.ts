// Lot 64 (HUB-29, RDV-02 ; maquettes M1 à M4) — écrire une plage occupée en clair, côté serveur comme
// côté navigateur : le jour relatif (« la veille », « 2 jours après »), l'heure (« 8 h », « 14 h 30 »
// en français ; « 8:00 AM » en anglais), la durée, les dates réelles d'un évènement daté.
import type { BusyRule } from "@symbola/contracts";

export type BusyLocale = "fr" | "en";
export type BusyDayWords = { sameDay: string; dayBefore: (count: number) => string; dayAfter: (count: number) => string };

export const BUSY_DAY_OFFSETS = Array.from({ length: 15 }, (_, index) => index - 7);

export function busyDayLabel(offset: number, words: BusyDayWords): string {
  if (offset === 0) return words.sameDay;
  return offset < 0 ? words.dayBefore(-offset) : words.dayAfter(offset);
}

export function capitalize(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

export function busyHour(time: string, locale: BusyLocale): string {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number) as [number, number];
  if (locale === "fr") return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}

export function busyMinutes(rule: BusyRule): number {
  const minutesOf = (time: string) => {
    const [hours, minutes] = time.slice(0, 5).split(":").map(Number) as [number, number];
    return hours * 60 + minutes;
  };
  return rule.endDayOffset * 1440 + minutesOf(rule.endTime) - (rule.startDayOffset * 1440 + minutesOf(rule.startTime));
}

// « 14 h », « 46 h », « 10 h 30 » ; en anglais « 14 h », « 10 h 30 min » ne se dit pas : « 10.5 hours ».
export function busyDuration(rule: BusyRule, locale: BusyLocale): string {
  const total = busyMinutes(rule);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (locale === "fr") return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// « samedi 12 juin 2027 » (ou sans l'année).
export function busyDate(date: string, locale: BusyLocale, withYear = true): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

// « ven. 11 juin »
export function busyShortDate(date: string, locale: BusyLocale): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}
