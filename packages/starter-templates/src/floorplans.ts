// Lot 60 (L60-PLA-01 à L60-PLA-03 ; D2, D6) — données de départ du module Plans de salle :
// bibliothèque d'éléments (tables et installations de soirée), largeur d'une place pour proposer le
// nombre de places, grille et pas de l'éditeur, dimensions par défaut des installations fixes,
// ampérages proposés. Aucune de ces valeurs n'est écrite dans le code (CLAUDE.md § 2.6).
import { z } from "zod";
import floorplanElementsFile from "./floorplan-elements.json";

type Locale = "fr" | "en";
const translated = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const size = z.number().int().min(10).max(10000);

const floorplanSchema = z.object({
  version: z.literal(1),
  seating: z.object({ seatWidthCm: z.number().int().min(30).max(120), roundSeatWidthCm: z.number().int().min(30).max(120), endSeatMinDepthCm: z.number().int().min(30).max(300) }),
  editor: z.object({ gridCm: z.number().int().min(5).max(500), nudgeCm: z.number().int().min(1).max(100), nudgeLargeCm: z.number().int().min(10).max(1000), rotationStepDeg: z.number().int().min(1).max(90), maxElements: z.number().int().min(10).max(2000) }),
  elements: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        category: z.enum(["table", "setup"]),
        shape: z.enum(["circle", "rect", "ellipse"]),
        seatRule: z.enum(["round", "two_sides", "one_side", "four_sides", "oval", "none"]).default("none"),
        widthCm: size,
        depthCm: size,
        powerOutlets: z.number().int().min(0).max(20).default(0),
        powerAmps: z.number().int().min(1).max(125).nullable().default(null),
        needsWater: z.boolean().default(false),
        label: translated,
      }),
    )
    .min(1),
  fixtures: z.array(
    z.object({
      kind: z.enum(["outlet", "water", "door", "emergency_exit", "delivery", "pillar", "stage"]),
      widthCm: z.number().int().min(5).max(100000),
      depthCm: z.number().int().min(5).max(100000),
      outletCount: z.number().int().min(1).max(50).optional(),
      amps: z.number().int().min(1).max(125).optional(),
    }),
  ),
  ampChoices: z.array(z.number().int().min(1).max(125)).min(1),
});

type FloorplanFile = z.infer<typeof floorplanSchema>;
let parsed: FloorplanFile | null = null;
function file(): FloorplanFile {
  parsed ??= floorplanSchema.parse(floorplanElementsFile);
  return parsed;
}

export type StarterFloorplanElement = Omit<FloorplanFile["elements"][number], "label"> & { label: string };
export type StarterFloorplanFixture = FloorplanFile["fixtures"][number];
export type FloorplanSeatingRules = FloorplanFile["seating"];
export type FloorplanEditorRules = FloorplanFile["editor"];

export function starterFloorplanElements(locale: Locale): StarterFloorplanElement[] {
  return file().elements.map((element) => ({ ...element, label: element.label[locale] }));
}

export function starterFloorplanElementLabel(key: string, locale: Locale): string | null {
  return file().elements.find((element) => element.key === key)?.label[locale] ?? null;
}

export function starterFloorplanFixtures(): StarterFloorplanFixture[] {
  return file().fixtures;
}

export function floorplanSeatingRules(): FloorplanSeatingRules {
  return file().seating;
}

export function floorplanEditorRules(): FloorplanEditorRules {
  return file().editor;
}

export function floorplanAmpChoices(): number[] {
  return file().ampChoices;
}
