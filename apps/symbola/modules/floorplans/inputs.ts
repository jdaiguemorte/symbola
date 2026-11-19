// Lot 60 (L60-PLA-01 à L60-PLA-03) — validation (Zod) des saisies du module : éléments et
// installations enregistrés depuis l'éditeur, espaces, calibration. Partagée par les actions de
// l'app et le service, qui relit tout côté serveur (SEC-12).
import { z } from "zod";
import { FLOORPLAN_CATEGORIES, FLOORPLAN_COLORS, FLOORPLAN_FIXTURE_KINDS, FLOORPLAN_SEAT_RULES, FLOORPLAN_SHAPES } from "@symbola/contracts";

const coordinate = z.number().int().min(-100000).max(200000);
const rotation = z.number().int().min(0).max(359);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

export const elementInputSchema = z.object({
  id: z.string().max(64).nullable().optional(),
  elementTypeId: z.uuid().nullable(),
  typeStarterKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60).nullable(),
  typeLabel: optionalText(60),
  category: z.enum(FLOORPLAN_CATEGORIES),
  shape: z.enum(FLOORPLAN_SHAPES),
  name: optionalText(60),
  xCm: coordinate,
  yCm: coordinate,
  widthCm: z.number().int().min(10).max(10000),
  depthCm: z.number().int().min(10).max(10000),
  rotationDeg: rotation,
  seats: z.number().int().min(0).max(500),
  color: z.enum(FLOORPLAN_COLORS).nullable(),
  note: optionalText(500),
  vendorCandidateId: z.uuid().nullable(),
  powerOutlets: z.number().int().min(0).max(20),
  powerAmps: z.number().int().min(1).max(125).nullable(),
  needsWater: z.boolean(),
  maxCableM: z.number().int().min(1).max(500).nullable(),
  fixtureId: z.uuid().nullable(),
});

export const fixtureInputSchema = z.object({
  id: z.string().max(64).nullable().optional(),
  kind: z.enum(FLOORPLAN_FIXTURE_KINDS),
  label: optionalText(60),
  xCm: coordinate,
  yCm: coordinate,
  widthCm: z.number().int().min(5).max(100000),
  depthCm: z.number().int().min(5).max(100000),
  rotationDeg: rotation,
  outletCount: z.number().int().min(1).max(50).nullable(),
  amps: z.number().int().min(1).max(125).nullable(),
  threePhase: z.boolean(),
  note: optionalText(500),
});

export const spaceInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  widthCm: z.number().int().min(100).max(100000),
  depthCm: z.number().int().min(100).max(100000),
});

export const calibrationSchema = z
  .object({
    ax: z.number().int().min(0).max(20000),
    ay: z.number().int().min(0).max(20000),
    bx: z.number().int().min(0).max(20000),
    by: z.number().int().min(0).max(20000),
    distanceCm: z.number().int().min(1).max(100000),
  })
  .refine((value) => value.ax !== value.bx || value.ay !== value.by);

export const elementTypeInputSchema = z.object({
  label: z.string().trim().min(1).max(60),
  category: z.enum(FLOORPLAN_CATEGORIES),
  shape: z.enum(FLOORPLAN_SHAPES),
  seatRule: z.enum(FLOORPLAN_SEAT_RULES),
  widthCm: z.number().int().min(10).max(10000),
  depthCm: z.number().int().min(10).max(10000),
  powerOutlets: z.number().int().min(0).max(20),
  powerAmps: z.number().int().min(1).max(125).nullable(),
  needsWater: z.boolean(),
});

export const layoutNameSchema = z.string().trim().min(1).max(80);
