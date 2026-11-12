// Lot 17 (DEV-08, ADR 0046) — logo de l'organisation.
// GET : servi par l'app après contrôle de la session (ADR 0027), à l'équipe
// de l'organisation (lot 26a : les tiers passent par /portail/logo) ; jamais d'identifiant dans l'adresse,
// l'organisation est celle de la session (« v » ne sert qu'à rafraîchir le
// cache après un remplacement).
// POST : envoi par la route dédiée aux fichiers (L16-SEC-02, lib/uploads).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { isPlannerRole } from "@symbola/auth";
import { getAuthContext } from "@/lib/auth-context";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { LOGO_MAX_SIZE_BYTES, LogoUploadError, uploadOrganizationLogo } from "@/modules/hub/service";
import { organizationLogoResponse } from "./logo-response";

// Le fichier et la place des autres champs du formulaire.
const LOGO_BODY_MAX_BYTES = LOGO_MAX_SIZE_BYTES + 64 * 1024;

export async function GET(): Promise<Response> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  if (!isPlannerRole(auth.user.role)) return new Response(null, { status: 403 });
  return organizationLogoResponse(auth.user.organizationId);
}

export async function POST(request: Request): Promise<Response> {
  const received = await receiveUpload(request, LOGO_BODY_MAX_BYTES);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("Documents");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("logoMissing") });
  try {
    await uploadOrganizationLogo(appDatabase(), user.organizationId, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof LogoUploadError) {
      if (error.reason === "too_large") return uploadResponse({ error: t("logoTooLarge") });
      if (error.reason === "unsupported_type") return uploadResponse({ error: t("logoUnsupported") });
      return uploadResponse({ error: t("logoInfected") });
    }
    throw error;
  }
  revalidatePath("/parametres");
  revalidatePath("/devis/parametres/documents");
  return uploadResponse({ success: true });
}
