// Clés des modules qu'un Admin peut activer ou désactiver par organisation (lot 11 :
// vendors, ADR 0031 ; socle des lots 46 et 49, ADR 0079 : appointments et guests).
export const MODULE_KEYS = ["events", "budget", "quotes", "vendors", "appointments", "guests"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

// État d'un module tant que l'Admin n'a rien réglé pour l'organisation (aucune ligne dans
// hub.organization_modules). Les quatre modules du pilote restent ouverts, comme avant le
// socle ; les nouveaux sont fermés jusqu'à ce que l'Admin les ouvre (RGP-05, réglages
// protecteurs par défaut ; pour les invités, analyse d'impact préalable demandée par la DPO).
export const MODULE_ENABLED_BY_DEFAULT: Readonly<Record<ModuleKey, boolean>> = {
  events: true,
  budget: true,
  quotes: true,
  vendors: true,
  appointments: false,
  guests: false,
};

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

// Refus par défaut pour une clé inconnue.
export function moduleEnabledByDefault(moduleKey: string): boolean {
  return isModuleKey(moduleKey) ? MODULE_ENABLED_BY_DEFAULT[moduleKey] : false;
}
