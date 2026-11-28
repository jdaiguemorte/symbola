// Lot 74b (EVT-01, CHR-01, CHR-02, DAT-07, UX-06 ; B7, L74-D2, L74-D3 ; page 23 des maquettes du lot 68) —
// les échéances déjà passées d'un mariage créé « Signé, en préparation ». Le modèle de rétroplanning est
// daté depuis le jour J ; une tâche dont l'échéance tombe avant aujourd'hui (le jour même n'est pas
// passé) reçoit la réponse de la planner : « Déjà fait » (faite, date de fin non renseignée), « À faire »
// (une nouvelle date, répartie sur la période choisie, en jours ouvrés, dans l'ordre du modèle, jamais
// après la tâche suivante du modèle), ou rien (« à dater », jamais en retard). Règles pures, sans base :
// la fenêtre « Nouvel évènement » les montre avant la création, le module events les applique ; le
// nombre annoncé est celui qu'on retrouve (P-07). Les dates sont des jours (« AAAA-MM-JJ ») : un
// changement d'heure ne fait ni gagner ni perdre un jour.
import { z } from "zod";

export const PAST_DUE_TASK_ANSWERS = ["done", "todo"] as const;
export type PastDueTaskAnswer = (typeof PAST_DUE_TASK_ANSWERS)[number];

// « D'ici 2, 4 ou 8 semaines », ou « Laisser à dater » ; 4 semaines proposé (L74-D2).
export const PAST_DUE_SPREADS = ["2w", "4w", "8w", "undated"] as const;
export type PastDueSpread = (typeof PAST_DUE_SPREADS)[number];
export const DEFAULT_PAST_DUE_SPREAD: PastDueSpread = "4w";
const SPREAD_WEEKS: Record<Exclude<PastDueSpread, "undated">, number> = { "2w": 2, "4w": 4, "8w": 8 };

// Les réponses envoyées par la fenêtre : une par tâche du modèle (son identifiant), et la répartition.
export const pastDueAnswersSchema = z.object({
  spread: z.enum(PAST_DUE_SPREADS),
  answers: z.record(z.uuid(), z.enum(PAST_DUE_TASK_ANSWERS)),
});
export type PastDueAnswers = z.infer<typeof pastDueAnswersSchema>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(value: string): number {
  if (!DAY.test(value)) throw new RangeError("date attendue au format AAAA-MM-JJ");
  return Math.round(Date.parse(`${value}T00:00:00Z`) / DAY_MS);
}

function dayOf(number: number): string {
  return new Date(number * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return dayOf(dayNumber(day) + days);
}

// L'échéance qu'un modèle donne à une tâche : la date de l'évènement plus son écart.
export function templateDueDate(eventDate: string, offsetDays: number): string {
  return addDays(eventDate, offsetDays);
}

// Les jours fériés, lus d'un fichier de données (packages/starter-templates, public-holidays.json) :
// des dates fixes (« MM-JJ ») et des écarts au dimanche de Pâques.
export type PublicHolidayRules = { fixed: readonly string[]; easterOffsets: readonly number[] };

// Le dimanche de Pâques (calendrier grégorien, méthode de Meeus, Jones et Butcher).
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const dayOfMonth = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

export function publicHolidaysBetween(from: string, to: string, rules: PublicHolidayRules): Set<string> {
  const holidays = new Set<string>();
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    const easter = easterSunday(year);
    for (const day of [...rules.fixed.map((monthDay) => `${year}-${monthDay}`), ...rules.easterOffsets.map((offset) => addDays(easter, offset))]) {
      if (day >= from && day <= to) holidays.add(day);
    }
  }
  return holidays;
}

// Un jour ouvré : du lundi au vendredi, hors jours fériés.
export function isWorkingDay(day: string, holidays: ReadonlySet<string>): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(day);
}

// Les dates de `count` tâches à faire, de demain à la fin de la période, en jours ouvrés, la première
// au premier jour, la dernière au dernier, sans jamais dépasser `cap` (la date que le modèle donne à la
// tâche suivante, jamais avant aujourd'hui). Dans l'ordre : chaque date suit la précédente ou l'égale.
export function spreadDueDates(count: number, today: string, spread: Exclude<PastDueSpread, "undated">, cap: string | null, holidays: ReadonlySet<string>): string[] {
  if (count <= 0) return [];
  const end = addDays(today, SPREAD_WEEKS[spread] * 7);
  const last = cap !== null && cap < end ? cap : end;
  const days: string[] = [];
  for (let day = addDays(today, 1); day <= last; day = addDays(day, 1)) if (isWorkingDay(day, holidays)) days.push(day);
  // Aucun jour ouvré avant la tâche suivante : la date de celle-ci (aujourd'hui au plus tôt).
  if (days.length === 0) return Array.from({ length: count }, () => (last < today ? today : last));
  return Array.from({ length: count }, (_, index) => days[count === 1 ? 0 : Math.round((index * (days.length - 1)) / (count - 1))]!);
}

export type PastDueOutcome = { id: string; templateDate: string; past: boolean } & ({ kind: "dated"; dueDate: string } | { kind: "done" } | { kind: "undated" });

// Le sort de chaque tâche d'un modèle, dans l'ordre du modèle (écart croissant, puis position) : à venir,
// datée du modèle ; passée, selon la réponse.
export function pastDueOutcomes(
  items: readonly { id: string; offsetDays: number }[],
  input: { eventDate: string; today: string; answers: Readonly<Record<string, PastDueTaskAnswer | undefined>>; spread: PastDueSpread; holidays: ReadonlySet<string> },
): PastDueOutcome[] {
  const dated = items.map((item) => ({ id: item.id, templateDate: templateDueDate(input.eventDate, item.offsetDays) }));
  const isPast = (templateDate: string) => templateDate < input.today;
  const next = dated.find((item) => !isPast(item.templateDate))?.templateDate ?? null;
  const todo = dated.filter((item) => isPast(item.templateDate) && input.answers[item.id] === "todo");
  const spreadDates = input.spread === "undated" ? [] : spreadDueDates(todo.length, input.today, input.spread, next, input.holidays);
  const newDate = new Map(todo.map((item, index) => [item.id, spreadDates[index]]));
  return dated.map((item): PastDueOutcome => {
    if (!isPast(item.templateDate)) return { ...item, past: false, kind: "dated", dueDate: item.templateDate };
    const answer = input.answers[item.id];
    if (answer === "done") return { ...item, past: true, kind: "done" };
    const date = newDate.get(item.id);
    if (answer === "todo" && date) return { ...item, past: true, kind: "dated", dueDate: date };
    return { ...item, past: true, kind: "undated" };
  });
}
