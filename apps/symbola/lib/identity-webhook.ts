// Lot 52 (SEC-08, SEC-19 ; D6 ; ADR 0094) — réception du webhook du fournisseur d'identité. L'appel est
// authentifié par sa signature (HMAC du corps avec la clé du webhook, lue par l'API d'administration) :
// sans signature, ou mal signé, il est refusé (401) et journalisé, sans lire le compte. Signé, il dit
// qu'un compte a changé : adresse (l'alerte part à l'ancienne), facteur d'authentification (l'empreinte
// des facteurs, relue chez le fournisseur, a changé) ou mot de passe réinitialisé. La réponse ne dit
// jamais si le compte existe chez Symbola.
import { identityWebhookDeliveryKey, IDENTITY_WEBHOOK_MAX_BYTES, IDENTITY_WEBHOOK_SIGNATURE_HEADER, isIdentityWebhookSigned, readIdentityWebhook, recordIdentityChange, type IdentityAlert } from "@symbola/auth";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";

export type IdentityWebhookDeps = {
  // La clé de signature du webhook ; refresh : relue chez le fournisseur (clé changée).
  signingKey: (options: { refresh: boolean }) => Promise<string | null>;
  // L'empreinte des facteurs du compte chez le fournisseur ; null si elle ne peut être lue.
  factorsFingerprint: (subject: string) => Promise<string | null>;
  sendAlert: (alert: IdentityAlert) => Promise<boolean>;
};

async function refuse(reason: "unsigned" | "bad_signature" | "invalid"): Promise<{ status: number }> {
  console.error("webhook du fournisseur d'identité refusé", reason);
  await recordAudit(appDatabase(), { organizationId: null, action: "hub.identity_webhook.refused", objectId: null, details: { reason }, actor: { kind: "system", id: null } });
  return { status: 401 };
}

export async function handleIdentityWebhook(input: { headers: Headers; rawBody: string }, deps: IdentityWebhookDeps): Promise<{ status: number }> {
  if (Buffer.byteLength(input.rawBody) > IDENTITY_WEBHOOK_MAX_BYTES) return { status: 413 };
  const signature = input.headers.get(IDENTITY_WEBHOOK_SIGNATURE_HEADER);
  if (!signature) return refuse("unsigned");
  let signed = isIdentityWebhookSigned(input.rawBody, signature, await deps.signingKey({ refresh: false }));
  if (!signed) signed = isIdentityWebhookSigned(input.rawBody, signature, await deps.signingKey({ refresh: true }));
  if (!signed) return refuse("bad_signature");
  const event = readIdentityWebhook(input.rawBody);
  if (!event) return refuse("invalid");
  if (event.kind === "ignored") return { status: 204 };
  const deliveryKey = identityWebhookDeliveryKey(input.rawBody);
  const alerts =
    event.kind === "password_reset"
      ? await recordIdentityChange(appDatabase(), { deliveryKey, subject: event.subject, kind: "password_reset" })
      : await recordIdentityChange(appDatabase(), { deliveryKey, subject: event.subject, kind: "data_updated", primaryEmail: event.primaryEmail, factorsFingerprint: await deps.factorsFingerprint(event.subject) });
  for (const alert of alerts) await deps.sendAlert(alert);
  return { status: 204 };
}
