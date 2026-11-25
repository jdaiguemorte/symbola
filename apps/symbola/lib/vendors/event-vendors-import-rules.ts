// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — reprendre d'un PDF les prestataires
// retenus d'un évènement : règles pures de l'aperçu. Pour chaque ligne du fichier, la fiche du carnet
// qui lui ressemble (sinon une fiche sera créée), le métier du carnet, et la ligne du budget de son
// métier (sinon une ligne sera créée). La planner corrige chaque proposition avant d'écrire.
import { textSimilarity, type EventVendorsExport, type EventVendorsExportRow } from "@symbola/import-engine";
import type { VendorInput } from "@symbola/contracts";

// Même seuil que le rapprochement des intervenants d'un programme importé.
const SAME_NAME = 0.85;

export type ImportSlotOption = { id: string; label: string; vendorNames: string[] };
export type ImportCarnetVendor = { id: string; name: string; city: string | null };
export type ImportVendorType = { id: string; label: string };

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function sameGroup(a: string, b: string, synonymGroups: readonly (readonly string[])[]): boolean {
  return synonymGroups.some((group) => group.some((entry) => fold(entry) === fold(a)) && group.some((entry) => fold(entry) === fold(b)));
}

// « Lieu » et « Lieu de réception » : l'un commence par l'autre, mot entier. Un simple mot commun ne
// suffit pas (« Photobooth » n'est pas « Photographe »).
const startsWith = (longer: string, shorter: string) => fold(longer).startsWith(`${fold(shorter)} `);

// La ligne du budget d'un prestataire : celle où il est déjà, sinon celle de son métier (même
// libellé, synonyme du métier, puis libellé qui commence par l'autre) ; aucune quand plusieurs
// conviennent autant.
export function proposeImportSlot(row: Pick<EventVendorsExportRow, "type" | "name">, slots: readonly ImportSlotOption[], synonymGroups: readonly (readonly string[])[] = []): string | null {
  const byName = slots.filter((slot) => slot.vendorNames.some((vendor) => textSimilarity(vendor, row.name) >= SAME_NAME));
  if (byName.length === 1) return byName[0]!.id;
  for (const rule of [
    (slot: ImportSlotOption) => fold(slot.label) === fold(row.type),
    (slot: ImportSlotOption) => sameGroup(slot.label, row.type, synonymGroups),
    (slot: ImportSlotOption) => startsWith(slot.label, row.type) || startsWith(row.type, slot.label),
  ]) {
    const found = slots.filter(rule);
    if (found.length === 1) return found[0]!.id;
    if (found.length > 1) return null;
  }
  return null;
}

// La fiche du carnet au nom le plus proche ; aucune sous le seuil, ni quand deux fiches se valent.
export function matchCarnetVendor(row: Pick<EventVendorsExportRow, "name">, vendors: readonly ImportCarnetVendor[]): ImportCarnetVendor | null {
  const scored = vendors.map((vendor) => ({ vendor, score: textSimilarity(vendor.name, row.name) })).filter((entry) => entry.score >= SAME_NAME).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0]!.score === scored[1]!.score) return null;
  return scored[0]!.vendor;
}

// Le métier du carnet pour une fiche à créer : même libellé, ou synonyme ; sinon aucun (« à classer »).
export function matchImportVendorType(type: string, types: readonly ImportVendorType[], synonymGroups: readonly (readonly string[])[] = []): string | null {
  return (types.find((entry) => fold(entry.label) === fold(type)) ?? types.find((entry) => sameGroup(entry.label, type, synonymGroups)))?.id ?? null;
}

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

// La fiche créée pour une ligne du fichier : nom, métier, contact, e-mail, téléphone, Instagram.
export function importedVendorInput(row: EventVendorsExportRow, typeId: string | null): VendorInput {
  const handle = row.instagram?.replace(/^@/, "").trim() ?? "";
  const phone = row.phone?.replace(/[.\s]+$/, "").trim() || null;
  return {
    name: row.name,
    ...(typeId ? { typeIds: [typeId], primaryTypeId: typeId } : {}),
    contactName: row.contact,
    email: row.email,
    phone,
    ...(INSTAGRAM_HANDLE.test(handle) ? { socialLinks: [{ network: "instagram" as const, url: `https://www.instagram.com/${handle}/` }] } : {}),
  };
}

// L'en-tête du fichier désigne-t-il cet évènement ? Sa date d'abord ; sans date d'un côté ou de
// l'autre, on ne sait pas (rien n'est demandé).
export function importHeaderCheck(header: Pick<EventVendorsExport, "eventDate">, event: { eventDate: string | null }): "same" | "different" | "unknown" {
  if (!header.eventDate || !event.eventDate) return "unknown";
  return header.eventDate === event.eventDate ? "same" : "different";
}

export type EventVendorsImportChoice = { skip: boolean; vendor: "new" | string; slot: "new" | string };

// Le choix par défaut d'une ligne, et celui de la planner quand il est valide.
export function resolveImportChoice(
  proposal: { planner: boolean; vendorId: string | null; slotId: string | null },
  chosen: Partial<EventVendorsImportChoice> | undefined,
  valid: { vendorIds: ReadonlySet<string>; slotIds: ReadonlySet<string> },
): EventVendorsImportChoice {
  const vendor = chosen?.vendor === "new" ? "new" : chosen?.vendor && valid.vendorIds.has(chosen.vendor) ? chosen.vendor : (proposal.vendorId ?? "new");
  const slot = chosen?.slot === "new" ? "new" : chosen?.slot && valid.slotIds.has(chosen.slot) ? chosen.slot : (proposal.slotId ?? "new");
  // La ligne de la planner elle-même n'est jamais reprise.
  return { skip: proposal.planner || chosen?.skip === true, vendor, slot };
}
