// Lot 55 (MSG-05, SEC-19 ; choix de Scaleway du 19/11/2026 ; ADR 0102) — adaptateur du webhook de
// Scaleway Transactional Email. Une autorité de test (racine, intermédiaire, certificat de signature)
// est fabriquée à chaque passage par openssl, dans un dossier temporaire : aucune clé privée dans le
// dépôt. Le réseau est remplacé par des doubles (téléchargement des certificats, confirmation).
import { createSign, X509Certificate } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCALEWAY_SNS_ROOT_PEM, SCALEWAY_SNS_ROOT_SHA256 } from "./scaleway-sns-root";
import { deliveryReferenceFromHeaders, scalewayStatus, scalewayWebhookAdapter, snsStringToSign } from "./scaleway-webhook";

const TOPIC = "arn:scw:sns:fr-par:project-11111111-1111-4111-8111-111111111111:tem-envois";
const CERT_URL = "https://messaging.s3.fr-par.scw.cloud/fr-par/sns/sns_certificate_0c099e58091dfc9a.pem";
const CHAIN_URL = "https://messaging.s3.fr-par.scw.cloud/fr-par/sns/sns-trust-chain.pem";
const REFERENCE = "22222222-2222-4222-8222-222222222222.33333333-3333-4333-8333-333333333333@envoi.symbola.fr";
// L'horloge du test : une minute après la fabrication des certificats (valables à partir de la seconde où
// openssl les signe).
let now = new Date();

let dir: string;
const pem: Record<string, string> = {};

function openssl(args: string[]) {
  execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
}

// Une clé et un certificat signé par l'émetteur donné (ou par lui-même).
function issue(name: string, subject: string, issuer: string | null, ca: boolean) {
  openssl(["genrsa", "-out", `${name}.key`, "2048"]);
  openssl(["req", "-new", "-key", `${name}.key`, "-subj", `/CN=${subject}`, "-out", `${name}.csr`]);
  writeFileSync(join(dir, `${name}.cnf`), ca ? "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n" : "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n");
  const signer = issuer ? ["-CA", `${issuer}.pem`, "-CAkey", `${issuer}.key`, "-CAcreateserial"] : ["-signkey", `${name}.key`];
  openssl(["x509", "-req", "-in", `${name}.csr`, ...signer, "-days", "365", "-sha256", "-extfile", `${name}.cnf`, "-out", `${name}.pem`]);
  pem[name] = readFileSync(join(dir, `${name}.pem`), "utf8");
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "symbola-sns-"));
  issue("root", "Test MnQ Root", null, true);
  issue("intermediate", "Test MnQ", "root", true);
  issue("leaf", "sns.mnq.fr-par.scaleway.com", "intermediate", false);
  issue("wrongName", "sns.mnq.nl-ams.scaleway.com", "intermediate", false);
  issue("rogueRoot", "Rogue Root", null, true);
  issue("rogueLeaf", "sns.mnq.fr-par.scaleway.com", "rogueRoot", false);
  now = new Date(Date.now() + 60_000);
  delivered.created_at = now.toISOString();
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Envelope = Record<string, string>;

function signed(envelope: Envelope, key = "leaf", version: "1" | "2" = "1"): Envelope {
  const full = { SignatureVersion: version, SigningCertURL: CERT_URL, ...envelope };
  const signer = createSign(version === "2" ? "RSA-SHA256" : "RSA-SHA1");
  signer.update(snsStringToSign(full as never), "utf8");
  return { ...full, Signature: signer.sign(readFileSync(join(dir, `${key}.key`), "utf8"), "base64") };
}

function notification(event: Record<string, unknown>, overrides: Envelope = {}): Envelope {
  return { Type: "Notification", MessageId: "m-1", TopicArn: TOPIC, Message: JSON.stringify(event), Timestamp: now.toISOString(), ...overrides };
}

const delivered: { id: string; type: string; email_id: string; created_at: string; email_headers: { key: string; value: string }[] } = { id: "e-1", type: "email_delivered", email_id: "tem-1", created_at: now.toISOString(), email_headers: [{ key: "Subject", value: "Nouveau message" }, { key: "X-Symbola-Delivery", value: REFERENCE }] };

