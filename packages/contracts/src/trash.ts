// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille de 30 jours et « Annuler » pendant dix
// secondes. Les objets qui portent du travail vont à la corbeille ; les éléments d'une fiche
// s'annulent, puis sont purgés au plus tôt dix minutes après (décision D2).
export const TRASH_RETENTION_DAYS = 30;
export const UNDO_SECONDS = 10;
export const ELEMENT_PURGE_MINUTES = 10;
// Lot 39b (UX-09, D7, ADR 0074) : un brouillon de formulaire laissé en l'état est purgé après 30 jours.
export const FORM_DRAFT_RETENTION_DAYS = 30;

// Lot 46 (ADR 0082) : types de rendez-vous et rendez-vous.
// Lot 70a (A5 ; ADR 0117, avenant à l'ADR 0073) : une tâche supprimée reste trente jours à la corbeille ;
// les tâches supprimées d'un même geste y sont une seule ligne (l'identifiant est celui de l'une d'elles).
export const TRASH_KINDS = ["event", "contact", "document", "taskTemplate", "programTemplate", "quoteTemplate", "contractTemplate", "messageTemplate", "appointmentType", "appointment", "task"] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

// « vendor » : l'archivage d'un prestataire s'annule aussi (D6), sans passer par la corbeille.
// Lot 63d (UX-07) : « taskBatch », des tâches supprimées d'un seul geste depuis un tableau (l'identifiant
// est celui de l'une d'elles ; « Annuler » rend toutes celles du même geste).
// Lot 70a (A5) : « task » et « taskBatch » restent lus (bandeaux déjà posés) ; la tâche va désormais à la
// corbeille, sa purge suit TRASH_RETENTION_DAYS.
export const ELEMENT_KINDS = ["task", "taskBatch", "programItem", "place", "taskComment", "contactNote", "budgetLine", "quoteLine", "vendor"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export type UndoKind = TrashKind | ElementKind;

export function isTrashKind(value: string): value is TrashKind {
  return (TRASH_KINDS as readonly string[]).includes(value);
}

export function isUndoKind(value: string): value is UndoKind {
  return isTrashKind(value) || (ELEMENT_KINDS as readonly string[]).includes(value);
}

// Une ligne de la corbeille, telle que chaque module la décrit (libellé déjà lisible).
export type TrashedObject = {
  kind: TrashKind;
  id: string;
  label: string;
  // L'évènement d'un document, par exemple ; nul pour un modèle ou un contact.
  eventId: string | null;
  deletedAt: Date;
  deletedBy: string | null;
  // Lot 70a (A5) : nombre d'objets de la ligne (des tâches supprimées d'un même geste) ; absent : un seul.
  count?: number;
};

export function trashPurgeDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
