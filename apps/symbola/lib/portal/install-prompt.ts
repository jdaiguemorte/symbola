// Lot 55 (POR-11 ; ADR 0102) — quand proposer « Ajouter à l'écran d'accueil » : jamais à la première
// visite, seulement à partir de la deuxième ; une fois refusée, plus rien pendant 30 jours ; jamais
// si le portail est déjà installé. Une visite = une session du navigateur (pas chaque page).
// Fonctions pures ; l'état vit dans le navigateur (localStorage), rien n'est envoyé au serveur.
export const INSTALL_PROMPT_MIN_VISITS = 2;
export const INSTALL_PROMPT_SILENCE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type InstallPromptState = { visits: number; dismissedAt: number | null };

export function parseInstallPromptState(raw: string | null): InstallPromptState {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<InstallPromptState>) : {};
    const visits = Number.isInteger(value.visits) && (value.visits ?? 0) > 0 ? Math.min(value.visits!, 1000) : 0;
    const dismissedAt = typeof value.dismissedAt === "number" && Number.isFinite(value.dismissedAt) ? value.dismissedAt : null;
    return { visits, dismissedAt };
  } catch {
    return { visits: 0, dismissedAt: null };
  }
}

// Une nouvelle visite (nouvelle session du navigateur) ; une page de la même session ne compte pas.
export function recordVisit(state: InstallPromptState, newSession: boolean): InstallPromptState {
  return newSession ? { ...state, visits: state.visits + 1 } : state;
}

export function dismissInstallPrompt(state: InstallPromptState, now: number): InstallPromptState {
  return { ...state, dismissedAt: now };
}

export function shouldOfferInstall(state: InstallPromptState, input: { now: number; standalone: boolean }): boolean {
  if (input.standalone) return false;
  if (state.visits < INSTALL_PROMPT_MIN_VISITS) return false;
  if (state.dismissedAt !== null && input.now - state.dismissedAt < INSTALL_PROMPT_SILENCE_DAYS * DAY_MS) return false;
  return true;
}
