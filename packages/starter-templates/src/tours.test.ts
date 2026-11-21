// Lot 63f (HUB-11 ; ADR 0104) — contenu des visites guidées : un fichier de données traduisible.
import { describe, expect, it } from "vitest";
import toursFile from "./tours.json";
import { starterTour, TOUR_KEYS, toursSchema } from "./tours";

describe("HUB-11 — Visite guidée : contenu en fichier de données", () => {
  it("chaque écran clé a trois à cinq étapes, en français et en anglais", () => {
    for (const key of TOUR_KEYS) {
      const fr = starterTour("fr", key);
      const en = starterTour("en", key);
      expect(fr.length).toBeGreaterThanOrEqual(3);
      expect(fr.length).toBeLessThanOrEqual(5);
      expect(en).toHaveLength(fr.length);
      expect(en.map((step) => step.target)).toEqual(fr.map((step) => step.target));
    }
  });

  it("refuse un écran à deux étapes ou un écran inconnu", () => {
    const short = structuredClone(toursFile) as { tours: Record<string, unknown[]> };
    short.tours.quotes = short.tours.quotes!.slice(0, 2);
    expect(toursSchema.safeParse(short).success).toBe(false);
    const unknown = structuredClone(toursFile) as { tours: Record<string, unknown[]> };
    unknown.tours.ailleurs = unknown.tours.hub!;
    expect(toursSchema.safeParse(unknown).success).toBe(false);
  });

  it("le texte anglais n'est jamais celui du français (traduction faite)", () => {
    for (const key of TOUR_KEYS) {
      starterTour("fr", key).forEach((step, index) => expect(starterTour("en", key)[index]!.body).not.toBe(step.body));
    }
  });
});
