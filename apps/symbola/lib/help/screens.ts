// Lot 13 (AIDE-12, ADR 0033) — centre d'aide par écran : une vignette par
// écran, groupée par rubrique, avec la capture réelle de l'écran (script
// « help:captures ») et sa fiche (texte, repères, questions fréquentes).
// Les textes sont dans « Help.<clé> » (title, body, faq). Un écran d'un module
// non souscrit n'est pas proposé (CLAUDE.md §2.3) ; les écrans d'avant la
// connexion (connexion, invitation…) n'ont leur aide que sur leur écran.
import type { HelpModule } from "./catalog";
import type { TourKey } from "./tours";

export type HelpGroup = "events" | "vendors" | "quotes" | "budget" | "company" | "data" | "admin" | "clients";
export type HelpAudience = "team" | "admin" | "client";

export type HelpScreen = {
  // Clé dans « Help ».
  key: string;
  group: HelpGroup;
  audience: HelpAudience;
  // Module à souscrire pour voir l'écran (équipe seulement).
  module?: HelpModule;
  ownerOnly?: boolean;
  // Adresse de l'écran ; nulle pour un écran propre à un élément (fiche d'un événement…).
  path: string | null;
  // Repères de l'écran (AIDE-11), s'il en a.
  tour?: TourKey;
  // Capture réelle dans public/aide/captures/<clé>.jpg.
  capture: boolean;
};

export const HELP_SCREENS: HelpScreen[] = [
  // Événements
  { key: "eventsList", group: "events", audience: "team", module: "events", path: "/events", tour: "events", capture: true },
  { key: "eventsDetail", group: "events", audience: "team", module: "events", path: null, tour: "event", capture: true },
  { key: "eventsNew", group: "events", audience: "team", module: "events", path: "/events/new", capture: true },
  { key: "allTasks", group: "events", audience: "team", module: "events", path: "/taches", capture: true },
  { key: "eventsTemplates", group: "events", audience: "team", module: "events", path: "/events/modeles", capture: true },
  { key: "eventsProgramTemplates", group: "events", audience: "team", module: "events", path: "/events/modeles-programme", capture: true },
  { key: "eventsSettings", group: "events", audience: "team", module: "events", path: "/events/parametres", capture: true },
  // Prestataires
  { key: "vendorBook", group: "vendors", audience: "team", module: "vendors", path: "/prestataires", tour: "vendors", capture: true },
  // Devis et factures
  { key: "allQuotes", group: "quotes", audience: "team", module: "quotes", path: "/devis", capture: true },
  { key: "quotesDetail", group: "quotes", audience: "team", module: "quotes", path: null, capture: true },
  { key: "quotesCatalog", group: "quotes", audience: "team", module: "quotes", path: "/devis/catalogue", tour: "quotes", capture: true },
  { key: "quotesPayments", group: "quotes", audience: "team", module: "quotes", path: "/devis/encaissements", capture: true },
  { key: "quotesEReporting", group: "quotes", audience: "team", module: "quotes", path: "/devis/e-reporting", capture: true },
  { key: "quotesSettings", group: "quotes", audience: "team", module: "quotes", path: "/devis/parametres", capture: true },
  // Lot 17 (DEV-08 à DEV-11) : logo, apparence, textes et IBAN des documents.
  { key: "quotesDocuments", group: "quotes", audience: "team", module: "quotes", path: "/devis/parametres/documents", capture: true },
  // Budget
  { key: "budgetDetail", group: "budget", audience: "team", module: "budget", path: null, capture: true },
  { key: "budgetSettings", group: "budget", audience: "team", module: "budget", path: "/budget/parametres", tour: "budget", capture: true },
  // Mon entreprise et mon compte
  { key: "home", group: "company", audience: "team", path: "/", tour: "hub", capture: true },
  { key: "settings", group: "company", audience: "team", path: "/parametres", capture: true },
  { key: "profile", group: "company", audience: "team", path: "/profil", capture: true },
  // Données : import et données personnelles
  { key: "importFile", group: "data", audience: "team", path: "/import", capture: true },
  { key: "importColumns", group: "data", audience: "team", path: null, capture: false },
  // Lot 16 (IMP-12) : étape « Types » de l'assistant (prestataires).
  { key: "importTypes", group: "data", audience: "team", path: null, capture: false },
  { key: "importMatches", group: "data", audience: "team", path: null, capture: false },
  { key: "importGaps", group: "data", audience: "team", path: null, capture: false },
  { key: "importConfirm", group: "data", audience: "team", path: null, capture: false },
  { key: "importUndo", group: "data", audience: "team", path: null, capture: false },
  { key: "privacySearch", group: "data", audience: "team", ownerOnly: true, path: "/rgpd", capture: true },
  { key: "privacyRequests", group: "data", audience: "team", ownerOnly: true, path: "/rgpd/demandes", capture: true },
  { key: "privacyExport", group: "data", audience: "team", ownerOnly: true, path: "/rgpd", capture: false },
  { key: "privacyErasure", group: "data", audience: "team", ownerOnly: true, path: "/rgpd", capture: false },
  { key: "privacyPurge", group: "data", audience: "team", ownerOnly: true, path: "/rgpd/purge", capture: true },
  { key: "privacySettings", group: "data", audience: "team", ownerOnly: true, path: "/rgpd/reglages", capture: true },
  // Administration de la suite (aucune capture : elle montrerait des organisations)
  { key: "admin", group: "admin", audience: "admin", path: "/admin", capture: false },
  { key: "adminOrganizations", group: "admin", audience: "admin", path: "/admin/organisations", capture: false },
  { key: "adminAccounts", group: "admin", audience: "admin", path: "/admin/comptes", capture: false },
  { key: "adminActivity", group: "admin", audience: "admin", path: "/admin/activite", capture: false },
  { key: "adminOnboarding", group: "admin", audience: "admin", path: "/admin/prise-en-main", capture: false },
  { key: "adminHealth", group: "admin", audience: "admin", path: "/admin/health", capture: false },
  { key: "adminSettings", group: "admin", audience: "admin", path: "/admin/parametres", capture: false },
  // Espace des mariés
  { key: "clientSpace", group: "clients", audience: "client", path: "/espace", capture: false },
  { key: "clientEvent", group: "clients", audience: "client", path: null, capture: false },
  { key: "clientSecurity", group: "clients", audience: "client", path: "/espace/securite", capture: false },
];

export const HELP_GROUP_ORDER: HelpGroup[] = ["events", "vendors", "quotes", "budget", "company", "data", "admin", "clients"];

export type HelpViewer = { audience: HelpAudience; isOwner: boolean; modules: Record<HelpModule, boolean> };

// Écrans proposés à une personne : son public, ses modules souscrits, ses droits.
export function screensFor(viewer: HelpViewer): HelpScreen[] {
  return HELP_SCREENS.filter(
    (screen) =>
      screen.audience === viewer.audience &&
      (!screen.module || viewer.modules[screen.module]) &&
      (!screen.ownerOnly || viewer.isOwner),
  );
}

export function helpScreen(key: string): HelpScreen | undefined {
  return HELP_SCREENS.find((screen) => screen.key === key);
}

export function captureSrc(key: string): string {
  return `/aide/captures/${key}.jpg`;
}

export function helpScreenHref(key: string): string {
  return `/aide/ecrans/${key}`;
}
