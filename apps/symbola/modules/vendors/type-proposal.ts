// Lot 73a (PRE-01, HUB-14 ; spécification du lot 73, § 4.2 ; D9, V6, P13) — un métier proposé d'après le
// nom d'une fiche « à classer », que la planner valide sur l'écran « Classer ». Les mots du nom comparés
// aux libellés des métiers de l'organisation et aux synonymes des modèles de départ (vendor-type-
// synonyms.json, traduisible) : mots entiers, sans accents ni casse, pluriel en « s » ou « x » compris.
// Le synonyme le plus long l'emporte. Fonction pure : rien n'est jamais enregistré ici.

export type ProposalType = { id: string; label: string; starterKey: string | null };
export type ProposalSynonyms = { key: string; fr: string[]; en: string[] }[];
export type VendorTypeProposal = { typeId: string; word: string };

type Token = { folded: string; start: number; end: number };

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Un mot au singulier : « calèches » → « caleche », « châteaux » → « chateau ».
function singular(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

function tokens(text: string): Token[] {
  const folded = fold(text);
  const found: Token[] = [];
  for (const match of folded.matchAll(/[a-z0-9]+/g)) found.push({ folded: singular(match[0]), start: match.index, end: match.index + match[0].length });
  return found;
}

export function proposeVendorTypeFromName(name: string, types: ProposalType[], synonyms: ProposalSynonyms): VendorTypeProposal | null {
  const nameTokens = tokens(name);
  if (nameTokens.length === 0) return null;
  const synonymsByKey = new Map(synonyms.map((item) => [item.key, [...item.fr, ...item.en]]));
  let best: { typeId: string; start: number; end: number; length: number; order: number } | null = null;
  types.forEach((type, order) => {
    const phrases = [type.label, ...(type.starterKey ? (synonymsByKey.get(type.starterKey) ?? []) : [])];
    for (const phrase of phrases) {
      const words = tokens(phrase).map((token) => token.folded);
      if (words.length === 0) continue;
      for (let index = 0; index + words.length <= nameTokens.length; index += 1) {
        if (!words.every((word, offset) => nameTokens[index + offset]!.folded === word)) continue;
        const start = nameTokens[index]!.start;
        const end = nameTokens[index + words.length - 1]!.end;
        const length = end - start;
        if (!best || length > best.length || (length === best.length && order < best.order)) best = { typeId: type.id, start, end, length, order };
      }
    }
  });
  if (!best) return null;
  const found: { typeId: string; start: number; end: number } = best;
  // Le mot tel qu'il est écrit dans le nom (« Proposé d'après « Traiteur » dans le nom »).
  const original = sliceOriginal(name, found.start, found.end);
  return { typeId: found.typeId, word: original };
}

// Retrouve, dans le nom tel qu'il est écrit, les caractères qui vont de start à end du nom replié.
function sliceOriginal(name: string, start: number, end: number): string {
  let foldedIndex = 0;
  let from = -1;
  let to = name.length;
  for (let index = 0; index < name.length; index += 1) {
    if (foldedIndex === start && from < 0) from = index;
    foldedIndex += fold(name[index]!).length;
    if (foldedIndex === end) {
      to = index + 1;
      break;
    }
  }
  return name.slice(Math.max(from, 0), to);
}
