// Lot 62b (UX-13, décision D2) — le menu des Paramètres : la rubrique ouverte, et le filtre « Chercher
// un réglage ». Le filtre compare les noms sans tenir compte des accents ni de la casse
// (« evenement » trouve « Types d'événements » et « Modèles d'évènement ») ; chaque mot tapé doit se
// trouver dans le nom de la rubrique.

type Item = { href: string; label: string; paths?: string[] };
type Group<I extends Item> = { label: string; items: I[] };

export function plainText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .trim();
}

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

// L'adresse la plus précise gagne (/events/parametres/sources avant /events/parametres). Lot 74g : une
// rubrique sert aussi ses sous-écrans rangés ailleurs (« Tous les modules », /apps, sous l'abonnement).
export function activeSettingsItem<I extends Item>(groups: { items: I[] }[], pathname: string): I | undefined {
  const depth = (item: I) => Math.max(...[item.href, ...(item.paths ?? [])].filter((path) => under(pathname, path)).map((path) => path.length));
  return groups
    .flatMap((group) => group.items)
    .filter((item) => [item.href, ...(item.paths ?? [])].some((path) => under(pathname, path)))
    .sort((a, b) => depth(b) - depth(a))[0];
}

// Les groupes qui gardent au moins une rubrique, avec leurs seules rubriques trouvées ; une recherche
// vide rend tout.
export function filterSettingsGroups<I extends Item, G extends Group<I>>(groups: G[], query: string): G[] {
  const words = plainText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => words.every((word) => plainText(item.label).includes(word))) }) as G)
    .filter((group) => group.items.length > 0);
}
