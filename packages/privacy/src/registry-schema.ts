// Format du registre de données personnelles (SOC-07, CLAUDE.md §2.8).
// Chaque champ personnel déclaré doit indiquer sa catégorie, sa règle de
// conservation et sa règle d'anonymisation — jamais de champ personnel
// codé en dur sans déclaration.
import { z } from "zod";

export const registryEntrySchema = z.object({
  schema: z.string().min(1),
  table: z.string().min(1),
  field: z.string().min(1),
  category: z.enum(["identifiant", "contact", "securite", "contenu_libre"]),
  retention: z.string().min(1),
  anonymization: z.string().min(1),
});

export const registrySchema = z.object({
  version: z.literal(1),
  fields: z.array(registryEntrySchema),
});

export type RegistryEntry = z.infer<typeof registryEntrySchema>;
export type Registry = z.infer<typeof registrySchema>;
