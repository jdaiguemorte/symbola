// Lot 55 (MSG-05, SEC-19 ; D2 ; ADR 0101) — webhook de remise du service d'envoi. Authentifié par la
// signature de son corps (adaptateur du service, hub), jamais par la session ; 401 et journal (motif
// seulement) si la signature manque, est fausse ou trop ancienne. Corps lu brut, limité en taille.
import { handleEmailDeliveryWebhook } from "@/modules/hub/service";

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const result = await handleEmailDeliveryWebhook({ headers: request.headers, rawBody });
  return new Response(null, { status: result.httpStatus });
}
