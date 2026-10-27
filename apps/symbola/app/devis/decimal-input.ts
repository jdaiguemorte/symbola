// DEV-01 — lecture des montants, quantités et pourcentages saisis dans les
// formulaires (« 1 234,56 », « 12.5 ») en entiers à l'échelle voulue, sans
// jamais passer par un nombre à virgule flottante (CLAUDE.md §5 Données).
const DECIMAL_PATTERN = /^(\d+)(?:[.,](\d+))?$/;

// scale = nombre de décimales conservées : 2 pour les centimes et les points
// de base, 3 pour les quantités en millièmes. Au-delà : refus (null), pas
// d'arrondi silencieux.
export function parseDecimal(input: string, scale: number): number | null {
  const compact = input.replace(/[\s  ]/g, "");
  const match = DECIMAL_PATTERN.exec(compact);
  if (!match) return null;
  const [, whole = "", fraction = ""] = match;
  if (fraction.length > scale) return null;
  const value = Number(whole + fraction.padEnd(scale, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

// Pour pré-remplir un champ : 150000 (scale 2) → « 1500,00 » en français.
export function formatDecimal(value: number, scale: number, locale: "fr" | "en"): string {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(value)).padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, "");
  if (fraction === "") return `${sign}${whole}`;
  return `${sign}${whole}${locale === "fr" ? "," : "."}${fraction}`;
}
