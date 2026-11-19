// Lot 35c (RGP-11 ; décision D8 de Julien du 18/11/2026 ; ADR 0100) — calendrier d'une fermeture,
// à l'heure de Paris : fermée le jour J (jour 0), l'organisation est supprimée au 30e jour, à minuit
// (début du jour J + 30) ; l'export reste proposé jusqu'à cet instant. Le préavis part sept jours
// avant (minuit du jour J + 23). Les minuits sont ceux de Paris, changement d'heure compris.

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export const CLOSURE_DAYS = 30;
export const CLOSURE_NOTICE_DAYS = 7;

const PARIS_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const PARIS_OFFSET = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" });

export function parisCalendarDate(instant: Date): string {
  return PARIS_DATE.format(instant);
}

// Décalage de Paris (en minutes) à un instant donné : +60 l'hiver, +120 l'été.
function parisOffsetMinutes(instant: Date): number {
  const name = PARIS_OFFSET.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

// Minuit à Paris d'un jour donné (AAAA-MM-JJ), en instant UTC.
export function parisMidnight(date: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(year, month - 1, day);
  let instant = new Date(utcMidnight - parisOffsetMinutes(new Date(utcMidnight)) * 60_000);
  // Le décalage de minuit peut différer de celui de la veille à 0 h UTC (nuit du changement d'heure).
  instant = new Date(utcMidnight - parisOffsetMinutes(instant) * 60_000);
  return instant;
}

export type ClosureSchedule = { deletionDueAt: Date; noticeAt: Date };

export function closureSchedule(closedAt: Date): ClosureSchedule {
  const day = parisCalendarDate(closedAt);
  return { deletionDueAt: parisMidnight(addDays(day, CLOSURE_DAYS)), noticeAt: parisMidnight(addDays(day, CLOSURE_DAYS - CLOSURE_NOTICE_DAYS)) };
}

// Jours entiers qui restent avant la suppression (0 le dernier jour).
export function daysBeforeDeletion(deletionDueAt: Date, now: Date): number {
  const today = parisCalendarDate(now);
  const last = parisCalendarDate(new Date(deletionDueAt.getTime() - 1));
  return Math.max(0, Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));
}

// Cycle des sauvegardes (ADR 0092, Q35 : 35 jours glissants, KEEP_WITHIN de infra/backup) : une
// donnée supprimée disparaît des sauvegardes au plus tard au bout de ce délai. Dit à la Propriétaire
// qui ferme l'espace ; la valeur suit celle du serveur.
export const BACKUP_CYCLE_DAYS = 35;
