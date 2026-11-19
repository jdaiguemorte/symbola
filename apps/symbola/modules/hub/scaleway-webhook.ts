// Lot 55 (MSG-05, SEC-19 ; D2 : Scaleway Transactional Email, choix de Julien du 19/11/2026 ; ADR 0102) —
// adaptateur du webhook de remise de Scaleway TEM. TEM publie ses évènements dans un sujet de Topics and
// Events (compatible SNS), qui les pousse en HTTPS. Chaque message est vérifié, sans dépendance
// (node:crypto) :
// 1. enveloppe SNS lue et validée (Zod) ; sujet (TopicArn) dans la liste réglée, sinon refus ;
// 2. message frais : pas plus de 6 heures (reprises de Scaleway) ni de 5 minutes dans le futur ;
// 3. certificat de signature pris seulement sur messaging.s3.<région>.scw.cloud, au nom
//    sns.mnq.<région>.scaleway.com, en cours de validité, signé par un intermédiaire de la chaîne de
//    Scaleway (même hôte), lui-même signé par la racine épinglée (scaleway-sns-root.ts) ;
// 4. signature RSA (SHA-1 pour la version 1, SHA-256 pour la version 2) de la chaîne canonique SNS ;
// 5. une demande d'abonnement est confirmée (GET de SubscribeURL, seulement sur sns.mnq.<région>.
//    scaleway.com) ; une notification est traduite en statuts. L'e-mail est retrouvé par l'en-tête
//    X-Symbola-Delivery qu'il porte (recopié par TEM dans email_headers), sinon par son Message-ID.
// Les certificats téléchargés sont gardés en mémoire (clé : leur adresse), dix au plus.
import { createVerify, X509Certificate } from "node:crypto";
import { z } from "zod";
import type { EmailBounceReason, EmailDeliveryEvent } from "@symbola/contracts";
import type { EmailDeliveryWebhookAdapter, WebhookVerification } from "./delivery-webhooks";
import { SCALEWAY_SNS_ROOT_PEM } from "./scaleway-sns-root";

export const SCALEWAY_REGIONS = ["fr-par", "nl-ams", "pl-waw"] as const;
const CERT_URL = /^https:\/\/messaging\.s3\.(fr-par|nl-ams|pl-waw)\.scw\.cloud\/(fr-par|nl-ams|pl-waw)\/sns\/sns_certificate_[0-9a-f]+\.pem$/;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_SKEW_MS = 5 * 60 * 1000;
const MAX_CACHED = 10;
const FETCH_TIMEOUT_MS = 5000;
const MAX_PEM_BYTES = 64 * 1024;
export const DELIVERY_HEADER = "X-Symbola-Delivery";

const envelopeSchema = z.object({
  Type: z.enum(["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"]),
  MessageId: z.string().min(1).max(200),
  TopicArn: z.string().min(1).max(500),
  Message: z.string().max(256 * 1024),
  Timestamp: z.string().datetime({ offset: true }),
  SignatureVersion: z.enum(["1", "2"]),
  Signature: z.string().min(1).max(2048),
  SigningCertURL: z.string().max(500),
  Subject: z.string().max(500).optional(),
  SubscribeURL: z.string().max(2000).optional(),
  Token: z.string().max(2000).optional(),
});
type Envelope = z.infer<typeof envelopeSchema>;

const eventSchema = z.object({
  type: z.string().max(100),
  email_headers: z.array(z.object({ key: z.string().max(200), value: z.string().max(2000) })).max(200).nullish(),
  blocklist_type: z.string().max(100).nullish(),
  created_at: z.string().max(100).nullish(),
});

// Chaîne signée (format SNS) : les champs dans cet ordre, « clé\nvaleur\n », les absents omis.
const NOTIFICATION_KEYS = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"] as const;
const SUBSCRIPTION_KEYS = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"] as const;

export function snsStringToSign(envelope: Envelope): string {
  const keys = envelope.Type === "Notification" ? NOTIFICATION_KEYS : SUBSCRIPTION_KEYS;
  return keys
    .filter((key) => envelope[key] !== undefined)
    .map((key) => `${key}\n${envelope[key]}\n`)
    .join("");
}

// Évènement de TEM → statut du journal ; les autres (mise en file, report) ne changent rien.
export function scalewayStatus(type: string, blocklistType: string | null | undefined): { status: EmailDeliveryEvent["status"]; reason: EmailBounceReason | null } | null {
  switch (type) {
    case "email_delivered":
      return { status: "delivered", reason: null };
    case "email_mailbox_not_found":
      return { status: "bounced", reason: "mailbox_not_found" };
    case "email_blocklisted":
      return { status: "bounced", reason: blocklistType === "mailbox_full" ? "mailbox_full" : blocklistType === "mailbox_not_found" ? "mailbox_not_found" : "blocked" };
    case "email_dropped":
      return { status: "bounced", reason: "other" };
    case "email_spam":
      return { status: "complained", reason: "spam_complaint" };
    default:
      return null;
  }
}

export function deliveryReferenceFromHeaders(headers: { key: string; value: string }[]): string | null {
  const find = (name: string) => headers.find((header) => header.key.trim().toLowerCase() === name)?.value.trim() ?? null;
  return find(DELIVERY_HEADER.toLowerCase()) ?? find("message-id");
}

