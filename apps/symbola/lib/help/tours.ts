// Lot 10 (AIDE-05) — visites focus : pour chaque écran, l'élément mis en
// lumière à chaque étape (attribut data-tour de la page). Les textes sont
// dans les messages (« Tour.<clé> »), dans le même ordre ; une étape sans
// cible affiche sa bulle seule, au centre.
export const TOUR_TARGETS = {
  // Lot 32a (HUB-08, D3) : « Aujourd'hui » présente les trois urgences, le reste par groupe et les
  // évènements en cours ; une partie absente (rien d'autre à traiter) a sa bulle au centre.
  hub: ["home-first", "home-groups", "home-events"],
  // Lot 20 (décision 2) : l'essai guidé est dans le texte d'aide, plus à l'écran.
  // Lot 32a (D3), 32b (D11) : les deux vues, liste et calendrier (l'agenda venu de l'accueil).
  events: ["events-list", "new-prospect", "events-filters", "events-settings", "events-views"],
  event: ["event-tabs", "event-overview", "tab-retroplanning", "tab-budget", "global-search"],
  // Lot 20 (AIDE-15) : seulement ce que montrent le Catalogue et la
  // Répartition du budget ; le reste est dans la fiche d'aide de l'écran.
  quotes: ["quotes-catalog", "catalog-new"],
  budget: ["budget-models", "budget-new-model"],
  // Lot 11 : carnet de prestataires.
  vendors: ["vendor-types", "vendor-filters", "vendor-results", "vendor-new"],
} as const satisfies Record<string, readonly (string | undefined)[]>;

export type TourKey = keyof typeof TOUR_TARGETS;
