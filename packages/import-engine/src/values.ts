// IMP-02 — reconnaissance des valeurs : dates et montants au format français
// (31/12/2026, 31.12.2026, 1 234,56 €) comme anglais ou ISO (2026-12-31,
// 12,000.00), booléens et pourcentages. Fonctions pures, sans fuseau : une
// date importée est une date sans heure (CLAUDE.md §5).

// Ordre jour/mois d'une colonne de dates à barres ou points : `dmy` (français,
// par défaut) ou `mdy` (anglais américain), déduit de la colonne entière.
export type DateOrder = "dmy" | "mdy";

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/;
const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

function isValidDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function iso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fullYear(raw: string): number {
  const year = Number(raw);
  // Années à deux chiffres : 00-69 → 2000-2069, 70-99 → 1970-1999.
  if (raw.length === 2) return year < 70 ? 2000 + year : 1900 + year;
  return year;
}

// « AAAA-MM-JJ », ou null si la valeur n'est pas une date valide.
export function parseDate(value: string, order: DateOrder = "dmy"): string | null {
  const text = value.trim();
  const isoMatch = ISO_DATE.exec(text);
  if (isoMatch) {
    const [year, month, day] = [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])];
    return isValidDay(year, month, day) ? iso(year, month, day) : null;
  }
  const match = SLASH_DATE.exec(text);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = fullYear(match[3] as string);
  const [day, month] = order === "dmy" ? [first, second] : [second, first];
  return isValidDay(year, month, day) ? iso(year, month, day) : null;
}

// Ordre jour/mois d'une colonne : une valeur dont le premier nombre dépasse
// 12 tranche pour `dmy`, le second pour `mdy` ; la majorité l'emporte, le
// français à égalité (une date ambiguë suit le format majoritaire).
export function detectDateOrder(values: string[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const value of values) {
    const match = SLASH_DATE.exec(value.trim());
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second <= 12) dmy += 1;
    else if (second > 12 && first <= 12) mdy += 1;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

// Séparateur décimal d'une colonne de montants : `comma` (français) ou `dot`.
export type DecimalStyle = "comma" | "dot";

const AMOUNT_TEXT = /^[+-]?\s?(?:€\s?)?[\d\s  .,']+\s?(?:€|eur|euros?)?$/i;

function amountParts(value: string): { negative: boolean; digits: string } | null {
  let text = value.trim().replace(/^'/, "");
  // Parenthèses comptables : (12,50) = -12,50.
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  if (!AMOUNT_TEXT.test(text) || !/\d/.test(text)) return null;
  if (text.startsWith("-")) negative = !negative;
  const digits = text.replace(/[+\-€\s  ']|eur(?:os?)?/gi, "");
  return { negative, digits };
}

// Style décimal le plus probable d'une colonne. Le dernier séparateur d'une
// valeur qui porte les deux (« 1.234,56 », « 1,234.56 ») tranche ; sinon un
// séparateur suivi de 1 ou 2 chiffres est décimal ; à défaut, le français.
export function detectDecimalStyle(values: string[]): DecimalStyle {
  let comma = 0;
  let dot = 0;
  for (const value of values) {
    const parts = amountParts(value);
    if (!parts) continue;
    const lastComma = parts.digits.lastIndexOf(",");
    const lastDot = parts.digits.lastIndexOf(".");
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) comma += 1;
      else dot += 1;
      continue;
    }
    const decimals = (separatorIndex: number) => parts.digits.length - separatorIndex - 1;
    if (lastComma !== -1 && decimals(lastComma) <= 2) comma += 1;
    else if (lastDot !== -1 && decimals(lastDot) <= 2) dot += 1;
  }
  return dot > comma ? "dot" : "comma";
}

// Montant en centimes entiers (jamais de flottant pour l'argent), ou null.
export function parseAmountCents(value: string, style: DecimalStyle = "comma"): number | null {
  const parts = amountParts(value);
  if (!parts) return null;
  const decimalSeparator = style === "comma" ? "," : ".";
  const thousandsSeparator = style === "comma" ? "." : ",";
  let digits = parts.digits;

  // Un séparateur de milliers sépare des groupes de 3 chiffres.
  if (digits.includes(thousandsSeparator)) {
    const integerPart = digits.split(decimalSeparator)[0] as string;
    const groups = integerPart.split(thousandsSeparator);
    if (groups.slice(1).some((group) => group.length !== 3) || (groups[0] as string).length === 0) {
      // « 12.5 » dans une colonne à virgule décimale : séparateur décimal isolé.
      if (!digits.includes(decimalSeparator) && groups.length === 2) {
        digits = digits.replace(thousandsSeparator, decimalSeparator);
      } else {
        return null;
      }
    } else {
      digits = digits.split(thousandsSeparator).join("");
    }
  }

  const [integer, fraction = "", ...rest] = digits.split(decimalSeparator);
  if (rest.length > 0 || !/^\d*$/.test(integer ?? "") || !/^\d*$/.test(fraction) || fraction.length > 2) return null;
  if ((integer ?? "") === "" && fraction === "") return null;
  const cents = Number(integer || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return parts.negative ? -cents : cents;
}

// Pourcentage en points de base (2000 = 20 %) : « 20 », « 20 % », « 5,5 »,
// « 0,2 » n'est pas réinterprété (un taux de 0,2 % reste 0,2 %).
export function parsePercentageBasisPoints(value: string): number | null {
  const text = value.trim().replace(/\s?%$/, "").replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return null;
  const basisPoints = Math.round(Number(text) * 100);
  return basisPoints <= 10_000 ? basisPoints : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s.()-]{8,20}$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function looksLikePhone(value: string): boolean {
  const text = value.trim().replace(/^'/, "");
  return PHONE.test(text) && (text.match(/\d/g) ?? []).length >= 8;
}
