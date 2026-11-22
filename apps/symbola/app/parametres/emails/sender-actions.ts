"use server";

// Lot 65d (MSG-01, HUB-20 ; ADR 0110) — Paramètres › Modèles d'e-mails : qui envoie les messages de la
// relation (« Je les envoie de ma messagerie », par défaut ; « Symbola les envoie pour moi »). Réglage de
// l'organisation : titulaire du compte seulement, comme les automatismes (lot 53).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/guards";
import { PreparedEmailError, setRelationMailSender } from "@/modules/hub/service";

export type SenderFormState = { saved?: boolean; error?: string; at?: number };

export async function saveRelationMailSenderAction(_state: SenderFormState, formData: FormData): Promise<SenderFormState> {
  const t = await getTranslations("EmailTemplates.sender");
  const auth = await requireOwner();
  if (!auth) return { error: t("error"), at: Date.now() };
  try {
    await setRelationMailSender(auth.user.organizationId, String(formData.get("sender") ?? ""));
  } catch (error) {
    if (error instanceof PreparedEmailError) return { error: t("error"), at: Date.now() };
    throw error;
  }
  revalidatePath("/parametres/emails");
  return { saved: true, at: Date.now() };
}
