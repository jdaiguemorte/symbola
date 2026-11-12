// Lot 26a (UX-11) — logo de l'organisation d'un lien personnel, pour l'en-tête
// du portail ; l'organisation est celle de la session de lien, jamais un
// identifiant de l'adresse (« v » ne sert qu'à rafraîchir le cache).
import { currentLinkAccess } from "@/lib/link-session";
import { organizationLogoResponse } from "@/app/logo/logo-response";

export async function GET(): Promise<Response> {
  const access = await currentLinkAccess();
  if (!access) return new Response(null, { status: 404 });
  return organizationLogoResponse(access.organizationId);
}
