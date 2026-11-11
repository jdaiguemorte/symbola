// Schémas des événements internes du module vendors (lot 16, ADR 0040).
// Nommage <module>.<entité>.<action> au passé (CLAUDE.md §5).
import { z } from "zod";

// L16-PRE-15 : un type fusionné dans un autre ; ses fiches et ses champs propres
// passent au type gardé. Journal de l'opération (outbox, ADR 0014).
export const VENDORS_VENDOR_TYPE_MERGED = "vendors.vendor_type.merged";
export const VENDORS_VENDOR_TYPE_MERGED_VERSION = 1;

export const vendorTypeMergedPayloadSchema = z.object({
  sourceTypeId: z.string().uuid(),
  targetTypeId: z.string().uuid(),
  movedVendorCount: z.number().int().nonnegative(),
  movedFieldCount: z.number().int().nonnegative(),
});

export type VendorTypeMergedPayload = z.infer<typeof vendorTypeMergedPayloadSchema>;
