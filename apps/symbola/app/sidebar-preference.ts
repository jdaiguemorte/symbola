// Lot 65f (recette staging du 22/11/2026) — menu latéral réduit à ses icônes, sur ordinateur.
// Le choix est une préférence d'affichage de l'appareil (aucune donnée personnelle), gardée dans un
// cookie : le cadre (app-shell.tsx, composant serveur) le lit pour rendre le menu dans le bon état dès
// la première image, sans clignotement ; le menu (app-sidebar.tsx, composant client) l'écrit. Fichier
// sans « use client » : les deux importent la même chaîne.
export const SIDEBAR_COLLAPSED_COOKIE = "symbola_menu_reduit";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

/** Le menu est réduit seulement si le cookie le dit ; toute autre valeur (absente, ancienne) l'ouvre. */
export function isSidebarCollapsed(value: string | undefined): boolean {
  return value === "1";
}

/** Le cookie à écrire depuis le navigateur pour retenir le choix un an. */
export function sidebarCollapsedCookie(collapsed: boolean): string {
  return `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`;
}
