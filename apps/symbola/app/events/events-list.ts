// Lot 72f (EVT-07, UX-01, UX-13 ; C-14, C-29, P-21, E7, E8 ; page 17 des maquettes du lot 68) — les règles
// de la liste des évènements, sans accès à la base ni texte : le statut dit avec les mots de la frise, le
// compte à rebours de la date, « 2 le même jour », la colonne « Tâches faites », le tri par en-tête (le
// procédé du carnet, lot 73b) et les premières lignes montrées (le procédé de « Tâches », lot 70d).
import type { EventPhase, EventStatus, EventTaskProgress } from "@symbola/contracts";
import { FINISHED_STATUSES, IN_PROGRESS_STATUSES } from "@/modules/events/service";
import { sharedDates, type PortfolioEvent } from "@/lib/portfolio/portfolio";

// NFR-02 (ADR 0115) : comme « Tâches » (lot 70d), les 100 premières lignes, puis « Afficher les suivantes ».
export const FIRST_ROWS = 100;

// Le filtre « Statut » : les étapes de la frise (lot 72a) et les deux états hors frise, selon la période.
export const UPCOMING_PHASES: readonly EventPhase[] = ["option", "confirmed", "day_of", "postponed"];
export const PAST_PHASES: readonly EventPhase[] = ["closed", "cancelled"];
export const ALL_PHASES: readonly EventPhase[] = [...UPCOMING_PHASES, ...PAST_PHASES];

export type ListPeriod = "upcoming" | "past" | "archived";

export function periodOf(tab: string | undefined): ListPeriod {
  return tab === "termines" ? "past" : tab === "archives" ? "archived" : "upcoming";
}

export function phasesOf(period: ListPeriod): readonly EventPhase[] {
  return period === "upcoming" ? UPCOMING_PHASES : period === "past" ? PAST_PHASES : ALL_PHASES;
}

// Un statut hors de la période (ou inconnu, saisi à la main dans l'adresse) est ignoré.
export function parsePhase(value: string | undefined, period: ListPeriod): EventPhase | undefined {
  return phasesOf(period).find((phase) => phase === value);
}

// Les statuts stockés à demander à la base : « Jour J » est un évènement signé, le jour même.
export function statusesFor(period: ListPeriod, phase: EventPhase | undefined): EventStatus[] | undefined {
  if (period === "archived") return phase ? [phase === "day_of" ? "confirmed" : phase] : undefined;
  if (phase) return [phase === "day_of" ? "confirmed" : phase];
  return period === "upcoming" ? [...IN_PROGRESS_STATUSES] : [...FINISHED_STATUSES];
}

export function matchesPhase(event: { phase: EventPhase }, phase: EventPhase | undefined): boolean {
  return phase === undefined || event.phase === phase;
}

// Le statut se dit avec les mots de la frise (EventHeader.timeline) ; Reporté et Annulé, hors frise, avec
// les leurs (Events).
export function statusWord(phase: EventPhase): { namespace: "EventHeader" | "Events"; key: string } {
  switch (phase) {
    case "option":
      return { namespace: "EventHeader", key: "timeline.request" };
    case "confirmed":
      return { namespace: "EventHeader", key: "timeline.signed" };
    case "day_of":
      return { namespace: "EventHeader", key: "timeline.day_of" };
    case "closed":
      return { namespace: "EventHeader", key: "timeline.closed" };
    case "postponed":
      return { namespace: "Events", key: "statusPostponed" };
    case "cancelled":
      return { namespace: "Events", key: "statusCancelled" };
  }
}

function dayNumber(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
}

// Le compte à rebours de la date de l'évènement, en jours civils (aucun fuseau : « aujourd'hui » est le jour
// de Paris, la date de l'évènement une date sans heure ; un changement d'heure ne décale rien).
export function daysUntil(today: string, eventDate: string): number {
  return Math.round(dayNumber(eventDate) - dayNumber(today));
}

export type Countdown = { key: "countdownToday" | "countdownTomorrow" | "countdownIn" | "countdownYesterday" | "countdownAgo"; count: number };

export function countdown(today: string, eventDate: string): Countdown {
  const days = daysUntil(today, eventDate);
  if (days === 0) return { key: "countdownToday", count: 0 };
  if (days === 1) return { key: "countdownTomorrow", count: 1 };
  if (days === -1) return { key: "countdownYesterday", count: 1 };
  return days > 0 ? { key: "countdownIn", count: days } : { key: "countdownAgo", count: -days };
}

