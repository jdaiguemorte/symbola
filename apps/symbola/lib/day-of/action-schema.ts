// Lot 51 (ARC-09, JRJ-05 à JRJ-09 ; ADR 0091) — validation (Zod) de ce que le téléphone envoie de sa
// file : un lot d'actions, ou une photo et sa fiche. Toute entrée externe est validée (SEC-18).
import { z } from "zod";
import { DAY_CHECKPOINT_KINDS, DAY_INCIDENT_MAX, DAY_INCIDENT_SEVERITIES, DAY_PHOTO_SUBJECTS } from "@symbola/contracts";

// Un lot raisonnable : la file part par paquets.
export const DAY_ACTIONS_PER_BATCH = 50;
export const DAY_ACTIONS_BODY_MAX_BYTES = 256 * 1024;

const base = { actionId: z.uuid(), deviceAt: z.iso.datetime({ offset: true }) };

export const dayActionSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("checkpoint"), itemId: z.uuid(), checkpoint: z.enum(DAY_CHECKPOINT_KINDS) }),
  z.object({
    ...base,
    kind: z.literal("shift"),
    keyMomentId: z.uuid().nullable(),
    lateItemId: z.uuid(),
    minutes: z.number().int().min(1).max(720),
    itemIds: z.array(z.uuid()).min(1).max(200),
    vendorSlotIds: z.array(z.uuid()).max(200),
  }),
  z.object({ ...base, kind: z.literal("incident"), body: z.string().min(1).max(DAY_INCIDENT_MAX), severity: z.enum(DAY_INCIDENT_SEVERITIES).nullable(), keyMomentId: z.uuid().nullable() }),
  z.object({ ...base, kind: z.literal("check"), checklistItemId: z.uuid() }),
  z.object({ ...base, kind: z.literal("handover"), paymentId: z.uuid() }),
]);

export const dayActionBatchSchema = z.object({ actions: z.array(dayActionSchema).min(1).max(DAY_ACTIONS_PER_BATCH) });

export const dayPhotoMetaSchema = z.object({
  ...base,
  subject: z.enum(DAY_PHOTO_SUBJECTS),
  subjectId: z.uuid().nullable(),
  subjectActionId: z.uuid().nullable(),
});
