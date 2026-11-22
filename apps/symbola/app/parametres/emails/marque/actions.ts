"use server";

// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113) — Paramètres › Modèles d'e-mails › Marque et signature :
// police, ligne libre du pied, nom affiché de l'expéditeur, éléments des signatures, signature des
// envois automatiques. Réglage de l'organisation : titulaire du compte seulement, comme « qui envoie »
// (lot 65d). Toute valeur reçue est relue par le service (liste fermée, longueurs, personne active).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/guards";
import { EMAIL_FOOTER_LINE_MAX, EMAIL_SENDER_NAME_MAX, EmailBrandingInvalidError, saveEmailBranding } from "@/modules/hub/service";

export type EmailBrandingFormState = { saved?: boolean; errors?: string[]; at?: number };

export async function saveEmailBrandingAction(_state: EmailBrandingFormState, formData: FormData): Promise<EmailBrandingFormState> {
  const t = await getTranslations("EmailBranding");
  const auth = await requireOwner();
  if (!auth) return { errors: [t("ownerOnly")], at: Date.now() };
  try {
    await saveEmailBranding(auth.user.organizationId, {
      font: String(formData.get("font") ?? ""),
      footerLine: String(formData.get("footerLine") ?? ""),
      senderName: String(formData.get("senderName") ?? ""),
      signatureElements: formData.getAll("signatureElements").map(String),
      automaticSignerUserId: String(formData.get("automaticSigner") ?? "") || null,
    });
  } catch (error) {
    if (!(error instanceof EmailBrandingInvalidError)) throw error;
    const messages: Record<EmailBrandingInvalidError["fields"][number], string> = {
      font: t("errorFont"),
      footerLine: t("errorFooterLine", { max: EMAIL_FOOTER_LINE_MAX }),
      senderName: t("errorSenderName", { max: EMAIL_SENDER_NAME_MAX }),
      signatureElements: t("errorElements"),
      automaticSigner: t("errorAutomaticSigner"),
    };
    return { errors: error.fields.map((field) => messages[field]), at: Date.now() };
  }
  revalidatePath("/parametres/emails", "layout");
  return { saved: true, at: Date.now() };
}