function adapter(options: { leaf?: string; chain?: string } = {}) {
  const fetched: string[] = [];
  const confirmed: string[] = [];
  const instance = scalewayWebhookAdapter({
    topicArns: [TOPIC],
    trustedRootPem: pem.root!,
    fetchText: async (url) => {
      fetched.push(url);
      if (url === CERT_URL) return pem[options.leaf ?? "leaf"]!;
      if (url === CHAIN_URL) return options.chain ?? `${pem.root}\n${pem.intermediate}`;
      throw new Error("adresse inattendue");
    },
    confirmSubscription: async (url) => void confirmed.push(url),
  });
  return { instance, fetched, confirmed, verify: (body: Envelope | string) => instance.verify(new Headers(), typeof body === "string" ? body : JSON.stringify(body), now) };
}

describe("SEC-19 — Racine de confiance de Scaleway épinglée", () => {
  it("le certificat « Scaleway MnQ Root » du dépôt est le bon (empreinte), autosigné, valable jusqu'en 2032", () => {
    const root = new X509Certificate(SCALEWAY_SNS_ROOT_PEM);
    expect(root.fingerprint256).toBe(SCALEWAY_SNS_ROOT_SHA256);
    expect(root.subject).toBe("CN=Scaleway MnQ Root");
    expect(root.ca).toBe(true);
    expect(root.verify(root.publicKey)).toBe(true);
    expect(new Date(root.validTo).getUTCFullYear()).toBe(2032);
  });
});

