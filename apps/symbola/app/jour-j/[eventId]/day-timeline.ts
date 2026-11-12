// Lot 30a (JRJ-01, décision D2) — « Maintenant » et « Ensuite », calculés sur
// l'appareil à l'heure de Paris (ils marchent sans réseau) : avant le jour J, la
// séquence en cours, la pause entre deux séquences, le programme terminé. Les heures
// sont celles de l'horloge murale du jour J ; une fin plus petite que le début passe
// minuit ; une fin absente vaut le début de la séquence suivante (la dernière dure
// jusqu'à minuit). Aucune dépendance au navigateur ni au serveur.

export type TimelineItem = { id: string; startTime: string; endTime: string | null };

export type DayMoment =
  | { phase: "empty" }
  | { phase: "before"; daysUntil: number; nextId: string | null }
  | { phase: "now"; currentId: string; endsInMinutes: number; nextId: string | null; nextStartsInMinutes: number | null }
  | { phase: "pause"; nextId: string; nextStartsInMinutes: number }
  | { phase: "over" };

const MINUTES_PER_DAY = 1440;

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function parisParts(instant: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "0";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

// Début et fin de chaque séquence en minutes depuis le minuit du jour J, triées.
export function timelineSpans(items: TimelineItem[]): { id: string; start: number; end: number }[] {
  const sorted = [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return sorted.map((item, index) => {
    const start = toMinutes(item.startTime);
    const next = sorted[index + 1];
    let end: number;
    if (item.endTime) {
      end = toMinutes(item.endTime);
      if (end <= start) end += MINUTES_PER_DAY;
    } else {
      end = next ? Math.max(toMinutes(next.startTime), start) : MINUTES_PER_DAY;
    }
    return { id: item.id, start, end };
  });
}

// Durée d'une séquence, en minutes (fin absente : jusqu'à la suivante).
export function spanMinutes(items: TimelineItem[], id: string): number | null {
  const span = timelineSpans(items).find((entry) => entry.id === id);
  return span ? span.end - span.start : null;
}

export function dayMoment(items: TimelineItem[], eventDate: string, now: Date): DayMoment {
  const spans = timelineSpans(items);
  if (spans.length === 0) return { phase: "empty" };
  const paris = parisParts(now);
  const offset = dayNumber(paris.date) - dayNumber(eventDate);
  if (offset < 0) return { phase: "before", daysUntil: -offset, nextId: spans[0]!.id };
  // Le lendemain, la nuit continue le jour J (séquences après minuit).
  const minute = offset * MINUTES_PER_DAY + paris.minutes;
  const running = spans.filter((span) => span.start <= minute && minute < span.end);
  const current = running[running.length - 1];
  const next = spans.find((span) => span.start > minute);
  if (current) {
    return { phase: "now", currentId: current.id, endsInMinutes: current.end - minute, nextId: next?.id ?? null, nextStartsInMinutes: next ? next.start - minute : null };
  }
  if (next) return { phase: "pause", nextId: next.id, nextStartsInMinutes: next.start - minute };
  return { phase: "over" };
}

// « 1 h », « 45 min », « 1 h 30 » : heures et minutes, pour la traduction.
export function durationParts(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
