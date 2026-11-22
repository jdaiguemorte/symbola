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
] as const;

const SERVER_ONLY = new Set<string>(SERVER_ONLY_NAMESPACES);

export function clientMessages<T extends object>(messages: T): Omit<T, (typeof SERVER_ONLY_NAMESPACES)[number]> {
  return Object.fromEntries(Object.entries(messages).filter(([namespace]) => !SERVER_ONLY.has(namespace))) as Omit<T, (typeof SERVER_ONLY_NAMESPACES)[number]>;
}
