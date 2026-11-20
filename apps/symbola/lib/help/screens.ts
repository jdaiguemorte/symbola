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
  // Lot 55 (MSG-03) : les fils de discussion d'un évènement, ouverts depuis sa fiche.
  { key: "eventMessages", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "eventsTemplates", group: "events", audience: "team", module: "events", path: "/events/modeles", capture: true },
  { key: "eventsProgramTemplates", group: "events", audience: "team", module: "events", path: "/events/modeles-programme", capture: true },
  // Lot 58 (PAR-09, EVT-08 ; ADR 0097) : clôture d'un évènement, modèles d'évènement, bilans (tableau de
  // bord discret du temps passé, jamais mis en avant).
  { key: "eventClosing", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "eventTemplatesList", group: "events", audience: "team", module: "events", path: "/events/modeles-evenement", capture: false },
  { key: "closingDashboard", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "eventsSettings", group: "events", audience: "team", module: "events", path: "/events/parametres", capture: true },
  // Lot 20 (AIDE-14) : chaque écran de réglage a sa fiche.
  { key: "eventsSources", group: "events", audience: "team", module: "events", path: "/events/parametres/sources", capture: true },
  { key: "eventTypes", group: "events", audience: "team", module: "events", path: "/events/parametres/types", capture: true },
  // Lot 44 (CRM-01, CRM-02) : « Suivre vos demandes en colonnes », « Mettre le formulaire sur votre
  // site », et les étapes du pipeline.
  { key: "eventsPipeline", group: "events", audience: "team", module: "events", path: "/events/pipeline", capture: false },
  { key: "eventsContactForm", group: "events", audience: "team", module: "events", ownerOnly: true, path: "/events/parametres/contact", capture: false },
  { key: "eventsPipelineStages", group: "events", audience: "team", module: "events", ownerOnly: true, path: "/events/parametres/etapes", capture: false },
  // Lot 45 (CRM-06, POR-07, HUB-21) : relire une relance, questionnaires d'un évènement, modèles.
  { key: "followUpReview", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "eventQuestionnaires", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "questionnaireTemplates", group: "events", audience: "team", module: "events", path: "/events/parametres/questionnaires", capture: false },
  { key: "followUps", group: "events", audience: "team", module: "events", path: "/parametres/relances", capture: true },
  // Lot 53 (HUB-24, CHR-10) : termes des clients par type, tâches hors évènement (écran Tâches).
  { key: "clientTerms", group: "events", audience: "team", module: "events", path: "/events/parametres/termes", capture: false },
  { key: "standaloneTasks", group: "events", audience: "team", module: "events", path: "/taches", capture: false },
  // Lot 49 (INV-01 à INV-04, INV-07) : onglet Invités de la fiche, liste des régimes et allergies.
  { key: "guests", group: "events", audience: "team", module: "guests", path: null, capture: false },
  { key: "dietaryOptions", group: "events", audience: "team", module: "guests", path: "/events/parametres/regimes", capture: false },
  // Lot 50 (INV-05, INV-06) : plan de table (depuis l'onglet Invités d'une fiche), synthèse pour le
  // traiteur (sur le plan), types de repas.
  { key: "seatingPlan", group: "events", audience: "team", module: "guests", path: null, capture: false },
  { key: "catererSummary", group: "events", audience: "team", module: "guests", path: null, capture: false },
  { key: "mealTypes", group: "events", audience: "team", module: "guests", path: "/events/parametres/repas", capture: false },
  // Lot 60 (L60-PLA-01 à L60-PLA-05) : plans de salle des lieux et des évènements.
  { key: "floorplanEvent", group: "events", audience: "team", module: "floorplans", path: null, capture: false },
  // Lot 51 (JRJ-06, CHR-08) : modèles des listes du jour J ; import d'un chrono (onglet Programme).
  { key: "dayChecklists", group: "events", audience: "team", module: "events", path: "/events/parametres/listes-jour-j", capture: false },
  // Lot 52 (EVT-06) : l'équipe de l'évènement et ses renforts du jour J (adresse d'un évènement : pas de capture).
  { key: "eventTeam", group: "events", audience: "team", module: "events", path: "/events", capture: false },
  { key: "programImport", group: "events", audience: "team", module: "events", path: null, capture: false },
  // Lot 46 (RDV-01 à RDV-04, EVT-10) : rendez-vous.
  { key: "appointmentsList", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous", capture: false },
  { key: "appointmentDetail", group: "appointments", audience: "team", module: "appointments", path: null, capture: false },
  { key: "appointmentNew", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous/nouveau", capture: false },
  { key: "appointmentSettings", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous/reglages", capture: false },
  { key: "appointmentType", group: "appointments", audience: "team", module: "appointments", path: null, capture: false },
  { key: "appointmentAvailability", group: "appointments", audience: "team", module: "appointments", path: "/rendez-vous/disponibilites", capture: false },
  // Lot 47 (PAR-05, PRE-03, BUD-05) : demander des devis à plusieurs prestataires et comparer, les
  // scénarios d'options, les réglages des prestataires par lien.
  { key: "vendorCoordination", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "vendorScenarios", group: "events", audience: "team", module: "events", path: null, capture: false },
  { key: "vendorCoordinationSettings", group: "events", audience: "team", module: "events", path: "/events/parametres/prestataires-par-lien", capture: false },
  // Prestataires
  { key: "vendorBook", group: "vendors", audience: "team", module: "vendors", path: "/prestataires", tour: "vendors", capture: true },
  { key: "vendorDetail", group: "vendors", audience: "team", module: "vendors", path: null, capture: true },
  // Lot 60 : plans de salle d'un lieu, réglages d'un espace, éditeur, bibliothèque d'éléments.
  { key: "floorplanVenue", group: "vendors", audience: "team", module: "floorplans", path: null, capture: false },
  { key: "floorplanSpace", group: "vendors", audience: "team", module: "floorplans", path: null, capture: false },
  { key: "floorplanEditor", group: "vendors", audience: "team", module: "floorplans", path: null, capture: false },
  { key: "floorplanLibrary", group: "vendors", audience: "team", module: "floorplans", path: "/plans-de-salle/bibliotheque", capture: false },
  { key: "vendorNew", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/nouveau", capture: true },
  { key: "vendorTypes", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres", capture: true },
  { key: "vendorTags", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres/etiquettes", capture: true },
  { key: "vendorTravel", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres/trajet", capture: true },
  // Lot 48a (PRE-05) : réglages des pièces des prestataires.
  { key: "vendorDocuments", group: "vendors", audience: "team", module: "vendors", path: "/prestataires/parametres/pieces", capture: false },
  // Devis et factures
  { key: "allQuotes", group: "quotes", audience: "team", module: "quotes", path: "/devis", capture: true },
  // Lot 48b (BUD-08, PRE-07) : honoraires et commissions d'un évènement.
  { key: "plannerMoney", group: "quotes", audience: "team", module: "quotes", path: null, capture: false },
  // Lot 58 (FAC-11) : exports comptables (journaux, FEC, PDF d'origine), contrôle de rapprochement.
  { key: "accountingExports", group: "quotes", audience: "team", module: "quotes", path: "/devis/exports-comptables", capture: false },
  { key: "quotesDetail", group: "quotes", audience: "team", module: "quotes", path: null, capture: true },
  { key: "quotesCatalog", group: "quotes", audience: "team", module: "quotes", path: "/devis/catalogue", tour: "quotes", capture: true },
  // Lot 31a (FAC-01, HUB-21) : modèles de devis.
  { key: "quotesTemplates", group: "quotes", audience: "team", module: "quotes", path: "/devis/modeles", capture: false },
  // Lot 31b (FAC-04, HUB-21, JUR-20) : modèles de contrat.
  { key: "contractTemplates", group: "quotes", audience: "team", module: "quotes", path: "/devis/modeles-contrat", capture: false },
  // Lot 43 (FAC-02, FAC-09, FAC-15 ; ADR 0089) : modèles de proposition, relances, aperçu « vu par le client ».
  { key: "proposalTemplates", group: "quotes", audience: "team", module: "quotes", path: "/devis/modeles-proposition", capture: false },
  { key: "reminderSettings", group: "quotes", audience: "team", module: "quotes", path: "/devis/relances", capture: false },
  { key: "proposalPreview", group: "quotes", audience: "team", module: "quotes", path: null, capture: false },
  { key: "quotesPayments", group: "quotes", audience: "team", module: "quotes", path: "/devis/encaissements", capture: true },
  { key: "quotesEReporting", group: "quotes", audience: "team", module: "quotes", path: "/devis/e-reporting", capture: true },
  { key: "quotesSettings", group: "quotes", audience: "team", module: "quotes", path: "/devis/parametres", capture: true },
  // Lot 17 (DEV-08 à DEV-11) : logo, apparence, textes et IBAN des documents.
  { key: "quotesDocuments", group: "quotes", audience: "team", module: "quotes", path: "/devis/parametres/documents", capture: true },
  // Budget
  { key: "budgetDetail", group: "budget", audience: "team", module: "budget", path: null, capture: true },
  { key: "budgetSettings", group: "budget", audience: "team", module: "budget", path: "/budget/parametres", tour: "budget", capture: true },
  // Lot 43 (BUD-06, BUD-11 ; D8, D9) : payeurs et calendrier des sorties d'argent d'un évènement.
  { key: "budgetPayers", group: "budget", audience: "team", module: "budget", path: null, capture: false },
  { key: "budgetCashCalendar", group: "budget", audience: "team", module: "budget", path: null, capture: false },
  // Mon entreprise et mon compte
  { key: "home", group: "company", audience: "team", path: "/", tour: "hub", capture: true },
  { key: "settings", group: "company", audience: "team", path: "/parametres", capture: true },
  { key: "profile", group: "company", audience: "team", path: "/profil", capture: true },
  // Lot 52 (HUB-05) : « Mes sessions » (appareils du compte : pas de capture).
  { key: "sessions", group: "company", audience: "team", path: "/securite", capture: false },
  // Lot 53 (HUB-15, UX-16, HUB-28, GC-02) : notifications, leurs réglages, automatisations, radar.
  { key: "notifications", group: "company", audience: "team", path: "/notifications", capture: false },
  // Lot 55 (MSG-04 révisée, MSG-05) : adresse d'envoi et journal des envois.
  { key: "senderAddress", group: "company", audience: "team", path: "/parametres/adresse-envoi", capture: false },
  { key: "emailDeliveries", group: "company", audience: "team", path: "/parametres/envois", capture: false },
  { key: "notificationSettings", group: "company", audience: "team", path: "/parametres/notifications", capture: false },
  { key: "automations", group: "company", audience: "team", path: "/parametres/automatisations", capture: false },
  { key: "riskRadar", group: "company", audience: "team", path: "/parametres/radar", capture: false },
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
  // Lot 45 (CRM-07) : doublons possibles et fusion de deux fiches.
  { key: "contactDuplicates", group: "company", audience: "team", path: "/contacts/doublons", capture: false },
  { key: "contactMerge", group: "company", audience: "team", path: null, capture: false },
  { key: "contactDetail", group: "company", audience: "team", path: null, capture: false },
  // Lot 38a (MSG-01, D3, D7) : modèles des e-mails envoyés au nom de l'organisation.
  { key: "emailTemplates", group: "company", audience: "team", path: "/parametres/emails", capture: false },
  // Lot 38b (HUB-21, HUB-29 ; D10, D11) : modèles de messages ; Mon calendrier (dans le profil).
  { key: "messageTemplates", group: "company", audience: "team", module: "events", path: "/parametres/messages", capture: false },
  { key: "calendar", group: "company", audience: "team", module: "events", path: null, capture: false },
  // Lot 35a (HUB-13, D5) : export complet des données, titulaire seulement.
  { key: "organizationExport", group: "data", audience: "team", ownerOnly: true, path: "/parametres/export", capture: true },
  // Lot 35b (HUB-13, D6) : reprise d'un export Symbola dans un espace vide, titulaire seulement.
  { key: "organizationImport", group: "data", audience: "team", ownerOnly: true, path: "/parametres/reprise", capture: false },
  // Lot 35c (RGP-11, D8) : fermer l'espace, titulaire seulement.
  { key: "organizationClosure", group: "data", audience: "team", ownerOnly: true, path: "/parametres/fermeture", capture: false },
  // Lot 37b (DOC-12, D12) : relevé mensuel du stockage, titulaire seulement.
  { key: "storage", group: "data", audience: "team", ownerOnly: true, path: "/parametres/stockage", capture: false },
  // Lot 54 (HUB-27, DOC-06) : « Mon abonnement », titulaire seulement.
  { key: "subscription", group: "data", audience: "team", ownerOnly: true, path: "/parametres/abonnement", capture: false },
  // Lot 23b (JUR-06) : archive comptable, titulaire seulement.
  { key: "ledgerArchive", group: "quotes", audience: "team", module: "quotes", ownerOnly: true, path: "/devis/parametres/archive", capture: true },
  // Administration de la suite (aucune capture : elle montrerait des organisations)
  { key: "admin", group: "admin", audience: "admin", path: "/exploitation", capture: false },
  { key: "adminOrganizations", group: "admin", audience: "admin", path: "/exploitation/organisations", capture: false },
  { key: "adminAccounts", group: "admin", audience: "admin", path: "/exploitation/comptes", capture: false },
  { key: "adminActivity", group: "admin", audience: "admin", path: "/exploitation/activite", capture: false },
  { key: "adminClosures", group: "admin", audience: "admin", path: "/exploitation/fermetures", capture: false },
  { key: "adminPlans", group: "admin", audience: "admin", path: "/exploitation/offres", capture: false },
  { key: "adminFeatureFlags", group: "admin", audience: "admin", path: "/exploitation/interrupteurs", capture: false },
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
