// Lot 74g (G1, G2, G5, G16 ; pages 29 et 31 des maquettes du lot 68) — le registre des Paramètres, en un
// seul endroit : huit groupes, 38 rubriques, et la page « Vos données ». L'accueil des Paramètres, le menu
// du groupe (settings-nav.tsx), la règle « cet écran est un réglage » (settings-paths.ts) et la table des
// redirections lisent tous cette liste. Les libellés et les phrases sont des clés de « SettingsMenu »
// (fichiers de traduction) : `groups.<groupe>.{label,hint}`, `rubrics.<rubrique>.{label,hint}`,
// `data.<ligne>.{label,hint}`.
//
// Une rubrique garde l'écran, l'adresse et la garde d'aujourd'hui : seul son rangement change. Un groupe
// d'un module non souscrit disparaît (ARC-06) ; une rubrique réservée à la titulaire (`ownerOnly`, garde
// `requireOwner`) reste hors du menu de l'équipe, comme avant ; « titulaire » (`owner`) marque ce que
// seule la titulaire change.

export type SettingsGroupKey = "company" | "you" | "events" | "planning" | "budgetVendors" | "sales" | "messages" | "appointments";
export type SettingsGroupIcon = SettingsGroupKey | "data";

export type SettingsMenuFlags = {
  events: boolean;
  budget: boolean;
  quotes: boolean;
  vendors: boolean;
  guests: boolean;
  appointments: boolean;
  isOwner: boolean;
  // Lot 54 (HUB-27, ADR 0101) : l'abonnement en libre-service.
  selfService: boolean;
};

export type SettingsMenuItem = {
  // Clé de la rubrique (ou de la ligne de « Vos données ») ; son libellé est `rubrics.<key>.label`.
  key: string;
  href: string;
  // Le libellé et la phrase, clés de « SettingsMenu ».
  label: string;
  hint: string;
  // « titulaire » : seule la titulaire change ce réglage (l'équipe le lit).
  owner: boolean;
  // Sous-écrans servis par la rubrique hors de son adresse (« Tous les modules » sous l'abonnement).
  paths: string[];
};
export type SettingsMenuGroup = { key: SettingsGroupKey; icon: SettingsGroupIcon; label: string; hint: string; items: SettingsMenuItem[] };

type Rubric = {
  key: string;
  group: SettingsGroupKey;
  href: (flags: SettingsMenuFlags) => string;
  visible: (flags: SettingsMenuFlags) => boolean;
  owner?: boolean;
  paths?: string[];
  // Toutes les adresses que la rubrique peut prendre (pour la règle « réglage »).
  hrefs?: string[];
};

const always = () => true;
const at = (href: string) => () => href;

// L'ordre est celui de la maquette : l'entreprise, vous, l'évènement, son déroulé, son budget, ses devis,
// ses messages, les rendez-vous.
export const SETTINGS_GROUPS: readonly SettingsGroupKey[] = ["company", "you", "events", "planning", "budgetVendors", "sales", "messages", "appointments"];