export type ScalewayAdapterOptions = {
  // Sujets autorisés (TopicArn), réglés par EMAIL_DELIVERY_WEBHOOK_TOPIC_ARN.
  topicArns: string[];
  // Racine de confiance (tests : une racine de test) ; par défaut, celle de Scaleway.
  trustedRootPem?: string;
  // Téléchargement d'un PEM et confirmation d'abonnement (tests : des doubles, sans réseau).
  fetchText?: (url: string) => Promise<string>;
  confirmSubscription?: (url: string) => Promise<void>;
};

async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`téléchargement refusé (${response.status})`);
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_PEM_BYTES) throw new Error("certificat trop lourd");
  return text;
}

async function defaultConfirm(url: string): Promise<void> {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`confirmation refusée (${response.status})`);
}

function certificatesOf(pem: string): X509Certificate[] {
  return (pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []).map((block) => new X509Certificate(block));
}

function validAt(certificate: X509Certificate, now: Date): boolean {
  return now >= new Date(certificate.validFrom) && now <= new Date(certificate.validTo);
}

function commonName(certificate: X509Certificate): string | null {
  return /(?:^|\n)CN=([^\n]+)/.exec(certificate.subject)?.[1]?.trim() ?? null;
}

export function scalewayWebhookAdapter(options: ScalewayAdapterOptions): EmailDeliveryWebhookAdapter {
  const fetchText = options.fetchText ?? defaultFetchText;
  const confirm = options.confirmSubscription ?? defaultConfirm;
  const root = certificatesOf(options.trustedRootPem ?? SCALEWAY_SNS_ROOT_PEM)[0];
  const cache = new Map<string, X509Certificate>();

  // Le certificat de signature, s'il descend de la racine épinglée par un intermédiaire de Scaleway.
  async function signingCertificate(url: string, region: string, now: Date): Promise<X509Certificate | null> {
    const cached = cache.get(url);
    if (cached && validAt(cached, now)) return cached;
    if (!root) return null;
    const [leaf] = certificatesOf(await fetchText(url));
    const chain = certificatesOf(await fetchText(`https://messaging.s3.${region}.scw.cloud/${region}/sns/sns-trust-chain.pem`));
    const intermediates = chain.filter((certificate) => certificate.ca && certificate.checkIssued(root) && certificate.verify(root.publicKey) && validAt(certificate, now));
    if (!leaf || commonName(leaf) !== `sns.mnq.${region}.scaleway.com` || !validAt(leaf, now)) return null;
    if (!intermediates.some((intermediate) => leaf.checkIssued(intermediate) && leaf.verify(intermediate.publicKey))) return null;
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(url, leaf);
    return leaf;
  }

  return {
    name: "scaleway",
    async verify(_headers, rawBody, now): Promise<WebhookVerification> {
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return { ok: false, reason: "payload_invalid" };
      }
      if (json && typeof json === "object" && !("Signature" in json)) return { ok: false, reason: "signature_missing" };
      const parsed = envelopeSchema.safeParse(json);
      if (!parsed.success) return { ok: false, reason: "payload_invalid" };
      const envelope = parsed.data;
      if (!options.topicArns.includes(envelope.TopicArn)) return { ok: false, reason: "topic_unknown" };
      const sentAt = new Date(envelope.Timestamp).getTime();
      if (sentAt > now.getTime() + MAX_SKEW_MS || sentAt < now.getTime() - MAX_AGE_MS) return { ok: false, reason: "signature_expired" };
      const match = CERT_URL.exec(envelope.SigningCertURL);
      if (!match || match[1] !== match[2]) return { ok: false, reason: "certificate_invalid" };
      const region = match[1]!;
      let certificate: X509Certificate | null;
      try {
        certificate = await signingCertificate(envelope.SigningCertURL, region, now);
      } catch {
        return { ok: false, reason: "certificate_invalid" };
      }
      if (!certificate) return { ok: false, reason: "certificate_invalid" };
      const verifier = createVerify(envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1");
      verifier.update(snsStringToSign(envelope), "utf8");
      if (!verifier.verify(certificate.publicKey, Buffer.from(envelope.Signature, "base64"))) return { ok: false, reason: "signature_invalid" };

      if (envelope.Type === "SubscriptionConfirmation") {
        const subscribe = envelope.SubscribeURL ?? "";
        let host: string | null = null;
        try {
          const url = new URL(subscribe);
          host = url.protocol === "https:" && !url.username && !url.password && !url.port ? url.hostname : null;
        } catch {
          host = null;
        }
        if (host !== `sns.mnq.${region}.scaleway.com`) return { ok: false, reason: "payload_invalid" };
        await confirm(subscribe);
        return { ok: true, events: [], note: "subscription_confirmed" };
      }
      if (envelope.Type !== "Notification") return { ok: true, events: [] };

      let message: unknown;
      try {
        message = JSON.parse(envelope.Message);
      } catch {
        return { ok: false, reason: "payload_invalid" };
      }
      const event = eventSchema.safeParse(message);
      if (!event.success) return { ok: false, reason: "payload_invalid" };
      const status = scalewayStatus(event.data.type, event.data.blocklist_type);
      const reference = deliveryReferenceFromHeaders(event.data.email_headers ?? []);
      if (!status || !reference) return { ok: true, events: [] };
      const occurredAt = event.data.created_at && !Number.isNaN(Date.parse(event.data.created_at)) ? new Date(event.data.created_at) : new Date(sentAt);
      return { ok: true, events: [{ reference, status: status.status, reason: status.reason, occurredAt }] };
    },
  };
}
