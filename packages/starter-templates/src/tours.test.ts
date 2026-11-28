// Lot 63f (HUB-11 ; ADR 0104), revu au lot 74d (D2, B10 à B12, B17) — contenu des visites guidées :
// un fichier de données traduisible.
import { describe, expect, it } from "vitest";
import toursFile from "./tours.json";
import { isAutomaticTour, starterTour, starterTourLength, TOUR_KEYS, toursSchema } from "./tours";

type RawTours = { version: number; tours: Record<string, { automatic?: boolean; steps: unknown[] }> };

describe("HUB-11 — Visite guidée : contenu en fichier de données", () => {
  it("sept visites, de trois ou quatre bulles, en français et en anglais, sur les mêmes zones", () => {
    expect(TOUR_KEYS).toHaveLength(7);
    for (const key of TOUR_KEYS) {
      for (const variant of ["filled", "empty"] as const) {
        const fr = starterTour("fr", key, variant);
        const en = starterTour("en", key, variant);
        expect(fr.length, key).toBeGreaterThanOrEqual(3);
        expect(fr.length, key).toBeLessThanOrEqual(4);
        expect(starterTourLength(key)).toBe(fr.length);
        expect(en.map((step) => step.target)).toEqual(fr.map((step) => step.target));
      }
    }
  });

  it("refuse une visite à deux ou à cinq bulles, ou un écran inconnu", () => {
    const short = structuredClone(toursFile) as RawTours;
    short.tours.quotes!.steps = short.tours.quotes!.steps.slice(0, 2);
    expect(toursSchema.safeParse(short).success).toBe(false);
    const long = structuredClone(toursFile) as RawTours;
    long.tours.event!.steps = [...long.tours.event!.steps, long.tours.event!.steps[0]];
    expect(toursSchema.safeParse(long).success).toBe(false);
    const unknown = structuredClone(toursFile) as RawTours;
    unknown.tours.ailleurs = unknown.tours.hub!;
    expect(toursSchema.safeParse(unknown).success).toBe(false);
  });

  it("le texte anglais n'est jamais celui du français (traduction faite)", () => {
    for (const key of TOUR_KEYS) {
      starterTour("fr", key).forEach((step, index) => expect(starterTour("en", key)[index]!.body).not.toBe(step.body));
    }
  });

  // Lot 69 (UX-05, UX-10, HUB-11 ; C-02) : la visite se lit aussi sur téléphone, sans geste de souris,
  // et ne compte pas un chiffre que l'écran ne tient pas.
  it("aucune bulle ne cite un geste de souris, ni « trois points »", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const key of TOUR_KEYS) {
        for (const variant of ["filled", "empty"] as const) {
          for (const step of starterTour(locale, key, variant)) {
            for (const text of [step.body, step.touch ?? ""]) expect(text, `${locale} ${key} ${step.target}`).not.toMatch(/survol|cliquez|hover|click|three most|trois points/i);
          }
        }
      }
    }
  });
});

describe("L74-74d — Les visites proposées : drapeau, cibles, appareil et état", () => {
  it("critère 1 — seule la visite de l'accueil est automatique", () => {
    expect(TOUR_KEYS.filter((key) => isAutomaticTour(key))).toEqual(["hub"]);
    const two = structuredClone(toursFile) as RawTours;
    two.tours.events!.automatic = true;
    expect(toursSchema.safeParse(two).success).toBe(false);
  });

  it("critère 4 — chaque bulle déclare la zone qu'elle encadre", () => {
    const missing = structuredClone(toursFile) as { tours: Record<string, { steps: Record<string, unknown>[] }> };
    delete missing.tours.budget!.steps[0]!.target;
    expect(toursSchema.safeParse(missing).success).toBe(false);
    for (const key of TOUR_KEYS) for (const step of starterTour("fr", key)) expect(step.target).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("critère 5 — « Tâches » a sa visite : la ligne et « Fait », les filtres, « Sélectionner »", () => {
    expect(starterTour("fr", "tasks").map((step) => step.target)).toEqual(["task-line", "tasks-filters", "tasks-select"]);
  });

  it("les mots de l'appareil : sur un écran tactile, « Touchez »", () => {
    const touch = TOUR_KEYS.flatMap((key) => starterTour("fr", key)).filter((step) => step.touch);
    expect(touch.length).toBeGreaterThan(0);
    for (const step of touch) expect(step.touch).toMatch(/touch/i);
    expect(starterTour("en", "tasks")[0]!.touch).toMatch(/tap/i);
  });

  it("l'accueil a ses bulles de l'espace vide (« Commencez ici ») et de l'écran rempli", () => {
    expect(starterTour("fr", "hub", "empty").map((step) => step.title)).toEqual(["Votre journée, ici", "Commencez ici", "L'aide de chaque écran"]);
    expect(starterTour("fr", "hub", "empty")[1]!.target).toBe("home-start");
    expect(starterTour("fr", "hub", "filled")[1]!.target).toBe("task-line");
    // Un écran sans bulles « vide » garde les siennes.
    expect(starterTour("fr", "events", "empty")).toEqual(starterTour("fr", "events", "filled"));
  });
});
