// Lot 52 (SEC-08, SEC-19 ; D6 ; ADR 0094) — webhook du fournisseur d'identité (changement d'adresse, de
// facteur ou de mot de passe). Authentifié par sa signature, jamais par une session ; 401 et journal
// si elle manque ou ne correspond pas. Corps lu brut, limité en taille.
import { IDENTITY_WEBHOOK_MAX_BYTES } from "@symbola/auth";
import { sendIdentityAlert } from "@/lib/account-alerts";
import { accountCenterUrl, identityFactorsFingerprint, identityWebhookSigningKey } from "@/lib/identity";
import { handleIdentityWebhook } from "@/lib/identity-webhook";

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? "0") > IDENTITY_WEBHOOK_MAX_BYTES) return new Response(null, { status: 413 });
  const rawBody = await request.text();
  const result = await handleIdentityWebhook(
    { headers: request.headers, rawBody },
    { signingKey: identityWebhookSigningKey, factorsFingerprint: identityFactorsFingerprint, sendAlert: (alert) => sendIdentityAlert(alert, accountCenterUrl()) },
  );
  return new Response(null, { status: result.status });
}
