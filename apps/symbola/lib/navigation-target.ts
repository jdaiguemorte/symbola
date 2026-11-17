// Lot 39c (UX-15) — l'écran visé par un clic sur un lien, pour afficher son squelette pendant le
// chargement. Seul un lien interne vers un autre écran compte : pas un lien qui s'ouvre ailleurs
// (nouvel onglet, téléchargement, autre site, touche de modification), ni un lien qui reste sur
// l'écran courant (ancre, filtre, onglet de fiche), ni un fichier servi par l'API.

export type LinkClick = {
  href: string;
  button: number;
  modified: boolean;
  target: string;
  download: boolean;
};

/** Le chemin de l'écran visé, ou null si le clic ne change pas d'écran dans l'app. */
export function navigationTarget(click: LinkClick, current: string): string | null {
  if (click.button !== 0 || click.modified || click.download) return null;
  if (click.target !== "" && click.target !== "_self") return null;
  let url: URL;
  let here: URL;
  try {
    here = new URL(current);
    url = new URL(click.href, here);
  } catch {
    return null;
  }
  if (url.origin !== here.origin) return null;
  if (url.pathname === here.pathname) return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return null;
  return url.pathname;
}
