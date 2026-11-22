// Lot 63f (HUB-11, HUB-10 ; ADR 0104) — écran d'où un tutoriel a été lancé, gardé dans son
// contexte (« origin ») pour y revenir à la fin ou quand on le quitte. Une adresse relative de
// l'app seulement : jamais un autre site (redirection ouverte), jamais la page du tutoriel.
export const TUTORIAL_DONE_PARAM = "tutoriel-termine";
// Lot 63a : une partie de l'exemple a été gardée (modèle, prestation).
export const TUTORIAL_KEPT_PARAM = "tutoriel-garde";

export function safeOrigin(value: string | null | undefined): string | null {
  if (!value || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\s\\]/.test(value)) return null;
  if (value === "/aide/tutoriels" || value.startsWith("/aide/tutoriels/")) return null;
  return value;
}

export function originFromReferer(referer: string | null, host: string | null): string | null {
  if (!referer || !host) return null;
  try {
    const url = new URL(referer);
    if (url.host !== host) return null;
    return safeOrigin(`${url.pathname}${url.search}`);
  } catch {
    return null;
  }
}

export function withTutorialDone(origin: string, key: string, kept = false): string {
  const [path, query = ""] = origin.split("?", 2) as [string, string?];
  const params = new URLSearchParams(query);
  params.set(TUTORIAL_DONE_PARAM, key);
  if (kept) params.set(TUTORIAL_KEPT_PARAM, "1");
  else params.delete(TUTORIAL_KEPT_PARAM);
  return `${path}?${params.toString()}`;
}
