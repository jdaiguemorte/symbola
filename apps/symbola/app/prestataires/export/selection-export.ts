// Lot 11 (L11-PRE-11) — lignes de l'export d'une sélection du carnet, pour le
// CSV (neutralisé contre les formules, @symbola/privacy) et le PDF.
import type { Vendor, VendorListItem, VendorTag, VendorType } from "@/modules/vendors/service";

export type ExportLabels = {
  name: string;
  type: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  distance: string;
  travel: (km: number, minutes: number) => string;
  tags: string;
};

export type ExportRow = { name: string; type: string; contact: string; phone: string; email: string; address: string; city: string; travel: string; tags: string };

export function exportRows(results: VendorListItem[], details: Vendor[], types: VendorType[], tags: VendorTag[], labels: ExportLabels): ExportRow[] {
  const byId = new Map(details.map((vendor) => [vendor.id, vendor]));
  const typeLabels = new Map(types.map((type) => [type.id, type.label]));
  const tagLabels = new Map(tags.map((tag) => [tag.id, tag.label]));
  return results.map((item) => {
    const vendor = byId.get(item.id);
    return {
      name: item.name,
      type: item.typeId ? (typeLabels.get(item.typeId) ?? "") : "",
      contact: vendor?.contactName ?? "",
      phone: vendor?.phone ?? "",
      email: vendor?.email ?? "",
      address: [vendor?.addressLine, item.postalCode].filter(Boolean).join(" "),
      city: item.city ?? "",
      travel: item.travel ? labels.travel(item.travel.distanceKm, item.travel.minutes) : "",
      tags: item.tagIds.map((id) => tagLabels.get(id)).filter(Boolean).join(", "),
    };
  });
}

export function exportTable(rows: ExportRow[], labels: ExportLabels): string[][] {
  return [
    [labels.name, labels.type, labels.contact, labels.phone, labels.email, labels.address, labels.city, labels.distance, labels.tags],
    ...rows.map((row) => [row.name, row.type, row.contact, row.phone, row.email, row.address, row.city, row.travel, row.tags]),
  ];
}
