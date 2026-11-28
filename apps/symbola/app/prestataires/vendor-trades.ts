// Lot 63e (PRE-01, PRE-11 ; ADR 0105, maquettes M4 et M11) — règles pures de la fiche à plusieurs
// métiers : les étiquettes proposées selon les métiers cochés (celles de la famille de chaque métier
// s'ajoutent, puis celles « pour tous »). Sans métier, toutes les étiquettes. Lot 73d : les rubriques de
// l'ancien formulaire ont disparu (une seule fenêtre, « Plus de détails »).
import type { VendorFamily, VendorTag, VendorType } from "@/modules/vendors/service";

export type TagSection = { key: string; kind: "family" | "common" | "any"; label: string; tags: VendorTag[] };

export function tagSectionsFor(types: VendorType[], families: VendorFamily[], tags: VendorTag[]): TagSection[] {
  if (types.length === 0) return tags.length > 0 ? [{ key: "any", kind: "any", label: "", tags }] : [];
  const shown = new Set<string>();
  const sections: TagSection[] = [];
  const familyIds = [...new Set(types.flatMap((type) => (type.familyId && families.some((family) => family.id === type.familyId) ? [type.familyId] : [])))];
  for (const familyId of familyIds) {
    const own = tags.filter((tag) => tag.familyIds.includes(familyId) && !shown.has(tag.id));
    for (const tag of own) shown.add(tag.id);
    if (own.length === 0) continue;
    const label = types.filter((type) => type.familyId === familyId).map((type) => type.label).join(", ");
    sections.push({ key: familyId, kind: "family", label, tags: own });
  }
  const common = tags.filter((tag) => tag.familyIds.length === 0);
  if (common.length > 0) sections.push({ key: "common", kind: "common", label: "", tags: common });
  return sections;
}