describe("MSG-05 — Webhook de Scaleway Transactional Email (Topics and Events, signé)", () => {
  it("un évènement « remis » bien signé donne le statut de l'e-mail, retrouvé par son en-tête X-Symbola-Delivery", async () => {
    const { verify } = adapter();
    expect(await verify(signed(notification(delivered)))).toEqual({ ok: true, events: [{ reference: REFERENCE, status: "delivered", reason: null, occurredAt: new Date(delivered.created_at) }] });
  });

  it("signature version 2 (SHA-256) acceptée ; sans X-Symbola-Delivery, le Message-ID", async () => {
    const { verify } = adapter();
    const event = { ...delivered, type: "email_mailbox_not_found", email_headers: [{ key: "message-id", value: `<${REFERENCE}>` }] };
    const result = await verify(signed(notification(event), "leaf", "2"));
    expect(result).toMatchObject({ ok: true, events: [{ reference: `<${REFERENCE}>`, status: "bounced", reason: "mailbox_not_found" }] });
  });

  it("les évènements de TEM se traduisent en statuts ; la mise en file ou un report ne changent rien", async () => {
    expect(scalewayStatus("email_blocklisted", "mailbox_full")).toEqual({ status: "bounced", reason: "mailbox_full" });
    expect(scalewayStatus("email_blocklisted", null)).toEqual({ status: "bounced", reason: "blocked" });
    expect(scalewayStatus("email_dropped", null)).toEqual({ status: "bounced", reason: "other" });
    expect(scalewayStatus("email_spam", null)).toEqual({ status: "complained", reason: "spam_complaint" });
    expect(scalewayStatus("email_queued", null)).toBeNull();
    expect(scalewayStatus("email_deferred", null)).toBeNull();
    const { verify } = adapter();
    expect(await verify(signed(notification({ ...delivered, type: "email_queued" })))).toEqual({ ok: true, events: [] });
    expect(deliveryReferenceFromHeaders([{ key: "x-symbola-delivery", value: ` ${REFERENCE} ` }])).toBe(REFERENCE);
    expect(deliveryReferenceFromHeaders([])).toBeNull();
  });

  it("refus (journalisé par l'appelant) : sans signature, corps modifié, autre sujet, trop ancien ou du futur", async () => {
    const { verify, fetched } = adapter();
    const valid = signed(notification(delivered));
    const unsigned = { ...valid };
    delete unsigned.Signature;
    expect(await verify(unsigned)).toEqual({ ok: false, reason: "signature_missing" });
    expect(await verify({ ...valid, Message: JSON.stringify({ ...delivered, type: "email_spam" }) })).toEqual({ ok: false, reason: "signature_invalid" });
    expect(await verify(signed(notification(delivered, { TopicArn: "arn:scw:sns:fr-par:project-x:autre" })))).toEqual({ ok: false, reason: "topic_unknown" });
    expect(await verify(signed(notification(delivered, { Timestamp: new Date(now.getTime() - 7 * 3600_000).toISOString() })))).toEqual({ ok: false, reason: "signature_expired" });
    expect(await verify(signed(notification(delivered, { Timestamp: new Date(now.getTime() + 10 * 60_000).toISOString() })))).toEqual({ ok: false, reason: "signature_expired" });
    expect(await verify("pas du json")).toEqual({ ok: false, reason: "payload_invalid" });
    // Un seul téléchargement (le corps modifié) : rien pour un sujet inconnu ou un message hors délai.
    expect(fetched.filter((url) => url === CERT_URL)).toHaveLength(1);
  });

  it("certificat refusé : autre hôte (sans téléchargement), région incohérente, mauvais nom, chaîne d'une autre autorité", async () => {
    const other = adapter();
    expect(await other.verify(signed(notification(delivered), "leaf"))).toMatchObject({ ok: true });
    for (const url of ["https://evil.example/fr-par/sns/sns_certificate_ab.pem", "http://messaging.s3.fr-par.scw.cloud/fr-par/sns/sns_certificate_ab.pem", "https://messaging.s3.fr-par.scw.cloud/nl-ams/sns/sns_certificate_ab.pem"]) {
      const { verify, fetched } = adapter();
      expect(await verify(signed(notification(delivered, { SigningCertURL: url })))).toEqual({ ok: false, reason: "certificate_invalid" });
      expect(fetched).toEqual([]);
    }
    expect(await adapter({ leaf: "wrongName" }).verify(signed(notification(delivered), "wrongName"))).toEqual({ ok: false, reason: "certificate_invalid" });
    expect(await adapter({ leaf: "rogueLeaf" }).verify(signed(notification(delivered), "rogueLeaf"))).toEqual({ ok: false, reason: "certificate_invalid" });
    // Une chaîne téléchargée qui ne descend pas de la racine épinglée ne vaut rien.
    expect(await adapter({ leaf: "rogueLeaf", chain: pem.rogueRoot! }).verify(signed(notification(delivered), "rogueLeaf"))).toEqual({ ok: false, reason: "certificate_invalid" });
    // Le bon certificat, mais une signature faite par une autre clé.
    expect(await adapter().verify(signed(notification(delivered), "rogueLeaf"))).toEqual({ ok: false, reason: "signature_invalid" });
  });

  it("le certificat téléchargé est gardé : un second message ne le retélécharge pas", async () => {
    const { verify, fetched } = adapter();
    await verify(signed(notification(delivered)));
    await verify(signed(notification(delivered, { MessageId: "m-2" })));
    expect(fetched.filter((url) => url === CERT_URL)).toHaveLength(1);
  });

  it("une demande d'abonnement signée est confirmée, seulement sur sns.mnq.<région>.scaleway.com", async () => {
    const subscription = { Type: "SubscriptionConfirmation", MessageId: "s-1", TopicArn: TOPIC, Message: "Confirm", Timestamp: now.toISOString(), Token: "jeton", SubscribeURL: "https://sns.mnq.fr-par.scaleway.com/?Action=ConfirmSubscription&Token=jeton" };
    const ok = adapter();
    expect(await ok.verify(signed(subscription))).toEqual({ ok: true, events: [], note: "subscription_confirmed" });
    expect(ok.confirmed).toEqual([subscription.SubscribeURL]);
    const bad = adapter();
    expect(await bad.verify(signed({ ...subscription, SubscribeURL: "https://evil.example/confirm" }))).toEqual({ ok: false, reason: "payload_invalid" });
    expect(bad.confirmed).toEqual([]);
  });
});
