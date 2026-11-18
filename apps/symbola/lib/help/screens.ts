// Lot 13 (AIDE-12, ADR 0033) — centre d'aide par écran : une vignette par
// écran, groupée par rubrique, avec la capture réelle de l'écran (script
// « help:captures ») et sa fiche (texte, repères, questions fréquentes).
// Les textes sont dans « Help.<clé> » (title, body, faq). Un écran d'un module
// non souscrit n'est pas proposé (CLAUDE.md §2.3) ; les écrans d'avant la
// connexion (connexion, invitation…) n'ont leur aide que sur leur écran.
import type { HelpModule } from "./catalog";
import type { TourKey } from "./tours";

export type HelpGroup = "events" | "appointments" | "vendors" | "quotes" | "budget" | "company" | "data" | "admin";
// Lot 26a : les tiers (portail par lien) n'ont pas de compte ; leur aide est
// sur l'écran même (ScreenHelp), pas dans le centre d'aide.
export type HelpAudience = "team" | "admin";

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
  // Lot 29a (ARC-09, JRJ-02) : écran du jour J, ouvert depuis la fiche (installation comprise).
  { key: "dayOf", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "eventsNew", group: "events", audience: "team", module: "events", path: "/events/new", capture: true },
  { key: "allTasks", group: "events", audience: "team", module: "events", path: "/taches", capture: true },
  { key: "eventsTemplates", group: "events", audience: "team", module: "events", path: "/events/modeles", capture: true },
  { key: "eventsProgramTemplates", group: "events", audience: "team", module: "events", path: "/events/modeles-programme", capture: true },
  { key: "eventsSettings", group: "events", audience: "team", module: "events", path: "/events/parametres", capture: true },
  // Lot 20 (AIDE-14) : chaque écran de réglage a sa fiche.
  { key: "eventsSources", group: "events", audience: "team", module: "events", path: "/events/parametres/sources", capture: true },
  { key: "eventTypes", group: "events", audience: "team", module: "events", path: "/events/parametres/types", capture: true },
  // Lot 44 (CRM-01, CRM-02) : « Suivre vos demandes en colonnes », « Mettre le formulaire sur votre
  // site », et les étapes du pipeline.
  { key: "eventsPipeline", group: "events", audience: "team", module: "events", path: "/events/pipeline", capture: false },
  { key: "eventsContactForm", group: "events", audience: "team", module: "events", ownerOnly: true, path: "/events/parametres/contact", capture: false },
  { key: "eventsPipelineStages", group: "events", audience: "team", module: "events", ownerOnly: true, path: "/events/parametres/etapes", capture: false },
  { key: "followUps", group: "events", audience: "team", module: "events", path: "/parametres/relances", capture: true },
  // Lot 49 (INV-01 à INV-04, INV-07) : onglet Invités de la fiche, liste des régimes et allergies.
  { key: "guests", group: "events", audience: "team", module: "guests", path: null, capture: false },
  { key: "dietaryOptions", group: "events", audience: "team", module: "guests", path: "/events/parametres/regimes", capture: false },
  // Lot 50 (INV-05, INV-06) : plan de table (depuis l'onglet Invités d'une fiche), synthèse pour le
  // traiteur (sur le plan), types de repas.
  { key: "seatingPlan", group: "events", audience: "team", module: "guests", path: null, capture: false },
  { key: "catererSummary", group: "events", audience: "team", module: "guests", path: null, capture: false },
  { key: "mealTypes", group: "events", audience: "team", module: "guests", path: "/events/parametres/repas", capture: false },
  // Lot 46 (RDV-01 à RDV-04, EVT-10) : rendez-vous.
  { key: "appointmentsList", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous", capture: false },
  { key: "appointmentDetail", group: "appointments", audience: "team", module: "appointments", path: null, capture: false },
  { key: "appointmentNew", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous/nouveau", capture: false },
  { key: "appointmentSettings", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous/reglages", capture: false },
  { key: "appointmentType", group: "appointments", audience: "team", module: "appointments", path: null, capture: false },
  { key: "appointmentAvailability", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous/disponibilites", capture: false },
  // Prestataires
  { key: "vendorBook", group: "vendors", audience: "team", module: "vendors", path: "/prestataires", tour: "vendors", capture: true },
  { key: "vendorDetail", group: "vendors", audience: "team", module: "vendors", path: null, capture: true },
  { key: "vendorNew", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/nouveau", capture: true },
  { key: "vendorTypes", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres", capture: true },
  { key: "vendorTags", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres/etiquettes", capture: true },
  { key: "vendorTravel", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres/trajet", capture: true },
  // Devis et factures
  { key: "allQuotes", group: "quotes", audience: "team", module: "quotes", path: "/devis", capture: true },
  { key: "quotesDetail", group: "quotes", audience: "team", module: "quotes", path: null, capture: true },
  { key: "quotesCatalog", group: "quotes", audience: "team", module: "quotes", path: "/devis/catalogue", tour: "quotes", capture: true },
  // Lot 31a (FAC-01, HUB-21) : modèles de devis.
  { key: "quotesTemplates", group: "quotes", audience: "team", module: "quotes", path: "/devis/modeles", capture: false },
  // Lot 31b (FAC-04, HUB-21, JUR-20) : modèles de contrat.
  { key: "contractTemplates", group: "quotes", audience: "team", module: "quotes", path: "/devis/modeles-contrat", capture: false },
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
  { key: "search", group: "company", audience: "team", path: "/recherche", capture: true },
  { key: "tutorials", group: "company", audience: "team", path: "/tutoriels", capture: true },
  { key: "setup", group: "company", audience: "team", path: null, capture: false },
  // Données : import et données personnelles
  { key: "importFile", group: "data", audience: "team", path: "/import", capture: true },
  { key: "importColumns", group: "data", audience: "team", path: null, capture: false },
  // Lot 16 (IMP-12) : étape « Types » de l'assistant (prestataires).
  { key: "importTypes", group: "data", audience: "team", path: null, capture: false },
  // Lot 36b (D11) : lignes à écarter d'un import de contacts.
  { key: "importRows", group: "data", audience: "team", path: null, capture: false },
  { key: "importMatches", group: "data", audience: "team", path: null, capture: false },
  { key: "importGaps", group: "data", audience: "team", path: null, capture: false },
  { key: "importConfirm", group: "data", audience: "team", path: null, capture: false },
  { key: "importUndo", group: "data", audience: "team", path: null, capture: false },
  // Lot 18 (RGPD-07) : les demandes sont l'accueil ; la recherche a son onglet ;
  // export et effacement se font dans le dossier d'une demande.
  { key: "privacyRequests", group: "data", audience: "team", ownerOnly: true, path: "/rgpd", capture: true },
  { key: "privacySearch", group: "data", audience: "team", ownerOnly: true, path: "/rgpd/recherche", capture: true },
  { key: "privacyCase", group: "data", audience: "team", ownerOnly: true, path: null, capture: true },
  { key: "privacyExport", group: "data", audience: "team", ownerOnly: true, path: null, capture: false },
  { key: "privacyErasure", group: "data", audience: "team", ownerOnly: true, path: null, capture: false },
  { key: "privacyPurge", group: "data", audience: "team", ownerOnly: true, path: "/rgpd/purge", capture: true },
  { key: "privacySettings", group: "data", audience: "team", ownerOnly: true, path: "/rgpd/reglages", capture: true },
  // Lot 23 (HUB-16) : journal d'activité de l'organisation, titulaire seulement.
  { key: "activityLog", group: "data", audience: "team", ownerOnly: true, path: "/parametres/journal", capture: true },
  // Lot 36a (CRM-03) : les contacts de l'organisation et la fiche d'un contact.
  { key: "contactsList", group: "company", audience: "team", path: "/contacts", capture: true },
  { key: "contactDetail", group: "company", audience: "team", path: null, capture: false },
  // Lot 38a (MSG-01, D3, D7) : modèles des e-mails envoyés au nom de l'organisation.
  { key: "emailTemplates", group: "company", audience: "team", path: "/parametres/emails", capture: false },
  // Lot 38b (HUB-21, HUB-29 ; D10, D11) : modèles de messages ; Mon calendrier (dans le profil).
  { key: "messageTemplates", group: "company", audience: "team", module: "events", path: "/parametres/messages", capture: false },
  { key: "calendar", group: "company", audience: "team", module: "events", path: null, capture: false },
  // Lot 35a (HUB-13, D5) : export complet des données, titulaire seulement.
  { key: "organizationExport", group: "data", audience: "team", ownerOnly: true, path: "/parametres/export", capture: true },
  // Lot 37b (DOC-12, D12) : relevé mensuel du stockage, titulaire seulement.
  { key: "storage", group: "data", audience: "team", ownerOnly: true, path: "/parametres/stockage", capture: false },
  // Lot 23b (JUR-06) : archive comptable, titulaire seulement.
  { key: "ledgerArchive", group: "quotes", audience: "team", module: "quotes", ownerOnly: true, path: "/devis/parametres/archive", capture: true },
  // Administration de la suite (aucune capture : elle montrerait des organisations)
  { key: "admin", group: "admin", audience: "admin", path: "/exploitation", capture: false },
  { key: "adminOrganizations", group: "admin", audience: "admin", path: "/exploitation/organisations", capture: false },
  { key: "adminAccounts", group: "admin", audience: "admin", path: "/exploitation/comptes", capture: false },
  { key: "adminActivity", group: "admin", audience: "admin", path: "/exploitation/activite", capture: false },
  { key: "adminOnboarding", group: "admin", audience: "admin", path: "/exploitation/prise-en-main", capture: false },
  { key: "adminHealth", group: "admin", audience: "admin", path: "/exploitation/health", capture: false },
  { key: "adminSettings", group: "admin", audience: "admin", path: "/exploitation/parametres", capture: false },
];

export const HELP_GROUP_ORDER: HelpGroup[] = ["events", "appointments", "vendors", "quotes", "budget", "company", "data", "admin"];

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

// Lot 20 (AIDE-16) : la vignette d'un écran, sa capture réelle ou, à défaut,
// une illustration générique ; jamais un « ? ».
export const GENERIC_ILLUSTRATION = "/aide/illustration-ecran.svg";

export function tileImage(screen: HelpScreen): string {
  return screen.capture ? captureSrc(screen.key) : GENERIC_ILLUSTRATION;
}

export function helpScreenHref(key: string): string {
  return `/aide/ecrans/${key}`;
}
