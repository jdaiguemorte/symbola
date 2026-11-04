// PRE-03 (lot 11, ADR 0031 § 6) — adresse → point, derrière une interface.
// « ign » : API Géocodage de la Géoplateforme (gratuite, sans clé). Seule
// l'adresse est envoyée, jamais le nom du prestataire ni son contact.
// « fake » : points simulés et reproductibles (tests, développement hors
// ligne ; interdit en production par @symbola/env).
import { createHash } from "node:crypto";
import { z } from "zod";
import { geocoderOf, parseEnv } from "@symbola/env";

export type GeoPoint = { latitude: number; longitude: number };
export type Geocoder = { geocode(address: string): Promise<GeoPoint | null> };

const IGN_URL = "https://data.geopf.fr/geocodage/search";
// En dessous, l'IGN a deviné plus qu'il n'a trouvé : on ne place rien.
const MIN_SCORE = 0.5;

const ignResponseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({ score: z.number().optional() }).passthrough(),
    }),
  ),
});

export function ignGeocoder(fetchImpl: typeof fetch = fetch): Geocoder {
  return {
    async geocode(address) {
      const url = `${IGN_URL}?${new URLSearchParams({ q: address, limit: "1" }).toString()}`;
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
        if (!response.ok) return null;
        const parsed = ignResponseSchema.safeParse(await response.json());
        const feature = parsed.success ? parsed.data.features[0] : undefined;
        if (!feature || (feature.properties.score ?? 0) < MIN_SCORE) return null;
        const [longitude, latitude] = feature.geometry.coordinates;
        return { latitude, longitude };
      } catch {
        // Réseau coupé, délai dépassé : la fiche s'enregistre sans point.
        return null;
      }
    },
  };
}

// Villes reconnues par le géocodeur simulé (pour des distances réalistes
// dans les tests) ; toute autre adresse reçoit un point stable en France.
const FAKE_CITIES: Record<string, GeoPoint> = {
  lille: { latitude: 50.6292, longitude: 3.0573 },
  roubaix: { latitude: 50.6942, longitude: 3.1746 },
  lens: { latitude: 50.4329, longitude: 2.8279 },
  arras: { latitude: 50.2910, longitude: 2.7775 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
  lyon: { latitude: 45.7640, longitude: 4.8357 },
};

export function fakeGeocoder(): Geocoder {
  return {
    async geocode(address) {
      const normalized = address.toLocaleLowerCase("fr");
      if (normalized.includes("introuvable")) return null;
      for (const [city, point] of Object.entries(FAKE_CITIES)) {
        if (normalized.includes(city)) return point;
      }
      const hash = createHash("sha256").update(normalized).digest();
      return { latitude: 43 + (hash[0]! / 255) * 7, longitude: -1 + (hash[1]! / 255) * 8 };
    },
  };
}

export function configuredGeocoder(): Geocoder | null {
  switch (geocoderOf(parseEnv(process.env))) {
    case "ign":
      return ignGeocoder();
    case "fake":
      return fakeGeocoder();
    case "none":
      return null;
  }
}
