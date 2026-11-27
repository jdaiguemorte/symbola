// Lot 70d (CHR-02, CHR-03, CHR-10, UX-03, UX-08, UX-12 ; C-31, C-33, C-14, C-37, D1 ; page 2 des maquettes du
// lot 68) — l'écran « Tâches », sans React : ce que dit son adresse (filtres, regroupement, affichage), les
// anciennes adresses qui y mènent, les pastilles des filtres posés, le décompte (« 8 tâches à faire sur 42 »),
// les regroupements (mois, évènement, qui s'en charge, jour) et l'état vide à montrer.
//
// L'adresse ne porte que des identifiants, jamais un nom (aucune donnée personnelle, CLAUDE.md § 2.8) :
// `evenement` (identifiant ou `hors`), `qui` (`moi`, identifiant d'un membre, `clients`, `prestataires`),
// `periode` (`retard`, `semaine`, `15j`, `mois`, `entre` avec `du` et `au`), `categorie`, `etat`
// (`faites`, `toutes` ; « À faire » par défaut), `grouper` (`evenement`, `qui`, `jour` ; le mois par
// défaut, le jour pour les faites), `affichage` (`calendrier`) et `mois`.
import type { TaskListFilters, TaskListPeriod } from "@symbola/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ScreenEvent = { kind: "all" } | { kind: "none" } | { kind: "event"; eventId: string };
export type ScreenWho = { kind: "all" } | { kind: "me" } | { kind: "clients" } | { kind: "vendors" } | { kind: "member"; userId: string };
export type ScreenPeriod = { kind: "all" } | TaskListPeriod;
export type ScreenState = "todo" | "done" | "all";
export type ScreenGroup = "month" | "event" | "who" | "day";

export type TaskScreenView = {
  event: ScreenEvent;
  who: ScreenWho;
  period: ScreenPeriod;
  category: string | null;
  state: ScreenState;
  group: ScreenGroup;
  calendar: boolean;
  month: string | null;
};

export type TaskScreenQuery = Partial<Record<"evenement" | "qui" | "periode" | "du" | "au" | "categorie" | "etat" | "grouper" | "affichage" | "mois" | "vue", string | undefined>>;

export const DEFAULT_VIEW: TaskScreenView = { event: { kind: "all" }, who: { kind: "all" }, period: { kind: "all" }, category: null, state: "todo", group: "month", calendar: false, month: null };

const PERIOD_PARAMS = { retard: "late", semaine: "week", "15j": "fortnight", mois: "month" } as const;
// Les mots de l'onglet « Tâches » de la fiche (lot 70c) et des adresses d'avant le lot 70d.
const LEGACY_PERIOD_PARAMS: Record<string, keyof typeof PERIOD_PARAMS> = { "en-retard": "retard", quinzaine: "15j" };
const GROUP_PARAMS = { evenement: "event", qui: "who", jour: "day" } as const;

