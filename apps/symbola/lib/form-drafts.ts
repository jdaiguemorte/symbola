// Lot 39b (UX-09 ; D7 ; ADR 0074) — côté serveur : une action qui enregistre un formulaire efface le
// brouillon de la personne pour ce formulaire (la saisie est devenue une vraie donnée). Sans session,
// rien à effacer.
import { getPlannerAuthContext } from "@/lib/auth-context";
import { discardFormDraft } from "@/modules/hub/service";

export async function discardMyFormDraft(formKey: string): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  await discardFormDraft(auth.user.organizationId, auth.user.id, formKey);
}
