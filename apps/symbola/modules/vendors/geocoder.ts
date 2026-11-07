// PRE-03 (lot 11, ADR 0031 § 6) — adresse → point, derrière une interface.
// « ign » : API Géocodage de la Géoplateforme (gratuite, sans clé). Seule
// l'adresse est envoyée, jamais le nom du prestataire ni son contact.
// « fake » : points simulés et reproductibles (tests, développement hors
// ligne ; interdit en production par @symbola/env).
import { createHash } from "node:crypto";
import { z } from "zod";
import { geocoderOf, parseEnv } from "@symbola/env";
import { parseDelimited } from "@symbola/import-engine";

export type GeoPoint = { latitude: number; longitude: number };
// Lot 15 (GEO-01) : plusieurs adresses en un envoi. Le code postal est un
// filtre à part (jamais mêlé au texte : « … Lille » sortait aux Lilas).
export type GeocodeRequest = { id: string; text: string; postalCode: string | null };
export type Geocoder = {
  geocode(address: string): Promise<GeoPoint | null>;
  geocodeMany(requests: GeocodeRequest[]): Promise<Map<string, GeoPoint | null>>;
};

// Une fiche par ligne dans un envoi ; un lot plus grand est découpé.
export const GEOCODE_BATCH_SIZE = 500;
// Sous la limite de l'IGN (50 requêtes par seconde et par adresse IP).
const UNIT_REQUESTS_PER_SECOND = 40;
const TOO_MANY_REQUESTS_PAUSE_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function pointOf(latitude: string | undefined, longitude: string | undefined, score: string | undefined): GeoPoint | null {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if ((Number(score) || 0) < MIN_SCORE) return null;
  return { latitude: lat, longitude: lon };
}

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

export function ignGeocoder(fetchImpl: typeof fetch = fetch, pause: (ms: number) => Promise<unknown> = sleep): Geocoder {
  const geocodeOne = async (address: string, postalCode: string | null = null): Promise<GeoPoint | null | "too_many"> => {
    const params = new URLSearchParams({ q: address, limit: "1" });
    if (postalCode) params.set("postcode", postalCode);
    try {
      const response = await fetchImpl(`${IGN_URL}?${params.toString()}`, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
      if (response.status === 429) return "too_many";
      if (!response.ok) return null;
      const parsed = ignResponseSchema.safeParse(await response.json());
      const feature = parsed.success ? parsed.data.features[0] : undefined;
      if (!feature || (feature.properties.score ?? 0) < MIN_SCORE) return null;
      const [longitude, latitude] = feature.geometry.coordinates;
      return { latitude, longitude };
    } catch {
      return null;
    }
  };

  // Un envoi CSV pour tout le lot ; null si le service ne répond pas comme prévu.
  const geocodeBatch = async (requests: GeocodeRequest[]): Promise<Map<string, GeoPoint | null> | null> => {
    // La marque UTF-8 en tête est indispensable : sans elle, le service lit le
    // fichier en Latin-1 (« République » devient introuvable), vérifié le 07/11/2026.
    const csv = "\uFEFF" + ["id,q,postcode", ...requests.map((request) => [request.id, request.text, request.postalCode ?? ""].map(csvCell).join(","))].join("\n");
    const form = new FormData();
    form.append("data", new Blob([csv], { type: "text/csv;charset=utf-8" }), "adresses.csv");
    form.append("columns", "q");
    form.append("postcode", "postcode");
    for (const column of ["latitude", "longitude", "result_score"]) form.append("result_columns", column);
    try {
      const response = await fetchImpl(`${IGN_URL}/csv`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) return null;
      const lines = parseDelimited((await response.text()).replace(/^\uFEFF/, ""), ",");
      const header = lines[0]?.cells ?? [];
      const column = (name: string) => header.indexOf(name);
      const [idAt, latAt, lonAt, scoreAt] = ["id", "latitude", "longitude", "result_score"].map(column);
      if ([idAt, latAt, lonAt, scoreAt].some((index) => index === undefined || index < 0)) return null;
      const result = new Map<string, GeoPoint | null>();
      for (const line of lines.slice(1)) {
        const id = line.cells[idAt!];
        if (id) result.set(id, pointOf(line.cells[latAt!], line.cells[lonAt!], line.cells[scoreAt!]));
      }
      return requests.every((request) => result.has(request.id)) ? result : null;
    } catch {
      return null;
    }
  };

  return {
    async geocodeMany(requests) {
      const result = new Map<string, GeoPoint | null>();
      for (let start = 0; start < requests.length; start += GEOCODE_BATCH_SIZE) {
        const chunk = requests.slice(start, start + GEOCODE_BATCH_SIZE);
        const batch = await geocodeBatch(chunk);
        if (batch) {
          for (const [id, point] of batch) result.set(id, point);
          continue;
        }
        // Repli : une adresse à la fois, au plus 40 par seconde ; « trop de
        // requêtes » suspend l'envoi 5 secondes puis le reprend.
        for (const request of chunk) {
          let point = await geocodeOne(request.text, request.postalCode);
          if (point === "too_many") {
            await pause(TOO_MANY_REQUESTS_PAUSE_MS);
            point = await geocodeOne(request.text, request.postalCode);
          }
          result.set(request.id, point === "too_many" ? null : point);
          await pause(1000 / UNIT_REQUESTS_PER_SECOND);
        }
      }
      return result;
    },
    async geocode(address) {
      // Réseau coupé, délai dépassé : la fiche s'enregistre sans point.
      const point = await geocodeOne(address);
      return point === "too_many" ? null : point;
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

// Envois du géocodeur simulé (tests : « au plus un envoi en lot »).
export const fakeGeocoderCalls = { batches: 0, single: 0 };

export function fakeGeocoder(): Geocoder {
  const locate = (address: string): GeoPoint | null => {
    const normalized = address.toLocaleLowerCase("fr");
    if (normalized.includes("introuvable")) return null;
    for (const [city, point] of Object.entries(FAKE_CITIES)) {
      if (normalized.includes(city)) return point;
    }
    const hash = createHash("sha256").update(normalized).digest();
    return { latitude: 43 + (hash[0]! / 255) * 7, longitude: -1 + (hash[1]! / 255) * 8 };
  };
  return {
    async geocodeMany(requests) {
      fakeGeocoderCalls.batches += Math.ceil(requests.length / GEOCODE_BATCH_SIZE);
      return new Map(requests.map((request) => [request.id, locate(`${request.text} ${request.postalCode ?? ""}`)]));
    },
    async geocode(address) {
      fakeGeocoderCalls.single += 1;
      return locate(address);
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
