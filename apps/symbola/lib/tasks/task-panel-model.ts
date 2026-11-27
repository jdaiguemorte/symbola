// Lot 70c (CHR-02, CHR-10, UX-09 ; M1, A3, A8, A22 ; ADR 0119 ; page 1 et 2 des maquettes du lot 68) — le
// panneau d'une tâche, sans React : ce qu'il garde (le brouillon), ce qui a changé, s'il faut demander
// « Fermer sans enregistrer ? » ; la création avec ou sans évènement ; la copie d'une tâche.
//
// M1 : le panneau s'enregistre d'un bouton (« Enregistrer », « Créer la tâche »), jamais champ par champ.
// « Fermer », la croix et Échap ferment tout de suite s'il n'y a rien de changé ; sinon le pied du panneau
// demande « Fermer sans enregistrer ? », sans seconde fenêtre par-dessus.

export const DRAFT_FIELDS = ["label", "eventId", "dueDate", "responsible", "categoryId", "note", "priority", "recurrence"] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];

// Tout en texte, comme le formulaire l'envoie ; une valeur vide : « aucun » (évènement, catégorie,
// répétition) ou « pas encore choisi » (échéance).
export type TaskDraft = {
  label: string;
  eventId: string;
  dueDate: string;
  // « member:<id> », « clients », « vendor:<id> », « planner » (personne de nommé).
  responsible: string;
  categoryId: string;
  note: string;
  priority: "high" | "normal";
  recurrence: string;
};

function normalized(draft: TaskDraft, field: DraftField): string {
  const value = draft[field];
  return field === "label" || field === "note" ? value.trim() : value;
}

export function changedFields(initial: TaskDraft, current: TaskDraft): DraftField[] {
  return DRAFT_FIELDS.filter((field) => normalized(initial, field) !== normalized(current, field));
}

export function closeDecision(initial: TaskDraft, current: TaskDraft): "close" | "confirm" {
  return changedFields(initial, current).length === 0 ? "close" : "confirm";
}

export function draftOf(task: {
  label: string;
  eventId: string | null;
  dueDate: string;
  responsibleValue: string;
  categoryId: string | null;
  note: string | null;
  priority: "high" | "normal";
  recurrence: string | null;
}): TaskDraft {
  return {
    label: task.label,
    eventId: task.eventId ?? "",
    dueDate: task.dueDate,
    responsible: task.responsibleValue,
    categoryId: task.categoryId ?? "",
    note: task.note ?? "",
    priority: task.priority,
    recurrence: task.recurrence ?? "",
  };
}

// Une nouvelle tâche : l'évènement d'office depuis sa fiche (ou un filtre), à qui la crée (A3).
export function createDraft(input: { eventId: string | null; responsible: string }): TaskDraft {
  return { label: "", eventId: input.eventId ?? "", dueDate: "", responsible: input.responsible, categoryId: "", note: "", priority: "normal", recurrence: "" };
}

// La répétition ne vaut que pour une tâche sans évènement (TVA, assurance, comptabilité).
export function repetitionOffered(draft: TaskDraft): boolean {
  return draft.eventId === "";
}

// A22 : la copie garde titre, évènement, personne, catégorie, note ; l'échéance est à choisir.
export function copyDraft(source: TaskDraft): TaskDraft {
  return { ...source, dueDate: "", priority: "normal" };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

// A8 : « {n} jours avant le jour J » ; la tâche garde alors sa date relative (DAT-07).
export function dueFromDaysBefore(eventDate: string, days: number): string {
  return new Date((dayNumber(eventDate) - days) * DAY_MS).toISOString().slice(0, 10);
}

export function daysBeforeEvent(eventDate: string, dueDate: string): number {
  return dayNumber(eventDate) - dayNumber(dueDate);
}