function validDay(value: string | undefined): value is string {
  // Une date qui existe (« 2027-02-30 » n'existe pas : Date la ferait glisser au 2 mars).
  return typeof value === "string" && DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

// Le regroupement par défaut : le jour de la coche pour les faites, le mois d'échéance sinon. « Jour » ne
// vaut que pour les faites.
function groupOf(param: string | undefined, state: ScreenState): ScreenGroup {
  const asked = param && param in GROUP_PARAMS ? GROUP_PARAMS[param as keyof typeof GROUP_PARAMS] : param === "mois" ? "month" : null;
  if (asked === "day" && state !== "done") return "month";
  return asked ?? (state === "done" ? "day" : "month");
}

export type ReadTaskScreen = { view: TaskScreenView; legacy: boolean };

// Lit l'adresse ; une valeur inconnue revient au défaut. `legacy` : l'adresse emploie une ancienne valeur
// (« vue=en-retard », « qui=planner »…) et doit mener, par une redirection, à la vue équivalente.
export function readTaskScreen(query: TaskScreenQuery): ReadTaskScreen {
  let legacy = false;
  // Anciennes adresses (avant le lot 70d) : `vue` (À faire, En retard, Faites, Toutes).
  let periodParam = query.periode;
  let stateParam = query.etat;
  if (query.vue !== undefined) {
    legacy = true;
    if (query.vue === "en-retard") periodParam ??= "retard";
    if (query.vue === "faites") stateParam ??= "faites";
    if (query.vue === "toutes") stateParam ??= "toutes";
  }
  if (periodParam && periodParam in LEGACY_PERIOD_PARAMS) {
    legacy = true;
    periodParam = LEGACY_PERIOD_PARAMS[periodParam];
  }

  const state: ScreenState = stateParam === "faites" ? "done" : stateParam === "toutes" ? "all" : "todo";

  const event: ScreenEvent = query.evenement === "hors" ? { kind: "none" } : query.evenement && UUID.test(query.evenement) ? { kind: "event", eventId: query.evenement.toLowerCase() } : { kind: "all" };

  let who: ScreenWho = { kind: "all" };
  const qui = query.qui;
  if (qui === "moi") who = { kind: "me" };
  else if (qui === "clients") who = { kind: "clients" };
  else if (qui === "prestataires") who = { kind: "vendors" };
  else if (qui && UUID.test(qui)) who = { kind: "member", userId: qui.toLowerCase() };
  else if (qui?.startsWith("member:") && UUID.test(qui.slice(7))) {
    who = { kind: "member", userId: qui.slice(7).toLowerCase() };
    legacy = true;
  } else if (qui === "planner" || qui === "tous") legacy = true;

  let period: ScreenPeriod = { kind: "all" };
  if (periodParam && periodParam in PERIOD_PARAMS) period = { kind: PERIOD_PARAMS[periodParam as keyof typeof PERIOD_PARAMS] };
  else if (periodParam === "entre" && validDay(query.du) && validDay(query.au)) {
    // Deux dates dans le désordre : la plus ancienne d'abord.
    const [from, to] = query.du <= query.au ? [query.du, query.au] : [query.au, query.du];
    period = { kind: "between", from, to };
  }

  const category = query.categorie && UUID.test(query.categorie) ? query.categorie.toLowerCase() : null;
  const calendar = query.affichage === "calendrier";
  const month = query.mois && MONTH.test(query.mois) ? query.mois : null;
  return { view: { event, who, period, category, state, group: groupOf(query.grouper, state), calendar, month }, legacy };
}

// Les paramètres de l'adresse d'une vue, sans les valeurs par défaut.
export function taskScreenParams(view: TaskScreenView): Record<string, string> {
  const params: Record<string, string> = {};
  if (view.event.kind === "none") params.evenement = "hors";
  if (view.event.kind === "event") params.evenement = view.event.eventId;
  if (view.who.kind === "me") params.qui = "moi";
  if (view.who.kind === "clients") params.qui = "clients";
  if (view.who.kind === "vendors") params.qui = "prestataires";
  if (view.who.kind === "member") params.qui = view.who.userId;
  if (view.period.kind === "between") {
    params.periode = "entre";
    params.du = view.period.from;
    params.au = view.period.to;
  } else if (view.period.kind !== "all") {
    const kind = view.period.kind;
    params.periode = Object.entries(PERIOD_PARAMS).find(([, value]) => value === kind)![0];
  }
  if (view.category) params.categorie = view.category;
  if (view.state === "done") params.etat = "faites";
  if (view.state === "all") params.etat = "toutes";
  const defaultGroup = view.state === "done" ? "day" : "month";
  if (view.group !== defaultGroup) params.grouper = view.group === "month" ? "mois" : Object.entries(GROUP_PARAMS).find(([, value]) => value === view.group)![0];
  if (view.calendar) {
    params.affichage = "calendrier";
    if (view.month) params.mois = view.month;
  }
  return params;
}

// L'adresse de l'écran pour une vue, plus des paramètres ponctuels (« tache », « nouvelle »).
export function taskScreenHref(view: TaskScreenView, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ ...taskScreenParams(view), ...extra }).toString();
  return query ? `/taches?${query}` : "/taches";
}

