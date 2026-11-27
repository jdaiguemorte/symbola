// Lot 70b (UX-07, UX-15, NFR-16 ; M5, M6, C-09 ; page 4 des maquettes du lot 68) — le modèle du message
// de retour, sans React : un seul message à la fois (le suivant remplace le précédent), dix secondes
// quand on peut défaire ou réessayer, cinq sinon, le temps arrêté sous la souris ou le focus.

export const FEEDBACK_UNDO_MS = 10_000;
export const FEEDBACK_SHORT_MS = 5_000;

// « undo » défait (Annuler), « retry » relance ce qui a échoué (Réessayer), « link » mène à l'objet
// (Ouvrir sa fiche, Voir ses tâches).
export type FeedbackActionKind = "undo" | "retry" | "link";

export type FeedbackMessage = {
  id: string;
  tone: "info" | "error";
  // Ce qui s'est passé, puis l'objet : « Tâche faite : Choisir le fleuriste ».
  title: string;
  // La conséquence ou la suite : « Elle reste dans la Corbeille des Paramètres ».
  detail?: string | undefined;
  action?: { kind: FeedbackActionKind; label: string } | undefined;
};

export type FeedbackState = {
  message: FeedbackMessage | null;
  // Temps restant au moment `since` ; quand le message est en pause, il ne s'écoule plus.
  remainingMs: number;
  since: number;
  paused: boolean;
};

export const initialFeedback: FeedbackState = { message: null, remainingMs: 0, since: 0, paused: false };

export function durationFor(message: FeedbackMessage): number {
  return message.action?.kind === "undo" || message.action?.kind === "retry" ? FEEDBACK_UNDO_MS : FEEDBACK_SHORT_MS;
}

export function showFeedback(_state: FeedbackState, message: FeedbackMessage, now: number): FeedbackState {
  return { message, remainingMs: durationFor(message), since: now, paused: false };
}

export function remainingMs(state: FeedbackState, now: number): number {
  if (!state.message) return 0;
  if (state.paused) return state.remainingMs;
  return Math.max(0, state.remainingMs - (now - state.since));
}

export function isExpired(state: FeedbackState, now: number): boolean {
  return remainingMs(state, now) <= 0;
}

export function pauseFeedback(state: FeedbackState, now: number): FeedbackState {
  if (!state.message || state.paused) return state;
  return { ...state, remainingMs: remainingMs(state, now), since: now, paused: true };
}

export function resumeFeedback(state: FeedbackState, now: number): FeedbackState {
  if (!state.message || !state.paused) return state;
  return { ...state, since: now, paused: false };
}
