// Lot 73d (PRE-01 ; spécification du lot 73, § 5.4, critère 2) — la lecture du formulaire d'une fiche, la
// même pour la fenêtre unique de création (un seul métier choisi, typeIdsOverride) et pour sa modification
// (les métiers cochés). Déplacée des actions du carnet (lot 63e) : un fichier « use server » n'exporte
// que des actions.
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import { listVendorTypes, parseFieldInput, type VendorFieldValue, type VendorInput } from "@/modules/vendors/service";
import { isValidId } from "@/app/events/module-access";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function readVendorInput(organizationId: string, formData: FormData, typeIdsOverride?: string[]): Promise<VendorInput> {
  // Lot 63e (PRE-01 ; ADR 0105) : les métiers cochés et le principal ; les champs de chacun.
  const typeIds = typeIdsOverride ?? [...new Set(formData.getAll("typeIds").map(String).filter(isValidId))];
  const primaryTypeId = isValidId(text(formData, "primaryTypeId")) && typeIds.includes(text(formData, "primaryTypeId")) ? text(formData, "primaryTypeId") : (typeIds[0] ?? null);
  const types = typeIds.length > 0 ? (await listVendorTypes(organizationId)).filter((candidate) => typeIds.includes(candidate.id)) : [];
  const fieldValues: Record<string, VendorFieldValue> = {};
  for (const field of types.flatMap((type) => type.fields)) {
    const raw = field.kind === "boolean" ? (formData.get(`field_${field.id}`) === "on" ? "true" : "") : text(formData, `field_${field.id}`);
    const value = parseFieldInput(field.kind, raw);
    if (value !== null) fieldValues[field.id] = value;
  }
  return {
    name: text(formData, "name"),
    typeIds,
    primaryTypeId,
    contactName: text(formData, "contactName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    addressLine: text(formData, "addressLine"),
    postalCode: text(formData, "postalCode"),
    city: text(formData, "city"),
    country: text(formData, "country") || "FR",
    internalNote: text(formData, "internalNote"),
    // Lot 28c (PRE-01) : évaluation de 1 à 5 ; vide = aucune.
    rating: /^[1-5]$/.test(text(formData, "rating")) ? Number(text(formData, "rating")) : null,
    indicativePrices: text(formData, "indicativePrices"),
    website: text(formData, "website"),
    socialLinks: VENDOR_SOCIAL_NETWORKS.map((network) => ({ network, url: text(formData, `social_${network}`) })).filter((link) => link.url !== ""),
    siret: text(formData, "siret"),
    fieldValues,
    // Lot 20 (décision 5) : pastilles cochées, plus le palier choisi de chaque groupe « palier ».
    tagIds: [
      ...formData.getAll("tagIds").map(String),
      ...[...formData.entries()].filter(([key]) => key.startsWith("tagTier-")).map(([, value]) => String(value)),
    ].filter(isValidId),
  };
}