// Changer un réglage remet le regroupement à sa valeur par défaut s'il ne vaut plus (« Jour » quitte les
// faites).
export function withView(view: TaskScreenView, changes: Partial<TaskScreenView>): TaskScreenView {
  const next = { ...view, ...changes };
  if (next.group === "day" && next.state !== "done") next.group = "month";
  if (changes.state === "done" && view.state !== "done" && changes.group === undefined && view.group === "month") next.group = "day";
  if (changes.state !== undefined && changes.state !== "done" && view.state === "done" && changes.group === undefined) next.group = "month";
  return next;
}

// Les filtres de la liste unique du service (lot 70a), filtrés dans la base.
export function listFiltersOf(view: TaskScreenView): TaskListFilters {
  const filters: TaskListFilters = { state: view.state };
  if (view.event.kind === "none") filters.event = { kind: "none" };
  if (view.event.kind === "event") filters.event = { kind: "event", eventId: view.event.eventId };
  if (view.who.kind === "member") filters.assignee = { kind: "member", userId: view.who.userId };
  else if (view.who.kind !== "all") filters.assignee = { kind: view.who.kind };
  if (view.period.kind !== "all") filters.period = view.period;
  if (view.category) filters.categoryId = view.category;
  return filters;
}

export type FilterKey = "event" | "who" | "period" | "category" | "state";

// Les filtres posés, dans l'ordre de la barre ; chacun devient une pastille « × » qui se retire seule.
// « État » compte dès qu'il n'est plus « À faire ».
export function activeFilters(view: TaskScreenView): FilterKey[] {
  const keys: FilterKey[] = [];
  if (view.event.kind !== "all") keys.push("event");
  if (view.who.kind !== "all") keys.push("who");
  if (view.period.kind !== "all") keys.push("period");
  if (view.category) keys.push("category");
  if (view.state !== "todo") keys.push("state");
  return keys;
}

// La vue sans un filtre (« × » d'une pastille, « Retirer « En retard » »).
export function withoutFilter(view: TaskScreenView, key: FilterKey): TaskScreenView {
  switch (key) {
    case "event":
      return { ...view, event: { kind: "all" } };
    case "who":
      return { ...view, who: { kind: "all" } };
    case "period":
      return { ...view, period: { kind: "all" } };
    case "category":
      return { ...view, category: null };
    case "state":
      return withView(view, { state: "todo" });
  }
}

// « Effacer les filtres » : la liste par défaut, en gardant l'affichage (liste ou calendrier).
export function withoutFilters(view: TaskScreenView): TaskScreenView {
  return { ...DEFAULT_VIEW, calendar: view.calendar, month: view.month };
}

// —— Le décompte —————————————————————————————————————————————————————————————————————————————————————————

export type TaskScreenCounts = {
  // Les tâches que la liste montre.
  shown: number;
  // Toutes celles que la personne voit, faites comprises ; et, parmi elles, celles à faire.
  total: number;
  todoTotal: number;
  // Les tâches en retard parmi celles montrées.
  late: number;
};

export type CountLine = { key: "countTodo" | "countTodoFiltered" | "countLate" | "countDone" | "countAll"; values: Record<string, number>; filtered: boolean; late: number | null };

// « 8 tâches à faire sur 42 · 2 en retard » ; « 4 tâches sur 11 à faire · filtrées » ; « 5 tâches en retard
// sur 11 à faire » ; « 34 tâches faites sur 42 ». Les nombres se recoupent : à faire + faites = total.
export function countLine(view: TaskScreenView, counts: TaskScreenCounts): CountLine {
  const filters = activeFilters(view).filter((key) => key !== "state");
  const filtered = filters.length > 0;
  if (view.state === "done") return { key: "countDone", values: { count: counts.shown, total: counts.total }, filtered, late: null };
  if (view.state === "all") return { key: "countAll", values: { count: counts.shown, total: counts.total }, filtered, late: null };
  if (!filtered) return { key: "countTodo", values: { count: counts.shown, total: counts.total }, filtered: false, late: counts.late > 0 ? counts.late : null };
  if (view.period.kind === "late" && filters.length === 1) return { key: "countLate", values: { count: counts.shown, total: counts.todoTotal }, filtered: false, late: null };
  return { key: "countTodoFiltered", values: { count: counts.shown, total: counts.todoTotal }, filtered: true, late: null };
}

