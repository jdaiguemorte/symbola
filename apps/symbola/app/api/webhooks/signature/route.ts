// DEV-02, ADR 0021 — webhook du fournisseur de signature. Authentifié par le
// fournisseur (secret partagé), jamais par la session ; 401 et journal si
// l'appel n'est pas authentifié valablement. Corps lu brut, limité en taille.
import { handleSignatureWebhook } from "@/modules/quotes/service";

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const result = await handleSignatureWebhook({ headers: request.headers, rawBody });
  return new Response(null, { status: result.httpStatus });
}
