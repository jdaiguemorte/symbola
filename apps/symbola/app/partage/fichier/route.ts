// Lot 37a (DOC-04, SEC-17 ; D7 ; ADR 0070) — ouverture d'un lien de partage : le jeton arrive en
// POST depuis la page /partage (même origine), jamais dans l'adresse. Débit limité par adresse IP
// et par organisation (SEC-04). Lien valable : son document seul, affiché (PDF ou image) ou
// téléchargé, l'ouverture comptée et portée au fil de l'évènement. Inconnu, expiré ou révoqué :
// retour à la page, qui le dit sans rien révéler, ni nom de fichier ni évènement.
import { z } from "zod";
import { openEventDocumentLink } from "@/modules/events/service";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { fileDownloadResponse, isPreviewableMime } from "@/lib/file-response";
import { isSameOrigin } from "@/lib/uploads/receive";

const formSchema = z.object({ token: z.string().max(200), mode: z.enum(["apercu", "telecharger"]) });

function invalid(request: Request): Response {
  return Response.redirect(new URL("/partage?lien=invalide", request.url), 303);
}

// La page /partage est servie sans référent (Referrer-Policy: no-referrer) : son formulaire part avec
// « Origin: null ». Le navigateur dit alors lui-même d'où vient l'envoi (Sec-Fetch-Site, qu'une page
// ne peut pas forger).
function fromThisSite(headers: Headers): boolean {
  return isSameOrigin(headers) || headers.get("sec-fetch-site") === "same-origin";
}

export async function POST(request: Request): Promise<Response> {
  if (!fromThisSite(request.headers)) return new Response(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const parsed = formSchema.safeParse({ token: form?.get("token"), mode: form?.get("mode") });
  if (!parsed.success) return invalid(request);
  const organizationId = parsed.data.token.split(".")[0] ?? "";
  const limit = await checkRateLimit("linkOpen", { account: z.uuid().safeParse(organizationId).success ? organizationId : null, headers: request.headers });
  if (!limit.allowed) return rateLimitedResponse(limit);
  const opened = await openEventDocumentLink(parsed.data.token);
  if (!opened) return invalid(request);
  const response = fileDownloadResponse(await opened.file(), { inline: parsed.data.mode === "apercu" && isPreviewableMime(opened.mime) });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
