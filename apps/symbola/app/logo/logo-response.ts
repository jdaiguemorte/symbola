// Lot 17 (DEV-08, ADR 0046), lot 26a — envoi du logo d'une organisation, après
// le contrôle d'accès de la route appelante (/logo pour l'équipe, /portail/logo
// pour un lien personnel). Seuls PNG et JPEG, relus par leur contenu.
import { createStorageClient, detectFileType, getPrivateObject } from "@symbola/files";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile } from "@/modules/hub/service";

export async function organizationLogoResponse(organizationId: string): Promise<Response> {
  const profile = await getOrganizationProfile(appDatabase(), organizationId);
  if (!profile.logoKey) return new Response(null, { status: 404 });
  try {
    const data = await getPrivateObject(createStorageClient(), profile.logoKey);
    const mime = detectFileType(data)?.mime;
    if (mime !== "image/png" && mime !== "image/jpeg") return new Response(null, { status: 404 });
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.warn(`logo illisible pour l'organisation ${organizationId}`);
    return new Response(null, { status: 404 });
  }
}
