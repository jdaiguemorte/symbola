// Lot 70c (CHR-03, EVT-03 ; C-33, A21 ; page 1 des maquettes du lot 68) — les filtres de l'onglet
// « Tâches » de la fiche, les mêmes que ceux de l'écran « Tâches », l'Évènement en moins : Qui s'en charge,
// Période, Catégorie, État (« À faire » par défaut, A21). Lus depuis l'adresse ; une valeur inconnue
// revient à la valeur par défaut. Les tâches d'un seul évènement sont peu nombreuses : filtrées ici, en
// fonctions pures.
import type { TaskListPeriod, TaskResponsible } from "@symbola/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventTaskWho = "all" | "me" | "clients" | "vendors" | `member:${string}`;
export type EventTaskPeriod = "all" | "late" | "week" | "fortnight" | "month";
export type EventTaskState = "todo" | "done" | "all";
export type EventTaskFilters = { who: EventTaskWho; period: EventTaskPeriod; category: string; state: EventTaskState };

// Les mots de l'adresse (en français, comme les autres paramètres de l'app).
const WHO_PARAMS: Record<string, EventTaskWho> = { moi: "me", clients: "clients", prestataires: "vendors" };
const PERIOD_PARAMS: Record<string, EventTaskPeriod> = { "en-retard": "late", semaine: "week", quinzaine: "fortnight", mois: "month" };
const STATE_PARAMS: Record<string, EventTaskState> = { faites: "done", toutes: "all" };

function paramOf<T extends string>(map: Record<string, T>, value: T): string | null {
  return Object.entries(map).find(([, candidate]) => candidate === value)?.[0] ?? null;
}

export function readEventTaskFilters(query: { qui?: string | undefined; periode?: string | undefined; categorie?: string | undefined; etat?: string | undefined; vue?: string | undefined }): EventTaskFilters {
  const who: EventTaskWho = query.qui && WHO_PARAMS[query.qui] ? WHO_PARAMS[query.qui]! : query.qui?.startsWith("member:") && UUID.test(query.qui.slice(7)) ? (query.qui as `member:${string}`) : "all";
  // L'ancienne « vue » (« toutes », « en-retard ») des adresses d'avant le lot 70c.
  const legacyState = query.vue === "toutes" ? "all" : undefined;
  const legacyPeriod = query.vue === "en-retard" ? "late" : undefined;
  const period = (query.periode ? PERIOD_PARAMS[query.periode] : undefined) ?? legacyPeriod ?? "all";
  const state = (query.etat ? STATE_PARAMS[query.etat] : undefined) ?? legacyState ?? "todo";
  const category = query.categorie && UUID.test(query.categorie) ? query.categorie : "all";
  return { who, period, category, state };
}

export function filtersQuery(filters: EventTaskFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.who !== "all") query.qui = filters.who.startsWith("member:") ? filters.who : (paramOf(WHO_PARAMS, filters.who) ?? "");
  if (filters.period !== "all") query.periode = paramOf(PERIOD_PARAMS, filters.period) ?? "";
  if (filters.category !== "all") query.categorie = filters.category;
  if (filters.state !== "todo") query.etat = paramOf(STATE_PARAMS, filters.state) ?? "";
  return query;
}

// Les valeurs des listes du formulaire (vide : la valeur par défaut).
export function filterFormValues(filters: EventTaskFilters): { who: string; period: string; category: string; state: string } {
  const query = filtersQuery(filters);
  return { who: query.qui ?? "", period: query.periode ?? "", category: query.categorie ?? "", state: query.etat ?? "" };
}

export function activeFilterCount(filters: EventTaskFilters): number {
  return Object.keys(filtersQuery(filters)).length;
}

type Filterable = { dueDate: string; done: boolean; responsible: TaskResponsible; assigneeUserId: string | null; categoryId: string | null };

export function filterEventTasks<T extends Filterable>(
  tasks: T[],
  filters: EventTaskFilters,
  context: { today: string; meId: string; periodRange: (period: TaskListPeriod, today: string) => { from: string | null; to: string | null } },
): T[] {
  const range = filters.period === "all" ? { from: null, to: null } : context.periodRange({ kind: filters.period }, context.today);
  return tasks.filter((task) => {
    if (filters.state === "todo" && task.done) return false;
    if (filters.state === "done" && !task.done) return false;
    if (filters.who === "me" && !(task.responsible === "planner" && task.assigneeUserId === context.meId)) return false;
    if (filters.who === "clients" && task.responsible !== "clients") return false;
    if (filters.who === "vendors" && task.responsible !== "vendor") return false;
    if (filters.who.startsWith("member:") && !(task.responsible === "planner" && `member:${task.assigneeUserId}` === filters.who)) return false;
    if (filters.category !== "all" && task.categoryId !== filters.category) return false;
    if (range.from && task.dueDate < range.from) return false;
    if (range.to && task.dueDate > range.to) return false;
    return true;
  });
}
