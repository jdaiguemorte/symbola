// Lot 74d (D2 de l'audit, B10, B11 ; décision L74-D9 ; page 25 des maquettes du lot 68) — quand une
// visite se propose. Seule la visite de l'accueil s'ouvre d'elle-même, une fois, quand l'assistant de
// démarrage est fini. Ailleurs, la ligne « Découvrir cet écran en 1 minute » paraît aux trois premières
// venues sur un écran rempli (une venue = une ouverture de l'écran un jour différent, à l'heure de
// Paris : recharger ou revenir dans la journée ne compte pas), jusqu'à « Lancer » ou « Fermer », qui
// comptent la visite comme vue. La préférence coupée retire la ligne et la visite de l'accueil.
//
// La progression tient dans la ligne « tour:<écran> » de hub.help_progress, par personne : « completed »
// = vue (lancée ou fermée) ; « postponed » = proposée, l'étape portant le nombre de venues et la date
// de mise à jour la dernière venue. Aucune colonne nouvelle.
import { parisToday } from "@symbola/i18n";

export const TOUR_LINE_VENUES = 3;

export type TourProgress = { status: "started" | "postponed" | "completed"; step: number; updatedAt: Date } | null;

export type TourOffer = "auto" | "line" | null;

export function tourOffer(input: {
  automatic: boolean;
  progress: TourProgress;
  now: Date;
  // Préférence « Proposer la visite d'un écran à sa première ouverture » (centre d'aide).
  preference: boolean;
  // Assistant de démarrage fini (lot 74a, HUB-09).
  setupDone: boolean;
  // Écran vide : sa visite montrerait ce qui n'existe pas (C-69).
  empty: boolean;
}): TourOffer {
  if (!input.preference) return null;
  if (input.automatic) return input.progress === null && input.setupDone ? "auto" : null;
  if (input.empty || input.progress?.status === "completed") return null;
  if (input.progress === null) return "line";
  // La venue du jour est déjà comptée : la ligne reste jusqu'à demain.
  if (parisToday(input.progress.updatedAt) === parisToday(input.now)) return "line";
  return input.progress.step < TOUR_LINE_VENUES ? "line" : null;
}

// La venue à compter quand la ligne paraît : le nouveau nombre de venues, ou null si rien ne change
// (même jour, visite vue, ou trois venues déjà).
export function nextTourVenue(progress: TourProgress, now: Date): number | null {
  if (progress === null) return 1;
  if (progress.status === "completed") return null;
  if (progress.step >= 1 && parisToday(progress.updatedAt) === parisToday(now)) return null;
  return progress.step < TOUR_LINE_VENUES ? Math.max(progress.step, 0) + 1 : null;
}
