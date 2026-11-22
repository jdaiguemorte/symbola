"use server";

// Lot 66c (HUB-18 ; D5 ; ADR 0113) — Mon compte › Ma signature : enregistrer sa signature, retirer sa
// photo. La personne est toujours celle de la session : aucun identifiant de compte n'est lu dans le
// formulaire (un membre ne modifie que sa signature ; la base le garantit aussi, migration 0209).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { SIGNATURE_LINKS_MAX } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import { MemberSignatureInvalidError, removeSignaturePhoto, saveMemberSignature, SIGNATURE_TEXT_MAX, type MemberSignatureField } from "@/modules/hub/service";

export type SignatureFormState = { saved?: boolean; errors?: string[]; fields?: MemberSignatureField[]; at?: number };

export async function saveMySignatureAction(_state: SignatureFormState, formData: FormData): Promise<SignatureFormState> {
  const auth = await requirePlanner();
  const t = await getTranslations("MySignature");
  const text = (name: string) => String(formData.get(name) ?? "");
  const links = Array.from({ length: SIGNATURE_LINKS_MAX }, (_, index) => ({ label: text(`linkLabel${index}`), url: text(`linkUrl${index}`) }));
  try {
    await saveMemberSignature(auth.user.organizationId, auth.user.id, { displayName: text("displayName"), jobTitle: text("jobTitle"), phone: text("phone"), website: text("website"), links });
  } catch (error) {
    if (!(error instanceof MemberSignatureInvalidError)) throw error;
    const messages: Record<MemberSignatureField, string> = {
      displayName: t("errorDisplayName", { max: SIGNATURE_TEXT_MAX }),
      jobTitle: t("errorJobTitle", { max: SIGNATURE_TEXT_MAX }),
      phone: t("errorPhone"),
      website: t("errorWebsite"),
      links: t("errorLinks", { max: SIGNATURE_LINKS_MAX }),
    };
    return { errors: error.fields.map((field) => messages[field]), fields: error.fields, at: Date.now() };
  }
  revalidatePath("/profil/signature");
  return { saved: true, at: Date.now() };
}

export async function removeMySignaturePhotoAction(): Promise<void> {
  const auth = await requirePlanner();
  await removeSignaturePhoto(auth.user.organizationId, auth.user.id);
  revalidatePath("/profil/signature");
}
