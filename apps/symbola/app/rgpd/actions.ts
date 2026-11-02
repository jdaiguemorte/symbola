"use server";

import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { searchPerson, type PersonSearchResult } from "@/lib/privacy/search";

// Les termes reviennent au formulaire d'export (RGPD-02), qui relance la
// recherche côté serveur ; searchId distingue deux recherches successives.
export type SearchTerms = { email?: string | undefined; phone?: string | undefined; name?: string | undefined };
export type SearchFormState = { error?: string; result?: PersonSearchResult; terms?: SearchTerms; searchId?: string; searched?: boolean };

const termsSchema = z.object({
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  name: z.string().trim().max(200).optional(),
});

// RGPD-01 — recherche transverse. Réservée à la titulaire (rôle owner) : un
// collaborateur n'a aucun accès au module (cahier des charges § 6). Les
// termes passent par une action serveur, jamais par l'URL (journaux, historique).
export async function searchPersonAction(_prevState: SearchFormState, formData: FormData): Promise<SearchFormState> {
  const t = await getTranslations("Privacy");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return { error: t("ownerOnly") };

  const parsed = termsSchema.safeParse({
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    name: formData.get("name") ?? undefined,
  });
  if (!parsed.success) return { error: t("termsInvalid") };
  const result = await searchPerson({ organizationId: auth.user.organizationId, terms: parsed.data });
  if (!result) return { error: t("termsMissing") };
  return { result, terms: parsed.data, searchId: randomUUID(), searched: true };
}