export function doneTotal(counts: Pick<TaskScreenCounts, "total" | "todoTotal">): number {
  return counts.total - counts.todoTotal;
}

// —— L'état vide ——————————————————————————————————————————————————————————————————————————————————————

export type EmptyKind = "new" | "allDone" | "noResult" | null;

// Trois états vides (C-37) : rien encore (espace neuf), tout est fait (rien à faire, sans filtre), aucun
// résultat (des filtres posés) ; le quatrième, le mariage repris sans tâches, est un bandeau au-dessus de la
// liste (il peut côtoyer des tâches).
export function emptyKind(view: TaskScreenView, counts: Pick<TaskScreenCounts, "shown" | "total">): EmptyKind {
  if (counts.shown > 0) return null;
  if (counts.total === 0) return "new";
  if (activeFilters(view).length === 0) return "allDone";
  return "noResult";
}

// —— Les regroupements ———————————————————————————————————————————————————————————————————————————————————

export type GroupableLine = {
  id: string;
  dueDate: string;
  eventId: string | null;
  eventLabel: string;
  // « member:<id> », « clients », « vendor:<id> », « planner » (personne).
  responsibleValue: string;
  whoName: string;
  late: boolean;
  doneDay: string | null;
};

// La clé de « Qui s'en charge » : un membre, les clients (tous les évènements), les prestataires, personne.
export function whoKey(responsibleValue: string): string {
  if (responsibleValue.startsWith("member:")) return responsibleValue;
  if (responsibleValue === "clients") return "clients";
  if (responsibleValue.startsWith("vendor")) return "vendors";
  return "nobody";
}

export type LineGroup<T> = { key: string; lines: T[] };

function groupBy<T>(lines: T[], keyOf: (line: T) => string): LineGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const key = keyOf(line);
    const group = groups.get(key);
    if (group) group.push(line);
    else groups.set(key, [line]);
  }
  return [...groups.entries()].map(([key, groupLines]) => ({ key, lines: groupLines }));
}

// Regroupe les lignes, dans l'ordre reçu (échéance, ou date de fin pour les faites). Par évènement : dans
// l'ordre de la première échéance, « Hors évènement » à sa place. Par personne : celle qui a le plus de
// retards d'abord, puis par nom ; personne et les prestataires à la fin.
export function groupLines<T extends GroupableLine>(lines: T[], by: ScreenGroup): LineGroup<T>[] {
  switch (by) {
    case "month":
      return groupBy(lines, (line) => line.dueDate.slice(0, 7));
    case "day":
      return groupBy(lines, (line) => line.doneDay ?? line.dueDate);
    case "event":
      return groupBy(lines, (line) => line.eventId ?? "none");
    case "who": {
      const groups = groupBy(lines, (line) => whoKey(line.responsibleValue));
      const rank = (key: string) => (key === "nobody" ? 2 : key === "vendors" ? 1 : 0);
      const late = (group: LineGroup<T>) => group.lines.filter((line) => line.late).length;
      return groups.sort((a, b) => rank(a.key) - rank(b.key) || late(b) - late(a) || a.lines[0]!.whoName.localeCompare(b.lines[0]!.whoName, "fr"));
    }
  }
}

// « Aujourd'hui », « Hier », sinon la date.
export function dayWord(day: string, today: string): "today" | "yesterday" | null {
  if (day === today) return "today";
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return day === yesterday.toISOString().slice(0, 10) ? "yesterday" : null;
}
