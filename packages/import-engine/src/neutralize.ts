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
