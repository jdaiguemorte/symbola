// Lot 53 (ARC-09, HUB-15 ; D4 ; ADR 0095, ADR 0096) — envoi Web Push derrière une interface. Chiffrer un
// message Web Push (RFC 8291) et signer la demande (VAPID, RFC 8292) est de la cryptographie : jamais
// écrite ici (CLAUDE.md § 2.7), la bibliothèque web-push s'en charge. Les services de push des
// navigateurs (Apple, Google, Mozilla) ne reçoivent qu'un message chiffré, son heure et sa durée de vie.
// Les tests remplacent l'envoyeur (setPushSender) : aucun appel réseau.
import webpush from "web-push";
import { parseEnv } from "@symbola/env";
import type { PushMessage } from "@symbola/contracts";

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
// gone : le service dit que l'abonnement n'existe plus (404, 410) ; failed : autre échec, réessayé
// avec la notification suivante.
export type PushOutcome = "sent" | "gone" | "failed";
export type PushSender = { send(target: PushTarget, message: PushMessage): Promise<PushOutcome> };

// Un push vaut quelques heures : passé ce délai, le service de push l'abandonne.
const TIME_TO_LIVE_SECONDS = 6 * 60 * 60;
const TIMEOUT_MS = 10_000;

export const webPushSender: PushSender = {
  async send(target, message) {
    const env = parseEnv(process.env);
    try {
      await webpush.sendNotification(target, JSON.stringify(message), {
        TTL: TIME_TO_LIVE_SECONDS,
        timeout: TIMEOUT_MS,
        urgency: "normal",
        vapidDetails: { subject: env.APP_PUBLIC_URL.startsWith("https://") ? env.APP_PUBLIC_URL : "mailto:exploitation@symbola.invalid", publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
      });
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      // Ni l'adresse du service ni le message : le code seulement (SEC-20).
      console.error("push non envoyé", status ?? (error instanceof Error ? error.name : "inconnue"));
      return "failed";
    }
  },
};

let current: PushSender = webPushSender;

export function getPushSender(): PushSender {
  return current;
}

// Tests seulement : un faux envoyeur qui note ce qu'il reçoit.
export function setPushSender(sender: PushSender | null): void {
  current = sender ?? webPushSender;
}
