// Lot 11 (L11-PRE-02, L11-PRE-03, L11-PRE-06, L11-PRE-07) — règles pures du carnet :
// distance, trajet estimé, valeurs des champs par type, géocodage.
import { describe, expect, it } from "vitest";
import type { VendorTypeField } from "@symbola/contracts";
import { cleanFieldValues, InvalidVendorFieldValueError, isUsableFilter, parseFieldInput } from "./fields";
import { fakeGeocoder, ignGeocoder } from "./geocoder";
import { DEFAULT_VENDOR_SETTINGS, estimateTravel, haversineKm, validateVendorSettings } from "./travel";

const field = (id: string, kind: VendorTypeField["kind"], extra: Partial<VendorTypeField> = {}): VendorTypeField => ({
  id,
  typeId: "t",
  label: id,
  kind,
  choices: [],
  isFilter: true,
  position: 0,
  ...extra,
});

describe("L11-PRE-07 — Trajet estimé", () => {
  it("Lille → Arras : environ 42 km à vol d'oiseau", () => {
    const km = haversineKm({ latitude: 50.6292, longitude: 3.0573 }, { latitude: 50.291, longitude: 2.7775 });
    expect(km).toBeGreaterThan(42);
    expect(km).toBeLessThan(43);
  });

  it("applique le détour (× 1,3) et la vitesse moyenne (60 km/h), arrondis à 0,1 km et à la minute supérieure", () => {
    expect(estimateTravel(10, DEFAULT_VENDOR_SETTINGS)).toEqual({ distanceKm: 13, minutes: 13 });
    expect(estimateTravel(0, DEFAULT_VENDOR_SETTINGS)).toEqual({ distanceKm: 0, minutes: 1 });
    expect(estimateTravel(10, { detourFactorPermille: 1500, averageSpeedKmh: 45 })).toEqual({ distanceKm: 15, minutes: 20 });
  });

  it("refuse un coefficient ou une vitesse hors bornes", () => {
    expect(() => validateVendorSettings({ detourFactorPermille: 900, averageSpeedKmh: 60 })).toThrow(RangeError);
    expect(() => validateVendorSettings({ detourFactorPermille: 1300, averageSpeedKmh: 0 })).toThrow(RangeError);
  });
});

describe("L11-PRE-02 — Valeurs des champs propres à un type", () => {
  it("convertit les saisies : nombre, montant en centimes, oui/non, vide", () => {
    expect(parseFieldInput("number", "62")).toBe(62);
    expect(parseFieldInput("amount", "1 200,50 €")).toBe(120050);
    expect(parseFieldInput("boolean", "on")).toBe(true);
    expect(parseFieldInput("text", "  ")).toBeNull();
  });

  it("garde les champs du type et refuse une valeur mal formée", () => {
    const fields = [field("beds", "number"), field("end", "time"), field("food", "choice", { choices: ["libre", "imposé"] })];
    expect(cleanFieldValues(fields, { beds: 62, end: "02:00", food: "libre", other: "ignoré" })).toEqual({ beds: 62, end: "02:00", food: "libre" });
    expect(() => cleanFieldValues(fields, { end: "25:00" })).toThrow(InvalidVendorFieldValueError);
    expect(() => cleanFieldValues(fields, { food: "autre" })).toThrow(InvalidVendorFieldValueError);
    expect(() => cleanFieldValues([field("price", "amount")], { price: 12.5 })).toThrow(InvalidVendorFieldValueError);
  });

  it("n'accepte ≥ / ≤ que sur un nombre, un montant ou une heure, et seulement pour un champ-filtre", () => {
    expect(isUsableFilter(field("beds", "number"), { fieldId: "beds", op: "gte", value: 40 })).toBe(true);
    expect(isUsableFilter(field("food", "choice", { choices: ["libre"] }), { fieldId: "food", op: "gte", value: "libre" })).toBe(false);
    expect(isUsableFilter(field("beds", "number", { isFilter: false }), { fieldId: "beds", op: "gte", value: 40 })).toBe(false);
  });
});

