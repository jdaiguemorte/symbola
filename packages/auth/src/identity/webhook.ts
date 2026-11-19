// Lot 52 (SEC-08, SEC-19 ; D6 ; ADR 0094) — appels du webhook du fournisseur d'identité. Chaque appel
// porte l'en-tête « logto-signature-sha-256 » : le HMAC-SHA256 du corps reçu, avec la clé de signature
// du webhook. Un appel sans signature, ou mal signé, est refusé (et journalisé par l'appelant) avant
// toute lecture du corps. Comparaison à temps constant. Aucun contrôle cryptographique écrit à la main
// au-delà du HMAC de Node (SEC-01).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const IDENTITY_WEBHOOK_SIGNATURE_HEADER = "logto-signature-sha-256";
// Un appel reste petit (un compte) ; au-delà, refus sans lecture.
export const IDENTITY_WEBHOOK_MAX_BYTES = 64 * 1024;

export function signIdentityWebhook(rawBody: string, signingKey: string): string {
  return createHmac("sha256", signingKey).update(rawBody).digest("hex");
}

export function isIdentityWebhookSigned(rawBody: string, signature: string | null | undefined, signingKey: string | null | undefined): boolean {
  if (!signature || !signingKey || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signIdentityWebhook(rawBody, signingKey), "hex");
  const received = Buffer.from(signature.toLowerCase(), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

const payloadSchema = z.object({
  event: z.string().min(1).max(100),
  data: z.object({ id: z.string().min(1).max(64), primaryEmail: z.string().email().max(254).nullable().optional() }).passthrough().nullable().optional(),
  userId: z.string().min(1).max(64).optional(),
  user: z.object({ id: z.string().min(1).max(64) }).passthrough().optional(),
});

export type IdentityWebhookEvent =
  | { kind: "data_updated"; subject: string; primaryEmail: string | null }
  | { kind: "password_reset"; subject: string }
  | { kind: "ignored" };

// Le sens d'un appel signé ; un événement inconnu ou sans compte est ignoré (réponse 204).
export function readIdentityWebhook(rawBody: string): IdentityWebhookEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return null;
  const payload = parsed.data;
  if (payload.event === "User.Data.Updated" && payload.data) return { kind: "data_updated", subject: payload.data.id, primaryEmail: payload.data.primaryEmail?.toLowerCase() ?? null };
  if (payload.event === "PostResetPassword") {
    const subject = payload.userId ?? payload.user?.id;
    return subject ? { kind: "password_reset", subject } : { kind: "ignored" };
  }
  return { kind: "ignored" };
}

// Clé d'idempotence d'un appel : le fournisseur rejoue le même corps quand il retente un envoi.
export function identityWebhookDeliveryKey(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

// Empreinte des facteurs d'un compte (nature et identifiant, triés, hachés) : un facteur ajouté ou
// retiré la change ; aucune donnée du facteur n'est gardée.
export function mfaFactorsFingerprint(factors: { id: string; type: string }[]): string {
  const canonical = factors
    .map((factor) => `${factor.type}:${factor.id}`)
    .sort()
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
