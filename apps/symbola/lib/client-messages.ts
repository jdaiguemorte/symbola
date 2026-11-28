// NFR-02 (lot 65) — les textes envoyés au navigateur. Chaque page transporte le catalogue des
// composants client ; les espaces de textes lus seulement côté serveur (centre d'aide, journal,
// e-mails, Exploitation…) n'y vont pas : ils pesaient un quart de chaque page. Un espace de cette liste ne doit
// jamais servir à useTranslations (client-messages.test.ts le vérifie dans tout le code).
export const SERVER_ONLY_NAMESPACES = [
  "Help",
  "ActivityLog",
  "Emails",
  "Subscription",
  "HelpCenter",
  "Home",
  "Trash",
  "Apps",
  "Admin",
  "AdminPlans",
  "AdminAccounts",
  "LedgerArchive",
  "DayReport",
  "EmailDeliveries",
  "Accounting",
  "AdminOverview",
  "Storage",
  "TutorialsPage",
  "AdminActivity",
  "VenueChecks",
  "AdminOnboarding",
  "MessageThread",
  "AdminFeatureFlags",
  "AdminClosures",
  "AdminHealth",
  "SubscriptionBanner",
  "PlanningHealth",
  "CashCalendar",
  "FakeSignature",
  "AdminMenu",
  "Compliance",
  "Devices",
  "ClosingDashboard",
  "Shortcuts",
  "StorageQuota",
  "Aide",
  "LinkPush",
  "AdminBackup",
  "NotFound",
  "Pagination",
  "RateLimit",
  "Organizations",
  "Manifest",
  "Loading",
  // Lot 72e : la Synthèse d'un évènement (suite, « Où en est le mariage », « Informations ») est rendue par le
  // serveur ; seule la fenêtre « Modifier les informations » (EventInfoWindow) lit ses textes au navigateur.
  "EventOverview",
  // Lot 71d : les nombres, « Doublons », le bilan et le retrait d'un import, rendus côté serveur.
  "ImportFigures",
  "ImportDoublons",
  "ImportBilan",
  "ImportWithdraw",
  // Lot 74b : les échéances déjà passées de « Nouvel évènement » ; la seule page /events/new les passe à sa
  // fenêtre (createTranslator), elles ne partent pas avec les autres pages.
  "PastDue",
  // Lot 74g : les 38 rubriques et « Vos données », lus côté serveur ; l'accueil des Paramètres reçoit ses
  // textes en propriétés, sa recherche les siens (« SettingsSearch »).
  "SettingsMenu",
  // Lot 73d : la fenêtre de création et la fiche d'un prestataire reçoivent leurs textes de l'écran.
  "VendorCreate",
  "VendorSheet",
] as const;

const SERVER_ONLY = new Set<string>(SERVER_ONLY_NAMESPACES);

export function clientMessages<T extends object>(messages: T): Omit<T, (typeof SERVER_ONLY_NAMESPACES)[number]> {
  return Object.fromEntries(Object.entries(messages).filter(([namespace]) => !SERVER_ONLY.has(namespace))) as Omit<T, (typeof SERVER_ONLY_NAMESPACES)[number]>;
}
