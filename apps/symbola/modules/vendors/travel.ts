// L11-PRE-06 / L11-PRE-07 (lot 11, ADR 0031 § 4-5) — distance et trajet estimé.
// La base trie et filtre par distance (même formule, en SQL) ; ces
// fonctions pures servent au calcul du trajet affiché et aux tests.
import type { TravelEstimate, VendorSettings } from "@symbola/contracts";

export const EARTH_RADIUS_KM = 6371;

// Distance à vol d'oiseau (formule de haversine), en kilomètres.
export function haversineKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Distance × coefficient de détour ÷ vitesse moyenne ; arrondis : 0,1 km et
// la minute supérieure (une estimation ne promet jamais moins que la route).
export function estimateTravel(crowFliesKm: number, settings: VendorSettings): TravelEstimate {
  const roadKm = (crowFliesKm * settings.detourFactorPermille) / 1000;
  return {
    distanceKm: Math.round(roadKm * 10) / 10,
    minutes: Math.max(1, Math.ceil((roadKm / settings.averageSpeedKmh) * 60)),
  };
}

export const DEFAULT_VENDOR_SETTINGS: VendorSettings = { detourFactorPermille: 1300, averageSpeedKmh: 60 };

export function validateVendorSettings(settings: VendorSettings): VendorSettings {
  const { detourFactorPermille, averageSpeedKmh } = settings;
  if (!Number.isInteger(detourFactorPermille) || detourFactorPermille < 1000 || detourFactorPermille > 3000) {
    throw new RangeError("le coefficient de détour doit être compris entre 1 et 3");
  }
  if (!Number.isInteger(averageSpeedKmh) || averageSpeedKmh < 5 || averageSpeedKmh > 130) {
    throw new RangeError("la vitesse moyenne doit être comprise entre 5 et 130 km/h");
  }
  return { detourFactorPermille, averageSpeedKmh };
}
