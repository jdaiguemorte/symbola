// Lot 45 (CRM-07 ; D5 ; ADR 0090) — événement interne du hub : deux fiches de contact ont été
// réunies par la planner. Chaque module qui garde l'identifiant d'un contact (events, quotes,
// appointments) repointe ses références de la fiche absorbée vers la fiche gardée, par son propre
// service, de façon idempotente (ARC-01, ARC-05). Nommage <module>.<entité>.<action> au passé
// (CLAUDE.md § 5). Aucune donnée personnelle : des identifiants.
import { z } from "zod";

export const HUB_CONTACT_MERGED = "hub.contact.merged";
export const HUB_CONTACT_MERGED_VERSION = 1;

export const contactMergedPayloadSchema = z
  .object({
    mergeId: z.string().uuid(),
    keptContactId: z.string().uuid(),
    absorbedContactId: z.string().uuid(),
  })
  .refine((payload) => payload.keptContactId !== payload.absorbedContactId, { message: "fiches identiques" });

export type ContactMergedPayload = z.infer<typeof contactMergedPayloadSchema>;
