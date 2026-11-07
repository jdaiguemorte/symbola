// Lot 15 (GEO-01) — placement sur la carte d'une série de fiches, après un
// import : adresses dédoublonnées (casse, accents et espaces près), point déjà
// connu dans le carnet de l'organisation réutilisé sans appel, le reste en un
// seul envoi au géocodeur. Un point placé à la main n'est jamais écrasé ; une
// adresse introuvable laisse la fiche sans point (« à placer »).
import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { configuredGeocoder, type GeoPoint, type GeocodeRequest } from "./geocoder";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

export type PlacementResult = { placed: number; unplaced: number; skipped: number };

type Located = { addressLine: string | null; postalCode: string | null; city: string | null; country: string };

// Clé d'adresse : sans casse, accents ni espaces superflus.
export function addressKey(vendor: Located): string | null {
  const parts = [vendor.addressLine, vendor.postalCode, vendor.city].filter((part): part is string => Boolean(part?.trim()));
  if (parts.length === 0) return null;
  const text = [...parts, vendor.country !== "FR" ? vendor.country : ""].join(" ");
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function requestOf(id: string, vendor: Located): GeocodeRequest {
  // Le code postal part en filtre ; sans lui, la ville reste dans le texte.
  const text = [vendor.addressLine, vendor.city, vendor.country !== "FR" ? vendor.country : null].filter(Boolean).join(" ");
  return { id, text, postalCode: vendor.postalCode && /^\d{5}$/.test(vendor.postalCode) ? vendor.postalCode : null };
}

export async function placeVendors(organizationId: string, vendorIds: string[]): Promise<PlacementResult> {
  const result: PlacementResult = { placed: 0, unplaced: 0, skipped: 0 };
  if (vendorIds.length === 0) return result;
  const targets = await inOrganization(organizationId, (tx) => tx.select().from(vendors).where(inArray(vendors.id, vendorIds)));
  // Fiche supprimée entre-temps : rien à faire. Point placé à la main : gardé.
  result.skipped += vendorIds.length - targets.length;
  const pending = targets.filter((vendor) => {
    if (vendor.locationSource === "manual") {
      result.skipped += 1;
      return false;
    }
    return true;
  });

  // Points déjà connus dans le carnet de l'organisation (jamais d'une autre : RLS).
  const known = new Map<string, GeoPoint>();
  const placed = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(vendors)
      .where(and(isNotNull(vendors.latitude), isNotNull(vendors.longitude))),
  );
  for (const vendor of placed) {
    if (vendorIds.includes(vendor.id)) continue;
    const key = addressKey(vendor);
    if (key && !known.has(key)) known.set(key, { latitude: vendor.latitude!, longitude: vendor.longitude! });
  }

  const byKey = new Map<string, typeof pending>();
  const points = new Map<string, GeoPoint | null>();
  for (const vendor of pending) {
    const key = addressKey(vendor);
    if (!key) {
      points.set(vendor.id, null);
      continue;
    }
    byKey.set(key, [...(byKey.get(key) ?? []), vendor]);
  }
  const requests: GeocodeRequest[] = [];
  for (const [key, group] of byKey) {
    const point = known.get(key);
    if (point) for (const vendor of group) points.set(vendor.id, point);
    else requests.push(requestOf(key, group[0]!));
  }
  const geocoder = configuredGeocoder();
  const found = requests.length > 0 && geocoder ? await geocoder.geocodeMany(requests) : new Map<string, GeoPoint | null>();
  for (const request of requests) for (const vendor of byKey.get(request.id) ?? []) points.set(vendor.id, found.get(request.id) ?? null);

  await inOrganization(organizationId, async (tx) => {
    for (const vendor of pending) {
      const point = points.get(vendor.id) ?? null;
      if (point) result.placed += 1;
      else result.unplaced += 1;
      // Une correction à la main faite pendant le traitement n'est pas écrasée.
      await tx
        .update(vendors)
        .set(point ? { latitude: point.latitude, longitude: point.longitude, locationSource: "geocoded" } : { latitude: null, longitude: null, locationSource: null })
        .where(and(eq(vendors.id, vendor.id), or(isNull(vendors.locationSource), ne(vendors.locationSource, "manual"))));
    }
  });
  return result;
}
