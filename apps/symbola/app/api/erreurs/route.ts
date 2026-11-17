// Lot 40b (Q27, NFR-16 ; décision D14, ADR 0077) — relais des erreurs du navigateur vers le suivi
// des erreurs : même origine (aucune adresse de plus dans la politique de sécurité du contenu, et le
// service de suivi reste hors d'internet), débit limité par adresse IP, taille bornée ; l'app refait
// le tri des champs (lib/error-tracking.ts). Rien n'est gardé ici. 204 quand c'est relayé ou ignoré.
import { z } from "zod";
import { reportError } from "@/lib/error-tracking";
import { ERROR_REFERENCE } from "@/lib/error-reference";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/uploads/receive";

const MAX_BODY = 16_384;

const reportSchema = z.object({
  reference: z.string().regex(ERROR_REFERENCE),
  name: z.string().max(100),
  stack: z.string().max(12_000).nullish(),
  route: z.string().max(300).nullish(),
});

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request.headers)) return new Response(null, { status: 403 });
  const decision = await checkRateLimit("errorReport", { account: null, headers: request.headers });
  // Le navigateur n'affiche rien de cette réponse : pas de message traduit.
  if (!decision.allowed) return new Response(null, { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store" } });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response(null, { status: 413 });
  let parsed: z.infer<typeof reportSchema>;
  try {
    parsed = reportSchema.parse(JSON.parse(body));
  } catch {
    return new Response(null, { status: 400 });
  }
  await reportError({ reference: parsed.reference, name: parsed.name, stack: parsed.stack ?? null, route: parsed.route ?? null, source: "navigateur", release: process.env.APP_VERSION ?? "dev" });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
