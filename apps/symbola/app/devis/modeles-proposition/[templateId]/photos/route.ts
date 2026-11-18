// Lot 43 (FAC-02, D2 ; SEC-21, L16-SEC-02) — envoi d'une photo du modèle de proposition par la route
// dédiée aux fichiers : même origine, session de l'équipe, débit, taille ; type lu dans le contenu
// (PNG, JPEG), antivirus, stockage privé ; trois photos au plus.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { addProposalTemplatePhoto, PROPOSAL_PHOTO_MAX_BYTES, ProposalPhotoError } from "@/modules/quotes/service";
import { isQuotesModuleEnabled, isValidId } from "../../../module-access";

export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }): Promise<Response> {
  const received = await receiveUpload(request, PROPOSAL_PHOTO_MAX_BYTES + 64 * 1024);
  if (!received.ok) return received.response;
  const t = await getTranslations("ProposalTemplates");
  const { templateId } = await params;
  if (!isValidId(templateId) || !(await isQuotesModuleEnabled(received.user.organizationId))) return uploadResponse({ error: t("photoErrors.not_found") }, 404);
  const file = received.formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("photoErrors.missing") });
  try {
    await addProposalTemplatePhoto(received.user.organizationId, templateId, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof ProposalPhotoError) return uploadResponse({ error: t(`photoErrors.${error.reason}`) });
    throw error;
  }
  revalidatePath("/devis/modeles-proposition");
  return uploadResponse({ success: true });
}