const RUBRICS: readonly Rubric[] = [
  // Votre entreprise
  { key: "companySheet", group: "company", href: at("/parametres/entreprise"), visible: always },
  { key: "companyMentions", group: "company", href: at("/parametres/mentions"), visible: always },
  // Lot 24b (SEC-06, D3) : l'équipe, titulaire seulement (requireOwner).
  { key: "team", group: "company", href: at("/parametres/equipe"), visible: (f) => f.isOwner, owner: true },
  // Lot 54 (HUB-27) et lot 63g (ADR 0108) : l'abonnement en libre-service, et « Tous les modules », que le
  // menu latéral montrait à la titulaire avec ou sans libre-service (choix de la session d'audit, 28/11).
  {
    key: "subscription",
    group: "company",
    href: (f) => (f.selfService ? "/parametres/abonnement" : "/apps"),
    hrefs: ["/parametres/abonnement", "/apps"],
    paths: ["/apps"],
    visible: (f) => f.isOwner,
    owner: true,
  },
  // Vous
  { key: "profile", group: "you", href: at("/profil"), visible: always },
  { key: "notifications", group: "you", href: at("/parametres/notifications"), visible: always },
  // Évènements
  { key: "eventTypes", group: "events", href: at("/events/parametres/types"), visible: (f) => f.events },
  { key: "sourcesReasons", group: "events", href: at("/events/parametres/sources"), visible: (f) => f.events },
  // Lot 44 (CRM-01, CRM-02) : étapes et formulaire de contact, titulaire seulement (requireOwner).
  { key: "pipeline", group: "events", href: at("/events/parametres/etapes"), visible: (f) => f.events && f.isOwner, owner: true },
  { key: "eventTemplates", group: "events", href: at("/events/modeles-evenement"), visible: (f) => f.events },
  { key: "questionnaires", group: "events", href: at("/events/parametres/questionnaires"), visible: (f) => f.events },
  { key: "guestOptions", group: "events", href: at("/events/parametres/regimes"), visible: (f) => f.events && f.guests },
  { key: "busyRanges", group: "events", href: at("/events/parametres/plages-occupees"), visible: (f) => f.events },
  // Tâches, programme et jour J
  { key: "taskCategories", group: "planning", href: at("/events/parametres/taches"), visible: (f) => f.events },
  { key: "retroplanning", group: "planning", href: at("/events/modeles"), visible: (f) => f.events },
  { key: "program", group: "planning", href: at("/events/modeles-programme"), visible: (f) => f.events },
  { key: "dayChecklists", group: "planning", href: at("/events/parametres/listes-jour-j"), visible: (f) => f.events },
  // Budget et prestataires. Les postes de départ (module Évènements) et la répartition (module Budget)
  // sont une rubrique ; sans le module Évènements, la répartition garde son adresse.
  {
    key: "budget",
    group: "budgetVendors",
    href: (f) => (f.events ? "/events/parametres" : "/budget/parametres"),
    hrefs: ["/events/parametres", "/budget/parametres"],
    visible: (f) => f.events || f.budget,
  },
  { key: "vendorTypes", group: "budgetVendors", href: at("/prestataires/parametres"), visible: (f) => f.vendors },
  { key: "vendorTags", group: "budgetVendors", href: at("/prestataires/parametres/etiquettes"), visible: (f) => f.vendors },
  { key: "vendorDocuments", group: "budgetVendors", href: at("/prestataires/parametres/pieces"), visible: (f) => f.vendors },
  { key: "vendorTravel", group: "budgetVendors", href: at("/prestataires/parametres/trajet"), visible: (f) => f.vendors },
  { key: "vendorCoordination", group: "budgetVendors", href: at("/events/parametres/prestataires-par-lien"), visible: (f) => f.events, owner: true },
  // Devis et factures
  { key: "catalog", group: "sales", href: at("/devis/catalogue"), visible: (f) => f.quotes },
  { key: "quoteSettings", group: "sales", href: at("/devis/parametres"), visible: (f) => f.quotes },
  { key: "quoteDocuments", group: "sales", href: at("/devis/parametres/documents"), visible: (f) => f.quotes },
  { key: "quoteTemplates", group: "sales", href: at("/devis/modeles"), visible: (f) => f.quotes },
  { key: "contractTemplates", group: "sales", href: at("/devis/modeles-contrat"), visible: (f) => f.quotes },
  { key: "proposalTemplates", group: "sales", href: at("/devis/modeles-proposition"), visible: (f) => f.quotes },
  // Messages et automatismes
  { key: "messageTemplates", group: "messages", href: at("/parametres/messages"), visible: (f) => f.events },
  { key: "emailTemplates", group: "messages", href: at("/parametres/emails"), visible: (f) => f.events || f.quotes },
  { key: "senderAddress", group: "messages", href: at("/parametres/adresse-envoi"), visible: (f) => f.events || f.quotes, owner: true },
  { key: "automations", group: "messages", href: at("/parametres/automatisations"), visible: always, owner: true },
  { key: "riskRadar", group: "messages", href: at("/parametres/radar"), visible: always, owner: true },
  { key: "followUp", group: "messages", href: at("/parametres/relances"), visible: (f) => f.events || f.budget },
  { key: "paymentReminders", group: "messages", href: at("/devis/relances"), visible: (f) => f.quotes },
  // Rendez-vous
  { key: "appointmentTypes", group: "appointments", href: at("/rendez-vous/reglages"), visible: (f) => f.appointments },
  { key: "appointmentAvailability", group: "appointments", href: at("/rendez-vous/disponibilites"), visible: (f) => f.appointments },
];

