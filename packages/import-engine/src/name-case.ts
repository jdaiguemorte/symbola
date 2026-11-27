// Lot 71a (HUB-14, UX-02 ; spécification du lot 71, § 5.1) — un nom ou une ville que l'ancien outil
// exporte en capitales (« Léa MARTIN », « POITIERS ») retrouve la casse de l'app (« Léa Martin »,
// « Poitiers »). Seuls les mots écrits tout en capitales changent : ce qui est déjà en minuscules et
// capitales est gardé tel quel (« de La Tour », « McAllister »). « Garder les capitales » (réponse de
// l'étape « Questions ») annule la règle pour un import. Fonction pure.

// Particules écrites en minuscules devant un nom (« de La Tour », « van der Berg », « d'Artagnan »).
const PARTICLES = new Set(["de", "du", "des", "d", "van", "von", "der", "den", "da", "di", "del", "della", "dos"]);
// Petits mots au milieu d'un nom à traits d'union (« Aix-en-Provence », « Saint-Jean-de-Luz »).
const INNER_WORDS = new Set(["en", "sur", "sous", "lès", "les", "de", "du", "des", "la", "le", "aux", "au", "et"]);

const hasLetter = (word: string) => /\p{L}/u.test(word);
const isAllCaps = (word: string) => hasLetter(word) && word === word.toLocaleUpperCase("fr") && word !== word.toLocaleLowerCase("fr");

function capitalize(part: string): string {
  const lower = part.toLocaleLowerCase("fr");
  if (/^mc\p{L}{2,}/u.test(lower)) return `Mc${lower.charAt(2).toLocaleUpperCase("fr")}${lower.slice(3)}`;
  return lower.charAt(0).toLocaleUpperCase("fr") + lower.slice(1);
}

// Un mot tout en capitales : chaque partie (traits d'union, apostrophes) reprend sa casse.
function wordCase(word: string, isLastWord: boolean): string {
  // Initiale ou sigle d'une lettre (« J. », « J.-P. ») : gardé.
  if (/^(\p{Lu}\.-?)+$/u.test(word)) return word;
  const apostrophe = /^(\p{L}+)(['’])(.+)$/u.exec(word);
  if (apostrophe) {
    const [, before, mark, after] = apostrophe;
    const head = PARTICLES.has(before!.toLocaleLowerCase("fr")) ? before!.toLocaleLowerCase("fr") : capitalize(before!);
    return `${head}${mark}${wordCase(after!, isLastWord)}`;
  }
  const parts = word.split("-");
  if (parts.length === 1 && !isLastWord && PARTICLES.has(word.toLocaleLowerCase("fr"))) return word.toLocaleLowerCase("fr");
  return parts.map((part, index) => (index > 0 && index < parts.length - 1 && INNER_WORDS.has(part.toLocaleLowerCase("fr")) ? part.toLocaleLowerCase("fr") : capitalize(part))).join("-");
}

export function appNameCase(value: string): string {
  const tokens = value.split(/(\s+)/);
  const words = tokens.filter((token) => token.trim() !== "");
  const lastWord = words[words.length - 1];
  let seen = 0;
  return tokens
    .map((token) => {
      if (token.trim() === "") return token;
      seen += 1;
      return isAllCaps(token) ? wordCase(token, seen === words.length && token === lastWord) : token;
    })
    .join("");
}
