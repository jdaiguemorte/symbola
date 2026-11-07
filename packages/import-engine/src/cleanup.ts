// Lot 14 — remise en état des valeurs exportées par un logiciel tiers :
// entités HTML laissées dans le texte, codes postaux enregistrés comme des
// nombres, plusieurs téléphones dans une même cellule, listes séparées par
// des virgules. Fonctions pures, testées sur le corpus fictif.

// Accents des entités nommées (« &eacute; » = e + accent aigu), recomposés en NFC.
const DIACRITICS: Record<string, string> = {
  grave: "̀",
  acute: "́",
  circ: "̂",
  tilde: "̃",
  uml: "̈",
  ring: "̊",
  cedil: "̧",
};

const NAMED: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  euro: "€",
  oelig: "œ",
  OElig: "Œ",
  aelig: "æ",
  AElig: "Æ",
  szlig: "ß",
  oslash: "ø",
  Oslash: "Ø",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  bull: "•",
  middot: "·",
  deg: "°",
  sup2: "²",
  sup3: "³",
  copy: "©",
  reg: "®",
  trade: "™",
};

function namedEntity(name: string): string | null {
  if (name in NAMED) return NAMED[name] as string;
  const match = /^([a-zA-Z])(grave|acute|circ|tilde|uml|ring|cedil)$/.exec(name);
  if (!match) return null;
  return `${match[1]}${DIACRITICS[match[2] as string]}`.normalize("NFC");
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z][a-zA-Z0-9]{1,8});/g, (entity, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return namedEntity(body) ?? entity;
  });
}

// Espaces multiples et insécables ramenés à un seul espace, sans espace en bord de ligne.
export function tidyText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/[  \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Code postal français sur 5 chiffres (« 5000 » enregistré comme nombre → « 05000 ») ;
// une valeur qui n'est pas un code postal est rendue telle quelle (étranger…).
export function normalizePostalCode(value: string): string {
  const text = value.trim().replace(/\.0+$/, "");
  if (/^\d{4}$/.test(text)) return `0${text}`;
  return text;
}

// Téléphones d'une cellule : « 0612345678 ( Julie),06 12 34 56 78 » → numéros
// formatés « 06 12 34 56 78 » (ou tels quels s'ils ne sont pas français), avec
// le prénom éventuel entre parenthèses.
export type PhoneEntry = { number: string; label: string | null };

export function splitPhones(value: string): PhoneEntry[] {
  const entries: PhoneEntry[] = [];
  for (const part of value.split(/[,;/]|\s{2,}|\n/)) {
    const text = part.trim();
    if (!text) continue;
    const label = /\(\s*([^)]+?)\s*\)/.exec(text)?.[1] ?? null;
    const raw = text.replace(/\([^)]*\)/g, "").trim();
    const digits = raw.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 8) continue;
    entries.push({ number: formatFrenchPhone(digits) ?? raw, label });
  }
  return entries;
}

function formatFrenchPhone(digits: string): string | null {
  let national = digits;
  if (national.startsWith("+33")) national = `0${national.slice(3)}`;
  else if (national.startsWith("0033")) national = `0${national.slice(4)}`;
  if (!/^0\d{9}$/.test(national)) return null;
  return national.replace(/(\d{2})(?=\d)/g, "$1 ");
}

// Liste « a,b , c » → ["a", "b", "c"], sans doublon ni élément vide.
export function splitList(value: string, separator = ","): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of value.split(separator)) {
    const item = part.trim();
    const key = item.toLocaleLowerCase("fr");
    if (!item || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

export function looksLikeUrl(value: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(value.trim());
}
