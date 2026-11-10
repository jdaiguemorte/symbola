// Lot 21 (PRE-18, PRE-19, ADR 0050) — étiquettes de départ (packages/starter-
// templates) dans la langue et selon le métier de l'organisation, posées et
// rangées par le module vendors. Orchestration entre modules par leurs
// service.ts (ADR 0011) : le métier vient du hub, les étiquettes vivent dans
// vendors.
import type { StarterVendorTagCatalogInput } from "@symbola/contracts";
import { starterVendorTags, type StarterLocale, type StarterMetier } from "@symbola/starter-templates";
import { organizationMetier } from "./catalog";

export function vendorTagCatalogInput(locale: StarterLocale, metier: StarterMetier): StarterVendorTagCatalogInput {
  return starterVendorTags(locale, metier).map((group) => ({ label: group.label, exclusive: group.exclusive, tags: group.tags }));
}

export async function organizationTagCatalog(organizationId: string, locale: StarterLocale): Promise<StarterVendorTagCatalogInput> {
  return vendorTagCatalogInput(locale, await organizationMetier(organizationId));
}
