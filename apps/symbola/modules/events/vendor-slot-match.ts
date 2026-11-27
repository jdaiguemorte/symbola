// Lot 73a (PRE-02, BUD-01 ; spécification du lot 73, § 4.2 ; décision P7 de Julien du 27/11/2026) — la
// correspondance calculée entre un poste du budget et un métier ou une famille du carnet, sans donnée
// nouvelle ni réglage. Dans l'ordre : le même libellé qu'un métier ; un synonyme des modèles de départ
// (vendor-type-synonyms.json) ; le même libellé qu'une famille ; puis la ressemblance des mots (un mot de
// l'un commence comme un mot de l'autre : « Fleurs » et « Fleuriste », règle du lot 63c). Elle sert dans
// les deux sens : le poste proposé d'après le métier d'une fiche (« Ajouter à un mariage… »), et le métier
// d'après le poste (création depuis un poste, carnet ouvert depuis un poste). Fonction pure : le catalogue
// du carnet est donné par l'appelant (module Prestataires).

export type SlotMatchCatalog = {
  types: { id: string; label: string; starterKey: string | null; familyId: string | null }[];
  families: { id: string; label: string }[];
  synonyms: { key: string; fr: string[]; en: string[] }[];
};
export type SlotVendorMatch = { kind: "type"; typeId: string } | { kind: "family"; familyId: string };

const STEM = 5;

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(text: string): string[] {
  return fold(text)
    .split(" ")
    .filter((word) => word.length >= 2);
}

function resembles(slotLabel: string, typeLabel: string): boolean {
  const slotWords = words(slotLabel);
  const typeWords = words(typeLabel);
  return slotWords.some((slotWord) => typeWords.some((typeWord) => (slotWord.length < STEM || typeWord.length < STEM ? slotWord === typeWord : slotWord.slice(0, STEM) === typeWord.slice(0, STEM))));
}

export function matchSlotToVendorType(slotLabel: string, catalog: SlotMatchCatalog): SlotVendorMatch | null {
  const label = fold(slotLabel);
  if (!label) return null;
  const sameType = catalog.types.find((type) => fold(type.label) === label);
  if (sameType) return { kind: "type", typeId: sameType.id };
  const synonymKeys = catalog.synonyms.filter((item) => [...item.fr, ...item.en].some((synonym) => fold(synonym) === label)).map((item) => item.key);
  const bySynonym = catalog.types.find((type) => type.starterKey !== null && synonymKeys.includes(type.starterKey));
  if (bySynonym) return { kind: "type", typeId: bySynonym.id };
  const sameFamily = catalog.families.find((family) => fold(family.label) === label);
  if (sameFamily) return { kind: "family", familyId: sameFamily.id };
  const similar = catalog.types.find((type) => resembles(slotLabel, type.label));
  return similar ? { kind: "type", typeId: similar.id } : null;
}

// Le poste d'un évènement proposé pour une fiche d'après son métier principal : celui du métier d'abord,
// puis celui de sa famille ; rien quand aucun poste ne lui correspond (la fenêtre offre « Nouveau poste »).
export function proposeSlotForVendorType<T extends { id: string; label: string }>(slots: T[], typeId: string | null, catalog: SlotMatchCatalog): string | null {
  if (!typeId) return null;
  const type = catalog.types.find((entry) => entry.id === typeId);
  if (!type) return null;
  const matches = slots.map((slot) => ({ slot, match: matchSlotToVendorType(slot.label, catalog) }));
  const ofType = matches.find((entry) => entry.match?.kind === "type" && entry.match.typeId === typeId);
  if (ofType) return ofType.slot.id;
  const ofFamily = type.familyId ? matches.find((entry) => entry.match?.kind === "family" && entry.match.familyId === type.familyId) : undefined;
  return ofFamily?.slot.id ?? null;
}

// Le métier proposé d'après le poste (création d'une fiche depuis un poste) ; rien pour une famille.
export function proposeVendorTypeForSlot(slotLabel: string, catalog: SlotMatchCatalog): string | null {
  const match = matchSlotToVendorType(slotLabel, catalog);
  return match?.kind === "type" ? match.typeId : null;
}
