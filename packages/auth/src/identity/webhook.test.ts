import { describe, expect, it } from "vitest";
import { identityWebhookDeliveryKey, isIdentityWebhookSigned, mfaFactorsFingerprint, readIdentityWebhook, signIdentityWebhook } from "./webhook";

const KEY = "cle-de-signature-de-test";
const body = JSON.stringify({ event: "User.Data.Updated", hookId: "h", createdAt: "2027-01-01T10:00:00.000Z", data: { id: "sub-1", primaryEmail: "Nouvelle@Example.test" } });

describe("SEC-08 (lot 52, D6) — Webhook signé du fournisseur d'identité", () => {
  it("accepte un appel signé du HMAC-SHA256 de son corps avec la clé du webhook", () => {
    expect(isIdentityWebhookSigned(body, signIdentityWebhook(body, KEY), KEY)).toBe(true);
    expect(isIdentityWebhookSigned(body, signIdentityWebhook(body, KEY).toUpperCase(), KEY)).toBe(true);
  });

  it("refuse un appel non signé, mal signé, signé d'une autre clé ou dont le corps a changé", () => {
    expect(isIdentityWebhookSigned(body, null, KEY)).toBe(false);
    expect(isIdentityWebhookSigned(body, "", KEY)).toBe(false);
    expect(isIdentityWebhookSigned(body, "abc", KEY)).toBe(false);
    expect(isIdentityWebhookSigned(body, signIdentityWebhook(body, "autre-cle"), KEY)).toBe(false);
    expect(isIdentityWebhookSigned(`${body} `, signIdentityWebhook(body, KEY), KEY)).toBe(false);
    // Sans clé connue (webhook pas encore réglé), rien n'est accepté.
    expect(isIdentityWebhookSigned(body, signIdentityWebhook(body, KEY), null)).toBe(false);
  });

  it("lit le compte et sa nouvelle adresse ; la réinitialisation d'un mot de passe ; ignore le reste", () => {
    expect(readIdentityWebhook(body)).toEqual({ kind: "data_updated", subject: "sub-1", primaryEmail: "nouvelle@example.test" });
    expect(readIdentityWebhook(JSON.stringify({ event: "PostResetPassword", userId: "sub-2" }))).toEqual({ kind: "password_reset", subject: "sub-2" });
    expect(readIdentityWebhook(JSON.stringify({ event: "User.Created", data: { id: "sub-3" } }))).toEqual({ kind: "ignored" });
    expect(readIdentityWebhook("pas du json")).toBeNull();
    expect(readIdentityWebhook(JSON.stringify({ event: "User.Data.Updated", data: { id: "sub-1", primaryEmail: "pas-une-adresse" } }))).toBeNull();
  });

  it("un appel rejoué garde la même clé d'idempotence", () => {
    expect(identityWebhookDeliveryKey(body)).toBe(identityWebhookDeliveryKey(body));
    expect(identityWebhookDeliveryKey(body)).not.toBe(identityWebhookDeliveryKey(`${body} `));
  });

  it("l'empreinte des facteurs ne dépend pas de leur ordre et change quand un facteur s'ajoute", () => {
    const totp = { id: "f1", type: "Totp" };
    const key = { id: "f2", type: "WebAuthn" };
    expect(mfaFactorsFingerprint([totp, key])).toBe(mfaFactorsFingerprint([key, totp]));
    expect(mfaFactorsFingerprint([totp])).not.toBe(mfaFactorsFingerprint([totp, key]));
  });
});
