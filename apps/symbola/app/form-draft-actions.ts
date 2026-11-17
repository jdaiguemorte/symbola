"use server";

// Lot 39b (UX-09 ; D7 ; ADR 0074) — brouillons des formulaires, appelés par DraftKeeper : relire le
// brouillon de la personne (au chargement d'un formulaire), le réécrire à chaque pause de frappe,
// l'effacer. La personne et l'organisation viennent de la session ; jamais du navigateur.
import { getPlannerAuthContext } from "@/lib/auth-context";
import { discardFormDraft, FormDraftInvalidError, getFormDraft, isFormDraftKey, saveFormDraft } from "@/modules/hub/service";

export type FormDraftView = { content: Record<string, string>; savedAt: string };

async function person(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function loadFormDraftAction(formKey: string): Promise<FormDraftView | null> {
  const who = await person();
  if (!who || !isFormDraftKey(formKey)) return null;
  const draft = await getFormDraft(who.organizationId, who.userId, formKey);
  return draft ? { content: draft.content, savedAt: draft.updatedAt.toISOString() } : null;
}

export async function saveFormDraftAction(formKey: string, content: Record<string, string>): Promise<{ savedAt: string | null } | { error: "unauthenticated" | "invalid" }> {
  const who = await person();
  if (!who) return { error: "unauthenticated" };
  try {
    const savedAt = await saveFormDraft(who.organizationId, who.userId, formKey, content);
    return { savedAt: savedAt?.toISOString() ?? null };
  } catch (error) {
    if (error instanceof FormDraftInvalidError) return { error: "invalid" };
    throw error;
  }
}

export async function discardFormDraftAction(formKey: string): Promise<void> {
  const who = await person();
  if (!who) return;
  await discardFormDraft(who.organizationId, who.userId, formKey);
}
