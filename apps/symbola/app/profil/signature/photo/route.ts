// Lot 66c (HUB-18 ; D5 ; ADR 0113) — la photo de sa signature.
// GET : servie par l'app à la personne elle-même après contrôle de la session (ADR 0027) ; jamais
// d'identifiant dans l'adresse (« v » ne sert qu'à rafraîchir le cache). Les destinataires la reçoivent
// en pièce jointe de l'e-mail, pas par cette adresse.
// POST : envoi par la route dédiée aux fichiers (L16-SEC-02, lib/uploads), contrôlé comme le logo.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isStorageFullError, storageFullMessage } from "@/lib/storage-full";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { loadSignaturePhoto, SIGNATURE_PHOTO_MAX_SIZE_BYTES, SignaturePhotoUploadError, uploadSignaturePhoto } from "@/modules/hub/service";

const PHOTO_BODY_MAX_BYTES = SIGNATURE_PHOTO_MAX_SIZE_BYTES + 64 * 1024;

export async function GET(): Promise<Response> {
  const auth = await getPlannerAuthContext({ allowReadOnly: true });
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const photo = await loadSignaturePhoto(auth.user.organizationId, auth.user.id);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), { headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request): Promise<Response> {
  const received = await receiveUpload(request, PHOTO_BODY_MAX_BYTES);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("MySignature");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("photoMissing") });
  try {
    await uploadSignaturePhoto(user.organizationId, user.id, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (isStorageFullError(error)) return uploadResponse({ error: await storageFullMessage() });
    if (error instanceof SignaturePhotoUploadError) {
      if (error.reason === "storage_full") return uploadResponse({ error: await storageFullMessage() });
      if (error.reason === "too_large") return uploadResponse({ error: t("photoTooLarge") });
      if (error.reason === "unsupported_type") return uploadResponse({ error: t("photoUnsupported") });
      return uploadResponse({ error: t("photoInfected") });
    }
    throw error;
  }
  revalidatePath("/profil/signature");
  return uploadResponse({ success: true });
}
