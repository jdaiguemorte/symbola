// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — « Choisir un prestataire… » propose d'abord le métier du
// poste : un type de prestataire va avec un poste du budget quand un mot de l'un commence comme un mot
// de l'autre (« Fleurs » et « Fleuriste », « Traiteur » et « Traiteur », « DJ » et « DJ »). Un
// rapprochement de mots, pas une liste : les postes et les types restent ceux de l'organisation.
const STEM = 5;

function words(label: string): string[] {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2);
}

function stem(word: string): string {
  return word.slice(0, STEM);
}

export function slotMatchesVendorType(slotLabel: string, typeLabel: string): boolean {
  const slotWords = words(slotLabel);
  const typeWords = words(typeLabel);
  return slotWords.some((slotWord) => typeWords.some((typeWord) => (slotWord.length < STEM || typeWord.length < STEM ? slotWord === typeWord : stem(slotWord) === stem(typeWord))));
}

export type RankedVendor = { id: string; name: string; matchesSlot: boolean; workedWith: boolean };

// Le métier du poste d'abord, puis les prestataires « Déjà travaillé ensemble », puis l'ordre alphabétique.
export function rankSlotVendors<T extends RankedVendor>(vendors: T[], locale: string): T[] {
  return [...vendors].sort((a, b) => Number(b.matchesSlot) - Number(a.matchesSlot) || Number(b.workedWith) - Number(a.workedWith) || a.name.localeCompare(b.name, locale));
}
