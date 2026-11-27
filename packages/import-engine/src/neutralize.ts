// Neutralisation des cellules qui pourraient être interprétées comme une
// formule par un tableur (injection CSV, CLAUDE.md §5) : =, +, - ou @ en tête,
// y compris après des espaces ou des caractères de contrôle (tabulation,
// retour chariot), qu'Excel ignore avant d'évaluer.
//
// Exception : une cellule qui n'est qu'un nombre signé (« -12,50 »,
// « +33 6 12 34 56 78 ») ne peut pas être une formule et reste intacte, pour
// que les montants négatifs et les téléphones internationaux restent lisibles.

const LEADING_IGNORED = /^[\s\u0000-\u001f]*/;
const TRIGGERS = new Set(["=", "+", "-", "@"]);
const SIGNED_NUMBER = /^[+-][\d\s  .,]*\d[\d\s  .,]*\s?€?$/;

export function needsNeutralization(value: string): boolean {
  const rest = value.replace(LEADING_IGNORED, "");
  const first = rest.charAt(0);
  if (!TRIGGERS.has(first)) return false;
  return !SIGNED_NUMBER.test(rest);
}

export function neutralizeCell(value: string): { value: string; neutralized: boolean } {
  if (!needsNeutralization(value)) return { value, neutralized: false };
  return { value: `'${value}`, neutralized: true };
}

// Lot 71a (SEC-21) : un objet lu d'un PDF (programme, prestataires retenus) dont chaque texte passe
// par neutralizeCell avant d'être gardé, comme les cellules d'un tableur. Les autres valeurs
// (nombres, booléens, null) restent telles quelles ; le nombre de textes neutralisés est rendu.
// `keep` : clés dont la valeur n'est jamais gardée telle quelle (un identifiant Instagram « @… »,
// validé puis réécrit en adresse par l'appelant).
export function neutralizeTexts<T>(value: T, keep: ReadonlySet<string> = new Set()): { value: T; neutralized: number } {
  let neutralized = 0;
  const walk = (item: unknown): unknown => {
    if (typeof item === "string") {
      const cell = neutralizeCell(item);
      if (cell.neutralized) neutralized += 1;
      return cell.value;
    }
    if (Array.isArray(item)) return item.map(walk);
    if (item !== null && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, keep.has(key) ? entry : walk(entry)]));
    return item;
  };
  return { value: walk(value) as T, neutralized };
}
