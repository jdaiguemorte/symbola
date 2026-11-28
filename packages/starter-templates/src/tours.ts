// Lot 63f (HUB-11 ; ADR 0104), refait au lot 74d (D2 de l'audit, B10 à B12 et B17 ; page 25 des
// maquettes) — visites guidées des écrans clés : sept visites de trois ou quatre bulles. Chaque bulle
// encadre une zone de l'écran (attribut data-tour) et dit son usage en français et en anglais, avec
// les mots de l'appareil (« touch » : le texte d'un écran tactile, « Touchez ») et, pour l'accueil,
// selon l'état de l'écran (« empty » : la bulle de l'espace encore vide). Une seule visite est
// « automatic » : celle de l'accueil ; les autres sont proposées par une ligne. Aucun texte de visite
// dans le code ni dans les fichiers de traduction de l'app (ADR 0007) : ce fichier les porte.
import { z } from "zod";
import toursFile from "./tours.json";

const localized = (max: number) => z.object({ fr: z.string().min(1).max(max), en: z.string().min(1).max(max) });

export const TOUR_KEYS = ["hub", "events", "event", "tasks", "vendors", "quotes", "budget"] as const;
export type StarterTourKey = (typeof TOUR_KEYS)[number];

const target = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);

const tourStepSchema = z
  .object({
    // Lot 74d (C-02) : chaque bulle encadre un élément ; plus de bulle seule au centre.
    target,
    title: localized(80),
    body: localized(280),
    touch: localized(280).optional(),
    empty: z.object({ target, title: localized(80), body: localized(280), touch: localized(280).optional() }).strict().optional(),
  })
  .strict();

const tourSchema = z
  .object({
    automatic: z.boolean().optional(),
    steps: z.array(tourStepSchema).min(3).max(4),
  })
  .strict();

export const toursSchema = z
  .object({
    version: z.literal(2),
    tours: z.object(Object.fromEntries(TOUR_KEYS.map((key) => [key, tourSchema])) as Record<StarterTourKey, typeof tourSchema>).strict(),
  })
  .superRefine((value, context) => {
    const automatic = TOUR_KEYS.filter((key) => value.tours[key].automatic === true);
    if (automatic.length !== 1 || automatic[0] !== "hub") context.addIssue({ code: z.ZodIssueCode.custom, message: "seule la visite de l'accueil est automatique" });
  });

const tours = toursSchema.parse(toursFile);

// Une bulle telle que l'écran la montre : « touch » remplace « body » sur un écran tactile.
export type StarterTourStep = { target: string; title: string; body: string; touch?: string };
// L'état de l'écran : « empty » prend les bulles de l'espace vide quand elles existent.
export type StarterTourVariant = "empty" | "filled";

export function isStarterTourKey(value: string): value is StarterTourKey {
  return (TOUR_KEYS as readonly string[]).includes(value);
}

export function isAutomaticTour(key: StarterTourKey): boolean {
  return tours.tours[key].automatic === true;
}

// Le nombre de bulles, sans leurs textes : ce que la ligne « Découvrir » et le « ? » annoncent.
export function starterTourLength(key: StarterTourKey): number {
  return tours.tours[key].steps.length;
}

export function starterTour(locale: "fr" | "en", key: StarterTourKey, variant: StarterTourVariant = "filled"): StarterTourStep[] {
  return tours.tours[key].steps.map((step) => {
    const shown = variant === "empty" && step.empty ? step.empty : step;
    return { target: shown.target, title: shown.title[locale], body: shown.body[locale], ...(shown.touch ? { touch: shown.touch[locale] } : {}) };
  });
}