// « Vos données » (L74-D7) : ce qui n'est pas un réglage. Chaque ligne garde son écran et ses droits
// d'aujourd'hui ; « Fermer l'espace » est la dernière, à part.
type DataLine = { key: string; href: string; visible: (flags: SettingsMenuFlags) => boolean; owner?: boolean; secondary?: { key: string; href: string; visible: (flags: SettingsMenuFlags) => boolean }[] };

const DATA_LINES: readonly DataLine[] = [
  { key: "export", href: "/parametres/export", visible: (f) => f.isOwner, owner: true },
  { key: "organizationImport", href: "/parametres/reprise", visible: (f) => f.isOwner, owner: true },
  { key: "trash", href: "/parametres/corbeille", visible: always },
  { key: "activityLog", href: "/parametres/journal", visible: (f) => f.isOwner, owner: true },
  { key: "emailDeliveries", href: "/parametres/envois", visible: (f) => f.events || f.quotes },
  { key: "privacy", href: "/rgpd", visible: (f) => f.isOwner, owner: true },
  { key: "storage", href: "/parametres/stockage", visible: (f) => f.isOwner, owner: true },
  {
    key: "accounting",
    href: "/devis/exports-comptables",
    visible: (f) => f.quotes,
    secondary: [
      { key: "accountingArchive", href: "/devis/parametres/archive", visible: (f) => f.isOwner },
      { key: "eReporting", href: "/devis/e-reporting", visible: always },
    ],
  },
];

// « Fermer l'espace » : seul, en bas de « Vos données ».
export const CLOSURE_PATH = "/parametres/fermeture";
// « Reprendre et importer » sort des Paramètres (G6) : ouvert par « Vos données ».
export const IMPORT_PATH = "/import";
export const YOUR_DATA_PATH = "/donnees";
export const SETTINGS_HOME_PATH = "/parametres";

function item(key: string, href: string, scope: "rubrics" | "data", owner: boolean, paths: string[] = []): SettingsMenuItem {
  return { key, href, label: `${scope}.${key}.label`, hint: `${scope}.${key}.hint`, owner, paths };
}

// Les groupes des Paramètres, pour ces modules et ce rôle ; un groupe vide disparaît.
export function settingsMenu(flags: SettingsMenuFlags): SettingsMenuGroup[] {
  return SETTINGS_GROUPS.map((key) => ({
    key,
    icon: key,
    label: `groups.${key}.label`,
    hint: `groups.${key}.hint`,
    items: RUBRICS.filter((rubric) => rubric.group === key && rubric.visible(flags)).map((rubric) => item(rubric.key, rubric.href(flags), "rubrics", rubric.owner ?? false, rubric.paths)),
  })).filter((group) => group.items.length > 0);
}

export type YourDataLine = SettingsMenuItem & { secondary: SettingsMenuItem[] };