// EVT-07 (critère 3) : le nombre d'évènements en cours à la même date, l'évènement compris ; absent quand il
// est seul ce jour-là. Mêmes évènements que la charge des mois (confirmés et options, hors démonstration).
export function sameDayCounts(events: PortfolioEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ids of sharedDates(events).values()) for (const id of ids) counts.set(id, ids.length);
  return counts;
}

export type TaskCell = { kind: "request" } | { kind: "none" } | ({ kind: "progress" } & EventTaskProgress);

// C-14 (E7) : une demande n'a pas de tâches (la colonne le dit, au lieu de « 0 sur 0 ») ; un évènement signé
// sans liste n'en a « pas encore ».
export function taskCell(phase: EventPhase, progress: EventTaskProgress | undefined): TaskCell {
  const counts = progress ?? { done: 0, total: 0, late: 0 };
  if (counts.total === 0) return phase === "option" ? { kind: "request" } : { kind: "none" };
  return { kind: "progress", ...counts };
}

// Le tri par en-tête de colonne (le procédé du carnet, lot 73b) : chaque colonne a son sens naturel ; un
// second clic l'inverse. Un tri ou un sens inconnu est ignoré, sans erreur.
export const SORT_KEYS = ["evenement", "date", "statut", "taches"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";
export type ListSort = { key: SortKey; direction: SortDirection; natural: boolean };

const NATURAL: Record<SortKey, SortDirection> = { evenement: "asc", date: "asc", statut: "asc", taches: "desc" };

export function parseSort(tri: string | undefined, sens: string | undefined): ListSort {
  const key = SORT_KEYS.find((candidate) => candidate === tri) ?? "date";
  const direction: SortDirection = sens === "asc" || sens === "desc" ? sens : NATURAL[key];
  return { key, direction, natural: direction === NATURAL[key] };
}

// L'adresse d'un en-tête : sa colonne dans son sens naturel, ou l'inverse si elle trie déjà ; les filtres,
// la période et la vue restent (critère 5) ; les lignes repartent des premières.
export function sortHref(path: string, query: Record<string, string | undefined>, current: ListSort, key: SortKey): string {
  const direction = current.key === key ? (current.direction === "asc" ? "desc" : "asc") : NATURAL[key];
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) if (value && !["tri", "sens", "tout"].includes(name)) params.set(name, value);
  if (key !== "date") params.set("tri", key);
  if (direction !== NATURAL[key]) params.set("sens", direction);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

const PHASE_ORDER: Record<EventPhase, number> = { option: 0, confirmed: 1, day_of: 2, postponed: 3, closed: 4, cancelled: 5 };

type Sortable = { id: string; eventDate: string | null; phase: EventPhase; taskProgress?: EventTaskProgress };

// Ce qui reste à regarder : les retards d'abord, puis la part la moins avancée ; sans tâche, en dernier.
function taskWeight(progress: EventTaskProgress | undefined): [number, number] {
  if (!progress || progress.total === 0) return [-1, -1];
  return [progress.late, 1 - progress.done / progress.total];
}

export function sortEvents<E extends Sortable>(events: readonly E[], sort: ListSort, nameOf: (event: E) => string, locale: string): E[] {
  const byDate = (a: E, b: E) => (a.eventDate ?? "9999-12-31").localeCompare(b.eventDate ?? "9999-12-31");
  const compare = (a: E, b: E): number => {
    switch (sort.key) {
      case "evenement":
        return nameOf(a).localeCompare(nameOf(b), locale, { sensitivity: "base" });
      case "date":
        return byDate(a, b);
      case "statut":
        return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
      case "taches": {
        const [lateA, restA] = taskWeight(a.taskProgress);
        const [lateB, restB] = taskWeight(b.taskProgress);
        return lateA - lateB || restA - restB;
      }
    }
  };
  const sign = sort.direction === "asc" ? 1 : -1;
  // À égalité, la date (dans l'ordre), puis l'identifiant : un ordre stable d'un affichage à l'autre.
  return [...events].sort((a, b) => sign * compare(a, b) || byDate(a, b) || a.id.localeCompare(b.id));
}

// Lot 52 (D2) et 72f : dans une agence, le filtre « Planner principal » ; une personne qui n'est planner
// principale d'aucun évènement visible (ou d'une autre organisation) est ignorée.
export function parsePlanner(value: string | undefined, leadIds: ReadonlySet<string>): string | undefined {
  return value && leadIds.has(value) ? value : undefined;
}
