// Lot 45 (CRM-05 ; D1 ; ADR 0090) — la brochure de l'organisation (un PDF), envoyée par la route dédiée
// aux fichiers (L16-SEC-02, lib/uploads) : type vérifié par le contenu, antivirus, taille limitée,
// stockage privé. La personne de l'équipe doit avoir le module Évènements ouvert. Elle n'est jamais
// servie par une adresse : un message la joint par un lien sécurisé (/partage), valable 30 jours.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { starterProspectFollowUps } from "@symbola/starter-templates";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { BrochureRejectedError, saveProspectBrochure } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";

export async function POST(request: Request): Promise<Response> {
  const received = await receiveUpload(request, starterProspectFollowUps().brochureMaxSizeBytes + 64 * 1024);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("FollowUpSettings");
  if (!(await isEventsModuleEnabled(user.organizationId))) return uploadResponse({ error: t("refused") }, 403);
  const file = formData.get("brochure");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("brochureMissing") });
  try {
    await saveProspectBrochure(user.organizationId, { content: new Uint8Array(await file.arrayBuffer()), fileName: file.name || "brochure.pdf" });
  } catch (error) {
    if (error instanceof BrochureRejectedError) return uploadResponse({ error: t(`brochureRejected.${error.reason}`) });
    throw error;
  }
  revalidatePath("/parametres/relances");
  return uploadResponse({ success: true });
}