// Les lignes de « Vos données », pour ces modules et ce rôle (sans « Fermer l'espace »).
export function yourDataLines(flags: SettingsMenuFlags): YourDataLine[] {
  return DATA_LINES.filter((line) => line.visible(flags)).map((line) => ({
    ...item(line.key, line.href, "data", line.owner ?? false),
    secondary: (line.secondary ?? []).filter((other) => other.visible(flags)).map((other) => item(other.key, other.href, "data", false)),
  }));
}

// « Fermer l'espace » : la titulaire seulement, comme avant.
export function showsClosure(flags: SettingsMenuFlags): boolean {
  return flags.isOwner;
}
// « Reprendre et importer » : avec un module qui importe, comme avant.
export function showsImport(flags: SettingsMenuFlags): boolean {
  return flags.events || flags.budget || flags.quotes;
}

// Toutes les adresses des rubriques, tous modules et rôles confondus.
export const SETTINGS_RUBRIC_HREFS: readonly string[] = RUBRICS.flatMap((rubric) => [...new Set([...(rubric.hrefs ?? [rubric.href(ALL_FLAGS())]), ...(rubric.paths ?? [])])]);
// Les écrans de « Vos données ».
export const YOUR_DATA_HREFS: readonly string[] = [YOUR_DATA_PATH, ...DATA_LINES.flatMap((line) => [line.href, ...(line.secondary ?? []).map((other) => other.href)]), CLOSURE_PATH];
// Toutes les adresses « réglage » : l'accueil, les rubriques, « Vos données ».
export const SETTINGS_MENU_HREFS: readonly string[] = [SETTINGS_HOME_PATH, ...SETTINGS_RUBRIC_HREFS, ...YOUR_DATA_HREFS];

function ALL_FLAGS(): SettingsMenuFlags {
  return { events: true, budget: true, quotes: true, vendors: true, guests: true, appointments: true, isOwner: true, selfService: true };
}

// Les anciennes rubriques fondues dans une autre (§ 7.1) : l'ancienne adresse mène au bloc de sa
// nouvelle rubrique. Lues par next.config.ts (redirections du serveur, non permanentes).
export const MERGED_RUBRIC_REDIRECTS: readonly { source: string; destination: string }[] = [
  { source: "/events/parametres/termes", destination: "/events/parametres/types#termes" },
  { source: "/events/parametres/contact", destination: "/events/parametres/etapes#contact" },
  { source: "/events/parametres/repas", destination: "/events/parametres/regimes#repas" },
];
// `/budget/parametres` mène à `/events/parametres#repartition` quand le module Évènements est souscrit ;
// sinon elle reste la rubrique (la page elle-même décide : la redirection dépend de l'organisation).
export const BUDGET_ALLOCATION_ANCHOR = "repartition";

// « Entreprise et TVA » (`/parametres`, deux onglets) devient deux rubriques. Le fragment d'une adresse
// n'arrive pas au serveur : l'accueil renvoie ces ancres à leur rubrique (settings-anchor-redirect.tsx).
export const COMPANY_ANCHOR_REDIRECTS: Readonly<Record<string, string>> = {
  fiche: "/parametres/entreprise",
  "profil-entreprise": "/parametres/entreprise",
  "coordonnees-documents": "/parametres/entreprise",
  tva: "/parametres/entreprise",
  "tva-debits": "/parametres/entreprise",
  documents: "/parametres/mentions",
  "informations-professionnel": "/parametres/mentions",
  logo: "/parametres/mentions",
};

// L'adresse où mène une ancre de l'ancien écran « Entreprise et TVA », ou null.
export function companyAnchorTarget(hash: string): string | null {
  const anchor = decodeURIComponent(hash.replace(/^#/, ""));
  const path = COMPANY_ANCHOR_REDIRECTS[anchor];
  if (!path) return null;
  // « #fiche » et « #documents » nommaient l'onglet : la rubrique s'ouvre en haut.
  return anchor === "fiche" || anchor === "documents" ? path : `${path}#${anchor}`;
}
