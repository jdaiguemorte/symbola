// Lot 16 (PRE-14, ADR 0040) — familles et types de départ selon le métier de
// l'organisation (packages/starter-templates), posés par le module vendors.
// Orchestration entre modules par leurs service.ts (ADR 0011) : le métier
// vient du hub, les familles vivent dans vendors.
import type { StarterVendorCatalogInput } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { starterVendorCatalog, type StarterLocale, type StarterMetier } from "@symbola/starter-templates";
import { getOrganizationProfile } from "@/modules/hub/service";
import { listVendorTypes, seedStarterVendorCatalog } from "@/modules/vendors/service";

export function vendorCatalogInput(locale: StarterLocale, metier: StarterMetier): StarterVendorCatalogInput {
  return starterVendorCatalog(locale, metier).map((family) => ({
    key: family.key,
    label: family.label,
    color: family.color,
    icon: family.icon,
    types: family.types.map((type) => ({ key: type.key, label: type.label, synonyms: type.synonyms, fields: type.fields })),
  }));
}

export async function organizationMetier(organizationId: string): Promise<StarterMetier> {
  const db = appDatabase();
  return (await getOrganizationProfile(db, organizationId)).metier ?? "wedding_planner";
}

// Organisation antérieure au lot 16 : à la première visite du carnet ou de
// ses réglages, ses types sont rangés dans les familles de départ de son
// métier (une seule fois). Une organisation sans type les reçoit avec ses
// types de départ (assistant de démarrage, ou « Ajouter les types de départ »).
export async function ensureVendorFamilies(organizationId: string, locale: StarterLocale): Promise<void> {
  const types = await listVendorTypes(organizationId);
  if (types.length === 0 || types.every((type) => type.familyId !== null)) return;
  await seedStarterVendorCatalog(organizationId, vendorCatalogInput(locale, await organizationMetier(organizationId)), { withTypes: false });
}

// Demande explicite de la planner : familles et types de départ de son métier.
export async function addStarterVendorCatalog(organizationId: string, locale: StarterLocale): Promise<number> {
  const result = await seedStarterVendorCatalog(organizationId, vendorCatalogInput(locale, await organizationMetier(organizationId)), {
    withTypes: true,
    explicit: true,
  });
  return result.types;
}
