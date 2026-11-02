// Fiches cochées dans le résultat de la recherche et termes de la recherche,
// renvoyés en POST par les formulaires d'export (RGPD-02) et d'oubli
// (RGPD-03) pour relancer la recherche côté serveur. Jamais par l'URL.
import { z } from "zod";
import type { PersonTerms } from "@symbola/privacy";

const selectionSchema = z.object({
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  name: z.string().trim().max(200).optional(),
  records: z.array(z.string().max(200)).max(5000),
});

export function parseSelection(formData: FormData): { terms: PersonTerms; selectedKeys: string[] } | null {
  const parsed = selectionSchema.safeParse({
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    name: formData.get("name") ?? undefined,
    records: formData.getAll("record"),
  });
  if (!parsed.success) return null;
  return { terms: { email: parsed.data.email, phone: parsed.data.phone, name: parsed.data.name }, selectedKeys: parsed.data.records };
}
