// Lot 10 (AIDE-06, AIDE-07) — catalogue de l'aide : les 9 tutoriels (la
// progression « N sur 9 » les compte) et les visites focus des écrans. Les
// titres et textes sont dans les messages (« HelpCenter.items.<clé> ») ; un
// élément dont le module n'est pas souscrit n'est pas proposé (CLAUDE.md §2.3).
import type { TourKey } from "./tours";

export type HelpModule = "events" | "quotes" | "budget" | "vendors" | "hub";

export type TutorialKey =
  | "event-page"
  | "retroplanning-template"
  | "client-space"
  | "quote-signature"
  | "deposit-invoice"
  | "budget-simulation"
  | "catalog"
  | "day-program"
  | "import"
  | "vendor-quotes";

export type TutorialDefinition = {
  key: TutorialKey;
  module: HelpModule;
  minutes: number;
  // Écran où le tutoriel est proposé à la première visite (AIDE-06).
  screen: string;
};

// Ordre conseillé de prise en main.
export const TUTORIALS: TutorialDefinition[] = [
  { key: "event-page", module: "events", minutes: 2, screen: "/events" },
  { key: "retroplanning-template", module: "events", minutes: 3, screen: "/events/modeles" },
  { key: "catalog", module: "quotes", minutes: 3, screen: "/devis/catalogue" },
  { key: "quote-signature", module: "quotes", minutes: 5, screen: "/devis" },
  { key: "deposit-invoice", module: "quotes", minutes: 4, screen: "/devis/encaissements" },
  { key: "budget-simulation", module: "budget", minutes: 3, screen: "/budget/parametres" },
  { key: "day-program", module: "events", minutes: 3, screen: "/events/modeles-programme" },
  { key: "client-space", module: "events", minutes: 3, screen: "/events" },
  { key: "import", module: "hub", minutes: 4, screen: "/import" },
  // Lot 11 : comparer plusieurs devis pour un poste (sans carnet : saisie libre).
  { key: "vendor-quotes", module: "events", minutes: 4, screen: "/prestataires" },
];

export type TourDefinition = { key: TourKey; module: HelpModule; path: string | null };

// path nul : la visite se lance depuis l'écran concerné (fiche d'un événement).
export const TOURS: TourDefinition[] = [
  { key: "hub", module: "hub", path: "/" },
  { key: "events", module: "events", path: "/events" },
  { key: "event", module: "events", path: null },
  { key: "quotes", module: "quotes", path: "/devis/catalogue" },
  { key: "budget", module: "budget", path: "/budget/parametres" },
  { key: "vendors", module: "vendors", path: "/prestataires" },
];

export function tutorialHref(key: TutorialKey): string {
  return `/aide/tutoriels/${key}`;
}
