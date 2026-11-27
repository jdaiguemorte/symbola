// Lot 70c (CHR-02, CHR-03, UX-05, UX-06 ; D3, M3, M4, C-34, C-35, C-38, C-83 ; page 1 des maquettes du
// lot 68) — la ligne type d'une tâche, sans React : ce qu'elle montre, dans le même ordre et avec les mêmes
// mots, sur « Tâches », dans l'onglet « Tâches » de la fiche et sur « Aujourd'hui » (le téléphone est la
// même ligne, rangée sur trois étages par la feuille de style).
//
// L'ordre : le titre (seule cible, il ouvre le panneau), l'évènement (ou « Hors évènement »), l'échéance
// et son état en mots, qui s'en charge, « Fait », puis le menu « ⋯ ». L'état se lit sans la couleur :
// un mot et une icône ; seul un vrai retard est rouge.
import type { TaskDoneBy, TaskDueState, TaskPriority, TaskResponsible } from "@symbola/contracts";

export const TASK_LINE_FORMS = ["list", "event", "today"] as const;
export type TaskLineForm = (typeof TASK_LINE_FORMS)[number];

// Ce que chaque forme montre : la fiche n'a pas la colonne Évènement (on y est) ; « Aujourd'hui » n'a
// pas de menu, et le nom du mariage y est un lien séparé vers sa fiche (M4).
export function lineParts(form: TaskLineForm): { eventColumn: boolean; eventLink: boolean; menu: boolean } {
  return { eventColumn: form !== "event", eventLink: form === "today", menu: form !== "today" };
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

export type TaskLineDue = { kind: TaskDueState["kind"]; text: string; icon: "late" | "clock" | null };

// Le mot de l'état ; « plus tard » n'en a pas (la date suffit), une tâche faite non plus.
export function dueWords(state: TaskDueState | null | undefined, t: Translate): TaskLineDue | null {
  if (!state) return null;
  switch (state.kind) {
    case "late":
      return { kind: "late", text: t("dueLate", { days: state.days }), icon: "late" };
    case "today":
      return { kind: "today", text: t("dueToday"), icon: "clock" };
    case "tomorrow":
      return { kind: "tomorrow", text: t("dueTomorrow"), icon: "clock" };
    case "soon":
      return { kind: "soon", text: t("dueSoon", { days: state.days }), icon: "clock" };
    case "later":
      return null;
  }
}

const ARTICLES = new Set(["le", "la", "les", "l", "the", "un", "une", "des", "de", "du"]);

// Les initiales d'un nom affiché (prestataire, « Les mariés ») : les deux premiers mots, sans l'article.
export function nameInitials(name: string): string {
  const words = name
    .split(/[\s'’-]+/)
    .map((word) => word.trim())
    .filter((word) => word && !ARTICLES.has(word.toLocaleLowerCase("fr")));
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0]!.toLocaleUpperCase("fr"));
  return letters.length > 0 ? letters.join("") : "?";
}

export type TaskLineMember = { id: string; name: string; shortName?: string; initials?: string; me: boolean; removed: boolean };

export type TaskLineSource = {
  id: string;
  eventId: string | null;
  event: { id: string; names: string } | null;
  label: string;
  dueDate: string;
  responsible: TaskResponsible;
  vendorCandidateId: string | null;
  assigneeUserId: string | null;
  priority: TaskPriority;
  done: boolean;
  dueState?: TaskDueState | null | undefined;
  // Lot 70d (D1) : quand et par qui elle a été cochée.
  doneAt?: string | null | undefined;
  doneBy?: TaskDoneBy | null | undefined;
};

export type TaskLineContext = {
  // Traductions de l'espace « TaskLine ».
  t: Translate;
  formatDate: (date: string) => string;
  members: TaskLineMember[];
  vendorName: (vendorCandidateId: string) => string | null;
  // Le mot du type d'évènement : « Les mariés », « Les clients ».
  clientsLabel: (eventId: string | null) => string;
  // L'adresse qui ouvre le panneau de la tâche, sur l'écran courant.
  href: (task: TaskLineSource) => string;
  eventHref: (eventId: string) => string;
  // Lot 70d (D1) : l'instant de la coche, à l'heure de Paris : le jour (« AAAA-MM-JJ »), la date courte et
  // l'heure écrites.
  formatDone?: (instant: string) => { day: string; date: string; time: string };
};

// Lot 70d (D1 ; rejeu : Valérie) : « Cochée par » dit qui a coché, pas qui s'en chargeait ; seulement ce qui
// est sûr (A9) : sinon, rien.
// `by` : en tête de colonne (« Vous », « Bastien », « Les mariés ») ; `byInSentence` : dans « Cochée à 14 h 40
// par vous » (« vous », « Bastien », « les mariés »).
export type TaskLineDone = { day: string; date: string; time: string; by: string | null; byInSentence: string | null };

export type TaskLineView = {
  id: string;
  eventId: string | null;
  label: string;
  href: string;
  event: { names: string; href: string } | null;
  // « Léa & Maxime », ou « Hors évènement ».
  eventLabel: string;
  dueDate: string;
  dateLabel: string;
  due: TaskLineDue | null;
  who: { name: string; initials: string | null };
  priority: boolean;
  done: boolean;
  // Valeur de « Confier à… » (« member:<id> », « clients », « vendor:<id> »).
  responsibleValue: string;
  // Lot 70d : en retard (regroupement par personne) ; faite le, cochée par.
  late: boolean;
  doneInfo: TaskLineDone | null;
};

function doneByName(task: TaskLineSource, context: TaskLineContext): { by: string; byInSentence: string } | null {
  const by = task.doneBy;
  if (!by) return null;
  if (by.kind === "clients") {
    const clients = context.clientsLabel(task.eventId);
    return { by: clients, byInSentence: clients.toLocaleLowerCase("fr") };
  }
  if (by.kind === "vendor") return { by: context.t("doneByVendorName"), byInSentence: context.t("doneByVendor") };
  const member = by.userId ? context.members.find((candidate) => candidate.id === by.userId) : undefined;
  if (!member) return null;
  if (member.me) return { by: context.t("you"), byInSentence: context.t("doneByYou") };
  const name = member.shortName ?? member.name;
  return { by: name, byInSentence: name };
}

function whoOf(task: TaskLineSource, context: TaskLineContext): { name: string; initials: string | null } {
  const { t } = context;
  if (task.responsible === "clients") {
    const name = context.clientsLabel(task.eventId);
    return { name, initials: nameInitials(name) };
  }
  if (task.responsible === "vendor") {
    const name = (task.vendorCandidateId ? context.vendorName(task.vendorCandidateId) : null) ?? t("vendorRemoved");
    return { name, initials: nameInitials(name) };
  }
  const member = task.assigneeUserId ? context.members.find((candidate) => candidate.id === task.assigneeUserId) : undefined;
  if (!member) return { name: t("nobody"), initials: null };
  const initials = member.initials ?? nameInitials(member.name);
  if (member.me) return { name: t("you"), initials };
  const name = member.shortName ?? member.name;
  return { name: member.removed ? t("memberRemoved", { name }) : name, initials };
}

export function responsibleValueOf(task: Pick<TaskLineSource, "responsible" | "vendorCandidateId" | "assigneeUserId">): string {
  if (task.responsible === "vendor" && task.vendorCandidateId) return `vendor:${task.vendorCandidateId}`;
  if (task.responsible === "planner" && task.assigneeUserId) return `member:${task.assigneeUserId}`;
  return task.responsible;
}

function doneInfoOf(task: TaskLineSource, doneAt: string, format: NonNullable<TaskLineContext["formatDone"]>, context: TaskLineContext): TaskLineDone {
  const who = doneByName(task, context);
  return { ...format(doneAt), by: who?.by ?? null, byInSentence: who?.byInSentence ?? null };
}

export function buildTaskLine(task: TaskLineSource, context: TaskLineContext): TaskLineView {
  return {
    id: task.id,
    eventId: task.eventId,
    label: task.label,
    href: context.href(task),
    event: task.event ? { names: task.event.names, href: context.eventHref(task.event.id) } : null,
    eventLabel: task.event ? task.event.names : context.t("noEvent"),
    dueDate: task.dueDate,
    dateLabel: context.formatDate(task.dueDate),
    due: task.done ? null : dueWords(task.dueState, context.t),
    who: whoOf(task, context),
    priority: task.priority === "high",
    done: task.done,
    responsibleValue: responsibleValueOf(task),
    late: !task.done && task.dueState?.kind === "late",
    doneInfo: task.done && task.doneAt && context.formatDone ? doneInfoOf(task, task.doneAt, context.formatDone, context) : null,
  };
}
