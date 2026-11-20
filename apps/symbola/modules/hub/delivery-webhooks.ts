// Lot 55 (MSG-05, SEC-19 ; D2 ; ADR 0102) — webhooks de remise du service d'envoi, derrière une
// interface : chaque adaptateur vérifie la signature de l'appel et le traduit en statuts (remis,
// rejeté, plainte). Changer de service = écrire un adaptateur. Le lot livre l'adaptateur « simulé »
// (tests et développement, interdit en production) ; celui du service choisi par Julien suit.
//
// Adaptateur simulé : en-tête « x-symbola-signature: t=<secondes>,v1=<hex> », HMAC-SHA256 (node:crypto,
// jamais de cryptographie écrite ici) de « <t>.<corps brut> » avec le secret ; refusé hors d'une
// fenêtre de cinq minutes (anti-rejeu). Corps : { events: [{ reference, status, reason?, occurred_at }] }.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseEnv } from "@symbola/env";
import { EMAIL_BOUNCE_REASONS, type EmailDeliveryEvent } from "@symbola/contracts";
import { scalewayWebhookAdapter } from "./scaleway-webhook";

// Lot 55 (ADR 0102) : Scaleway ajoute deux refus (sujet inconnu, certificat non digne de confiance) et
// la confirmation d'un abonnement (aucun statut, une note).
export type WebhookRejection = "signature_missing" | "signature_invalid" | "signature_expired" | "payload_invalid" | "topic_unknown" | "certificate_invalid";
export type WebhookVerification = { ok: true; events: EmailDeliveryEvent[]; note?: "subscription_confirmed" } | { ok: false; reason: WebhookRejection };

export interface EmailDeliveryWebhookAdapter {
  readonly name: string;
  verify(headers: Headers, rawBody: string, now: Date): Promise<WebhookVerification>;
}

export const SIMULATED_SIGNATURE_HEADER = "x-symbola-signature";
const TOLERANCE_SECONDS = 300;
const MAX_EVENTS = 100;

const simulatedPayload = z.object({
  events: z
    .array(
      z.object({
        reference: z.string().min(1).max(300),
        status: z.enum(["delivered", "bounced", "complained"]),
        reason: z.enum(EMAIL_BOUNCE_REASONS).nullish(),
        occurred_at: z.string().datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(MAX_EVENTS),
});

function hmac(secret: string, timestamp: string, rawBody: string): Buffer {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
}

// Pour les tests et l'outil de développement : l'en-tête que le service simulé enverrait.
export function signSimulatedWebhook(secret: string, rawBody: string, now: Date = new Date()): string {
  const timestamp = String(Math.floor(now.getTime() / 1000));
  return `t=${timestamp},v1=${hmac(secret, timestamp, rawBody).toString("hex")}`;
}

export function simulatedWebhookAdapter(secret: string): EmailDeliveryWebhookAdapter {
  return {
    name: "simulated",
    async verify(headers, rawBody, now) {
      const header = headers.get(SIMULATED_SIGNATURE_HEADER);
      if (!header) return { ok: false, reason: "signature_missing" };
      const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2) as [string, string]));
      const timestamp = parts.t;
      const signature = parts.v1;
      if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return { ok: false, reason: "signature_invalid" };
      const expected = hmac(secret, timestamp, rawBody);
      const given = Buffer.from(signature, "hex");
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature_invalid" };
      if (Math.abs(now.getTime() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return { ok: false, reason: "signature_expired" };
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return { ok: false, reason: "payload_invalid" };
      }
      const parsed = simulatedPayload.safeParse(json);
      if (!parsed.success) return { ok: false, reason: "payload_invalid" };
      return {
        ok: true,
        events: parsed.data.events.map((event) => ({
          reference: event.reference,
          status: event.status,
          reason: event.status === "delivered" ? null : (event.reason ?? (event.status === "complained" ? "spam_complaint" : "other")),
          occurredAt: new Date(event.occurred_at),
        })),
      };
    },
  };
}

let configured: EmailDeliveryWebhookAdapter | null | undefined;

// L'adaptateur en service, d'après EMAIL_DELIVERY_WEBHOOK ; null : pas de webhook (le journal reste à
// « envoyé »). Un test peut en poser un autre (undefined : retour à l'environnement).
export function adapterFromEnv(env: { EMAIL_DELIVERY_WEBHOOK: "none" | "simulated" | "scaleway"; EMAIL_DELIVERY_WEBHOOK_SECRET: string; EMAIL_DELIVERY_WEBHOOK_TOPIC_ARN: string[] }): EmailDeliveryWebhookAdapter | null {
  if (env.EMAIL_DELIVERY_WEBHOOK === "simulated") return simulatedWebhookAdapter(env.EMAIL_DELIVERY_WEBHOOK_SECRET);
  // Scaleway Transactional Email (choix de Julien du 19/11/2026) : adaptateur gardé d'un appel à l'autre,
  // pour son cache de certificats.
  if (env.EMAIL_DELIVERY_WEBHOOK === "scaleway") {
    const key = env.EMAIL_DELIVERY_WEBHOOK_TOPIC_ARN.join(",");
    if (!scaleway || scaleway.key !== key) scaleway = { key, adapter: scalewayWebhookAdapter({ topicArns: env.EMAIL_DELIVERY_WEBHOOK_TOPIC_ARN }) };
    return scaleway.adapter;
  }
  return null;
}

let scaleway: { key: string; adapter: EmailDeliveryWebhookAdapter } | null = null;

export function currentDeliveryWebhookAdapter(): EmailDeliveryWebhookAdapter | null {
  if (configured !== undefined) return configured;
  return adapterFromEnv(parseEnv(process.env));
}

export function configureDeliveryWebhookAdapter(adapter: EmailDeliveryWebhookAdapter | null | undefined): void {
  configured = adapter;
}
