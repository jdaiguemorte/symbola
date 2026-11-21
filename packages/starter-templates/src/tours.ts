// Lot 63f (HUB-11 ; ADR 0104) — visites guidées des écrans clés : pour chaque écran, trois à cinq
// étapes, chacune avec sa zone (attribut data-tour de l'écran, facultatif : sans zone, la bulle
// s'affiche seule au centre) et son texte en français et en anglais. Aucun texte de visite dans le
// code ni dans les fichiers de traduction de l'app (ADR 0007) : ce fichier les porte, et se
// personnalise écran par écran.
import { z } from "zod";
import toursFile from "./tours.json";

const localized = (max: number) => z.object({ fr: z.string().min(1).max(max), en: z.string().min(1).max(max) });

export const TOUR_KEYS = ["hub", "events", "event", "vendors", "quotes", "budget"] as const;
export type StarterTourKey = (typeof TOUR_KEYS)[number];

const tourStepSchema = z.object({
  target: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,59}$/)
    .optional(),
  title: localized(80),
  body: localized(400),
});

export const toursSchema = z.object({
  version: z.literal(1),
  tours: z.object(Object.fromEntries(TOUR_KEYS.map((key) => [key, z.array(tourStepSchema).min(3).max(5)])) as Record<StarterTourKey, z.ZodArray<typeof tourStepSchema>>).strict(),
});

const tours = toursSchema.parse(toursFile);

export type StarterTourStep = { target?: string; title: string; body: string };

export function isStarterTourKey(value: string): value is StarterTourKey {
  return (TOUR_KEYS as readonly string[]).includes(value);
}

export function starterTour(locale: "fr" | "en", key: StarterTourKey): StarterTourStep[] {
  return tours.tours[key].map((step) => ({ ...(step.target ? { target: step.target } : {}), title: step.title[locale], body: step.body[locale] }));
}
