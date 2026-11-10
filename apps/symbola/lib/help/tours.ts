// Lot 10 (AIDE-05) — visites focus : pour chaque écran, l'élément mis en
// lumière à chaque étape (attribut data-tour de la page). Les textes sont
// dans les messages (« Tour.<clé> »), dans le même ordre ; une étape sans
// cible affiche sa bulle seule, au centre.
export const TOUR_TARGETS = {
  // Lot 20 (AIDE-15) : l'accueil présente l'agenda, ses commandes et les
  // blocs du dessous ; un bloc d'un module non souscrit a sa bulle au centre.
  hub: ["home-agenda", "agenda-controls", "home-follow-up", "home-tasks", "home-payments"],
  // Lot 20 (décision 2) : l'essai guidé est dans le texte d'aide, plus à l'écran.
  events: ["events-list", "new-prospect", "events-filters", "events-settings"],
  event: ["event-tabs", "event-overview", "tab-retroplanning", "tab-budget", "global-search"],
  // Lot 20 (AIDE-15) : seulement ce que montrent le Catalogue et la
  // Répartition du budget ; le reste est dans la fiche d'aide de l'écran.
  quotes: ["quotes-catalog", "catalog-new"],
  budget: ["budget-models", "budget-new-model"],
  // Lot 11 : carnet de prestataires.
  vendors: ["vendor-types", "vendor-filters", "vendor-results", "vendor-new"],
} as const satisfies Record<string, readonly (string | undefined)[]>;

export type TourKey = keyof typeof TOUR_TARGETS;