describe("L11-PRE-03 — Géocodage", () => {
  it("le géocodeur simulé est reproductible et sait dire « introuvable »", async () => {
    const geocoder = fakeGeocoder();
    expect(await geocoder.geocode("12 rue des Halles, 59800 Lille")).toEqual({ latitude: 50.6292, longitude: 3.0573 });
    expect(await geocoder.geocode("1 chemin du Moulin, Trifouillis")).toEqual(await geocoder.geocode("1 chemin du Moulin, Trifouillis"));
    expect(await geocoder.geocode("adresse introuvable")).toBeNull();
  });

  it("IGN : n'envoie que l'adresse, lit le point, ignore un résultat peu sûr ou une panne", async () => {
    const calls: string[] = [];
    const respond = (body: unknown, ok = true) =>
      (async (url: string | URL | Request) => {
        calls.push(String(url));
        return { ok, json: async () => body } as Response;
      }) as typeof fetch;
    const found = { features: [{ geometry: { coordinates: [3.0573, 50.6292] }, properties: { score: 0.93 } }] };
    expect(await ignGeocoder(respond(found)).geocode("12 rue des Halles Lille")).toEqual({ latitude: 50.6292, longitude: 3.0573 });
    expect(calls[0]).toBe("https://data.geopf.fr/geocodage/search?q=12+rue+des+Halles+Lille&limit=1");
    const unsure = { features: [{ geometry: { coordinates: [3, 50] }, properties: { score: 0.2 } }] };
    expect(await ignGeocoder(respond(unsure)).geocode("x")).toBeNull();
    expect(await ignGeocoder(respond({}, false)).geocode("x")).toBeNull();
    const failing = (async () => {
      throw new Error("réseau");
    }) as typeof fetch;
    expect(await ignGeocoder(failing).geocode("x")).toBeNull();
  });
});

describe("GEO-01 — Géocodage en lot (lot 15)", () => {
  const requests = [
    { id: "a", text: "20 rue de la République Lille", postalCode: "59000" },
    { id: "b", text: '12 rue des Lilas, "B"', postalCode: null },
    { id: "c", text: "adresse introuvable", postalCode: "86000" },
  ];

  it("IGN : un seul envoi CSV pour tout le lot, code postal en filtre à part, seuil de score appliqué", async () => {
    const sent: { url: string; csv: string; fields: [string, string][] }[] = [];
    const service = (async (url: string | URL | Request, init?: RequestInit) => {
      const form = init!.body as FormData;
      const fields = [...form.entries()].filter(([, value]) => typeof value === "string") as [string, string][];
      // Octets bruts : Blob.text() retirerait la marque UTF-8 envoyée en tête.
      const bytes = await (form.get("data") as Blob).arrayBuffer();
      sent.push({ url: String(url), csv: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes), fields });
      const body = 'id,q,postcode,latitude,longitude,result_score\na,x,59000,50.631,3.060,0.71\nb,"12 rue des Lilas, ""B""",,46.56,0.35,0.86\nc,x,86000,49.5,0.08,0.36\n';
      return { ok: true, status: 200, text: async () => body } as Response;
    }) as typeof fetch;
    const result = await ignGeocoder(service).geocodeMany(requests);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://data.geopf.fr/geocodage/search/csv");
    expect(sent[0]!.csv).toBe('\uFEFFid,q,postcode\na,20 rue de la République Lille,59000\nb,"12 rue des Lilas, ""B""",\nc,adresse introuvable,86000');
    expect(sent[0]!.fields).toEqual(expect.arrayContaining([["columns", "q"], ["postcode", "postcode"]]));
    expect(result.get("a")).toEqual({ latitude: 50.631, longitude: 3.06 });
    expect(result.get("b")).toEqual({ latitude: 46.56, longitude: 0.35 });
    expect(result.get("c")).toBeNull();
  });

  it("IGN : si l'envoi en lot échoue, une adresse à la fois, avec une pause sur « trop de requêtes »", async () => {
    const pauses: number[] = [];
    let unit = 0;
    const service = (async (url: string | URL | Request) => {
      if (String(url).endsWith("/csv")) return { ok: false, status: 503 } as Response;
      unit += 1;
      if (unit === 1) return { ok: false, status: 429 } as Response;
      const found = { features: [{ geometry: { coordinates: [3, 50] }, properties: { score: 0.9 } }] };
      return { ok: true, status: 200, json: async () => found } as Response;
    }) as typeof fetch;
    const result = await ignGeocoder(service, async (ms) => pauses.push(ms)).geocodeMany(requests);
    expect([...result.values()]).toEqual([{ latitude: 50, longitude: 3 }, { latitude: 50, longitude: 3 }, { latitude: 50, longitude: 3 }]);
    expect(pauses[0]).toBe(5000);
    expect(pauses.filter((ms) => ms === 25)).toHaveLength(3);
  });
});
