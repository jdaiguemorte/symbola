// Lot 16 (PRE-14, ADR 0040) — familles et types de départ (packages/starter-
// templates), posés par le module vendors. Lot 16 (ADR 0045) : un seul
// catalogue pour tous les métiers ; les types propres au mariage n'y sont que
// si l'organisation organise des mariages (un type d'événement « les mariés »).
// Orchestration entre modules par leurs service.ts (ADR 0011) : le métier
// vient du hub, les familles vivent dans vendors.
import type { StarterVendorCatalogInput } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { starterVendorCatalog, type StarterLocale, type StarterMetier } from "@symbola/starter-templates";
import { getOrganizationProfile } from "@/modules/hub/service";
import { listVendorTypes, seedStarterVendorCatalog } from "@/modules/vendors/service";
import { listEventTypes } from "@/modules/events/service";

export function vendorCatalogInput(locale: StarterLocale, options: { weddings?: boolean } = {}): StarterVendorCatalogInput {
  return starterVendorCatalog(locale, options).map((family) => ({
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
  // Rangement des types existants : tout le catalogue, mariage compris.
  await seedStarterVendorCatalog(organizationId, vendorCatalogInput(locale), { withTypes: false });
}

// Demande explicite de la planner : familles et types de départ de son métier.
export async function addStarterVendorCatalog(organizationId: string, locale: StarterLocale): Promise<number> {
  const result = await seedStarterVendorCatalog(organizationId, vendorCatalogInput(locale, { weddings: await organizesWeddings(organizationId) }), {
    withTypes: true,
    explicit: true,
  });
  return result.types;
}

// Lot 16 (ADR 0045) — l'organisation organise des mariages si l'un de ses types
// d'événement parle des mariés ; sans type encore, comme avant (oui).
export async function organizesWeddings(organizationId: string): Promise<boolean> {
  const types = await listEventTypes(organizationId);
  return types.length === 0 || types.some((type) => type.audience === "couple");
}
