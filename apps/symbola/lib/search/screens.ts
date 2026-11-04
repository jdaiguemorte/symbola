// Lot 10 (AIDE-08) — écrans de l'équipe trouvables par la recherche, avec
// leur article d'aide (« Help.<clé> ») : chercher « TVA » ou « modèle » mène à
// l'écran qui en parle. Un écran d'un module non souscrit n'est pas proposé.
import type { HelpModule } from "@/lib/help/catalog";

export type ScreenEntry = { path: string; module: HelpModule; label: string; help: string; ownerOnly?: boolean };

// label : clé dans « Home » ; help : clé dans « Help ».
export const SCREENS: ScreenEntry[] = [
  { path: "/", module: "hub", label: "agenda", help: "home" },
  { path: "/events", module: "events", label: "events", help: "eventsList" },
  { path: "/taches", module: "events", label: "tasks", help: "allTasks" },
  { path: "/devis", module: "quotes", label: "navQuotesGroup", help: "allQuotes" },
  { path: "/devis/encaissements", module: "quotes", label: "quotePayments", help: "quotesPayments" },
  { path: "/parametres", module: "hub", label: "settingsOrganization", help: "settings" },
  { path: "/events/parametres", module: "events", label: "settingsEventsLists", help: "eventsSettings" },
  { path: "/events/modeles", module: "events", label: "settingsTaskTemplates", help: "eventsTemplates" },
  { path: "/events/modeles-programme", module: "events", label: "settingsProgramTemplates", help: "eventsProgramTemplates" },
  { path: "/budget/parametres", module: "budget", label: "budgetModels", help: "budgetSettings" },
  { path: "/prestataires", module: "vendors", label: "vendorBook", help: "vendorBook" },
  { path: "/prestataires/parametres", module: "vendors", label: "settingsVendorTypes", help: "vendorBook" },
  { path: "/devis/parametres", module: "quotes", label: "quoteSettings", help: "quotesSettings" },
  { path: "/devis/catalogue", module: "quotes", label: "quoteCatalog", help: "quotesCatalog" },
  { path: "/devis/e-reporting", module: "quotes", label: "eReporting", help: "quotesEReporting" },
  { path: "/import", module: "hub", label: "importData", help: "importFile" },
  { path: "/rgpd", module: "hub", label: "privacy", help: "privacySearch", ownerOnly: true },
  { path: "/profil", module: "hub", label: "myProfile", help: "profile" },
];
