// Lot 10 (AIDE-05) — visites focus : pour chaque écran, l'élément mis en
// lumière à chaque étape (attribut data-tour de la page). Les textes sont
// dans les messages (« Tour.<clé> »), dans le même ordre ; une étape sans
// cible affiche sa bulle seule, au centre.
export const TOUR_TARGETS = {
  hub: ["home-agenda", "nav-settings", "help-button"],
  events: ["events-list", "new-prospect", "events-list", "events-settings", "events-trial"],
  event: ["event-tabs", "event-overview", "tab-retroplanning", "tab-prestataires", "global-search"],
  quotes: ["quotes-catalog", undefined, undefined, undefined],
  budget: ["budget-models", undefined, undefined, undefined],
  // Lot 11 : carnet de prestataires.
  vendors: ["vendor-types", "vendor-filters", "vendor-results", "vendor-new"],
} as const satisfies Record<string, readonly (string | undefined)[]>;

export type TourKey = keyof typeof TOUR_TARGETS;
