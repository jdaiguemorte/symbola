// Lots 30a et 30b (JRJ-01, CHR-06 ; décisions D2 et D7) — durées et heures de fin du
// programme du jour J, les mêmes partout (fiche, PDF, écran du jour J, saisie). Les
// heures sont celles de l'horloge murale du jour J (« HH:MM ») ; une fin plus petite
// que le début passe minuit ; une fin absente vaut le début de la séquence suivante,
// et la dernière dure jusqu'à minuit. Fonctions pures, sans dépendance au navigateur
// ni au serveur : elles servent aussi sur le téléphone, sans réseau.

export type SpanItem = { id: string; startTime: string; endTime: string | null };

// Début et fin en minutes depuis le minuit du jour J ; `computedEnd` quand la fin
// n'est pas saisie ; `openEnded` pour la dernière séquence sans fin (jusqu'à minuit
// pour « Maintenant », son seul début à l'affichage).
export type ProgramSpan = { id: string; start: number; end: number; computedEnd: boolean; openEnded: boolean };

export const MINUTES_PER_DAY = 1440;

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

// « HH:MM » d'une minute du jour, au-delà de minuit comprise (25:30 → 01:30).
export function clock(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function programSpans(items: SpanItem[]): ProgramSpan[] {
  const sorted = [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return sorted.map((item, index) => {
    const start = toMinutes(item.startTime);
    const next = sorted[index + 1];
    if (item.endTime) {
      const end = toMinutes(item.endTime);
      return { id: item.id, start, end: end <= start ? end + MINUTES_PER_DAY : end, computedEnd: false, openEnded: false };
    }
    if (!next) return { id: item.id, start, end: MINUTES_PER_DAY, computedEnd: true, openEnded: true };
    return { id: item.id, start, end: Math.max(toMinutes(next.startTime), start), computedEnd: true, openEnded: false };
  });
}

// « 1 h », « 45 min », « 1 h 30 » : heures et minutes, pour la traduction.
export function durationParts(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

// Lot 30b (CHR-06) : « 16:00 – 17:00 · 1 h » sur la fiche, dans le PDF et le jour J ;
// les mots viennent des traductions de l'appelant.
export type SpanWords = {
  minutes: (minutes: number) => string;
  hours: (hours: number) => string;
  hoursMinutes: (hours: number, minutes: number) => string;
  range: (start: string, end: string, duration: string) => string;
};

export function durationText(minutes: number, words: SpanWords): string {
  const parts = durationParts(minutes);
  if (parts.hours === 0) return words.minutes(parts.minutes);
  return parts.minutes === 0 ? words.hours(parts.hours) : words.hoursMinutes(parts.hours, parts.minutes);
}

export function spanLabel(span: ProgramSpan, words: SpanWords): string {
  if (span.openEnded) return clock(span.start);
  return words.range(clock(span.start), clock(span.end), durationText(span.end - span.start, words));
}

// Lot 30b (D7) : à la saisie, la durée donne l'heure de fin, et l'inverse.
export function endTimeAfter(startTime: string, durationMinutes: number): string {
  return clock(toMinutes(startTime) + durationMinutes);
}

// Durée de « début » à « fin » ; une fin plus petite (ou égale) passe minuit.
export function minutesBetween(startTime: string, endTime: string): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return end <= start ? end + MINUTES_PER_DAY - start : end - start;
}
