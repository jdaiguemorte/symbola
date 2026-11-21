// Lot 63c (UX-09, UX-13 ; ADR 0107, maquette M8) — les réglages d'un écran s'ouvrent dans le panneau
// latéral, sans quitter l'écran. La roue « Réglages » mène à /reglages/<clé> : sur ordinateur, la
// navigation est interceptée (app/@panel) et le panneau s'ouvre au-dessus de l'écran ; ouverte
// directement (nouvel onglet, rechargement), l'adresse renvoie à la page complète des réglages.
export const SETTINGS_PANELS = {
  evenements: "/events/parametres",
  modeles: "/events/modeles",
  "modeles-programme": "/events/modeles-programme",
  devis: "/devis/parametres",
  prestataires: "/prestataires/parametres",
} as const;

export type SettingsPanelKey = keyof typeof SETTINGS_PANELS;

// L'écran d'où l'on vient, pour « Retour à <écran> » (téléphone) : une clé, jamais un nom (aucune
// donnée personnelle dans l'adresse).
export const SETTINGS_BACK_KEYS = ["events", "event", "quotes", "payments", "tasks", "vendors"] as const;
export type SettingsBackKey = (typeof SETTINGS_BACK_KEYS)[number];

export function isSettingsPanelKey(value: string): value is SettingsPanelKey {
  return Object.hasOwn(SETTINGS_PANELS, value);
}

export function settingsPanelKeyOf(href: string): SettingsPanelKey | null {
  const found = (Object.entries(SETTINGS_PANELS) as [SettingsPanelKey, string][]).find(([, path]) => path === href);
  return found ? found[0] : null;
}

export function settingsPanelHref(href: string, back?: SettingsBackKey): string {
  const key = settingsPanelKeyOf(href);
  if (!key) return href;
  return back ? `/reglages/${key}?retour=${back}` : `/reglages/${key}`;
}

export function backKeyOf(value: string | undefined): SettingsBackKey | null {
  return value && (SETTINGS_BACK_KEYS as readonly string[]).includes(value) ? (value as SettingsBackKey) : null;
}
