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
  // Lot 74f : la page « Aide », sa recherche et ses réponses, rendues côté serveur ; le champ de recherche
  // reçoit ses libellés en propriétés. Les articles, les mots voisins et l'index ne quittent pas le serveur.
  "HelpHome",
  // Lot 73d : la fenêtre de création et la fiche d'un prestataire reçoivent leurs textes de l'écran.
  "VendorCreate",
  "VendorSheet",
] as const;

// Lot 74f (consigne du 28/11 sur le poids des pages) : dans « Tutorials », le panneau client ne lit que les
// libellés communs (« Vérifier », « Tutoriel terminé »…) ; les étapes de chaque tutoriel sont lues côté
// serveur (page du tutoriel, lib/help/tutorial-panel.ts) et restent au serveur.
const SERVER_ONLY_ENTRIES: Record<string, (value: unknown) => boolean> = {
  Tutorials: (value) => typeof value !== "string",
};

const SERVER_ONLY = new Set<string>(SERVER_ONLY_NAMESPACES);

function withoutServerEntries(namespace: string, value: unknown): unknown {
  const serverOnly = SERVER_ONLY_ENTRIES[namespace];
  if (!serverOnly || !value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => !serverOnly(entry)));
}

export function clientMessages<T extends object>(messages: T): Omit<T, (typeof SERVER_ONLY_NAMESPACES)[number]> {
  return Object.fromEntries(
    Object.entries(messages)
      .filter(([namespace]) => !SERVER_ONLY.has(namespace))
      .map(([namespace, value]) => [namespace, withoutServerEntries(namespace, value)]),
  ) as Omit<T, (typeof SERVER_ONLY_NAMESPACES)[number]>;
}
