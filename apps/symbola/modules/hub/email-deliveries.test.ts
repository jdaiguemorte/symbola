import { describe, expect, it } from "vitest";
import { monthsBefore, recipientHash } from "./email-deliveries";
import { deliveryReference, messageIdDomain, parseDeliveryReference, proposeSenderLocalPart, senderLocalPartCandidates, senderLocalPartProblem } from "./sender-address-rules";
import { configureDeliveryWebhookAdapter, currentDeliveryWebhookAdapter, signSimulatedWebhook, simulatedWebhookAdapter, SIMULATED_SIGNATURE_HEADER } from "./delivery-webhooks";

describe("MSG-05 — Échéance de la purge du journal des envois (13 mois)", () => {
  it("le même instant 13 mois plus tôt ; fin de mois ramenée au dernier jour (jamais de débordement)", () => {
    expect(monthsBefore(new Date("2028-03-31T09:00:00Z"), 13).toISOString()).toBe("2027-02-28T09:00:00.000Z");
    expect(monthsBefore(new Date("2028-03-15T23:30:00Z"), 13).toISOString()).toBe("2027-02-15T23:30:00.000Z");
    expect(monthsBefore(new Date("2029-03-29T00:00:00Z"), 13).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(monthsBefore(new Date("2028-01-31T12:00:00Z"), 13).toISOString()).toBe("2026-12-31T12:00:00.000Z");
  });

  it("l'empreinte d'une adresse ne dépend ni de la casse ni des espaces", () => {
    expect(recipientHash(" Lea@Example.TEST ")).toBe(recipientHash("lea@example.test"));
    expect(recipientHash("lea@example.test")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("MSG-04 — Règles de l'adresse d'expédition", () => {
  it("proposée depuis le nom : accents retirés, tirets, 40 caractères au plus ; suites -2, -3 si prise", () => {
    expect(proposeSenderLocalPart("Atelier Camille R.")).toBe("atelier-camille-r");
    expect(proposeSenderLocalPart("Les Mariées d'Émilie & Zoé")).toBe("les-mariees-d-emilie-zoe");
    expect(proposeSenderLocalPart("É")).toBe("organisation-e");
    expect(proposeSenderLocalPart("Support")).toBe("support-wp");
    expect(proposeSenderLocalPart("x".repeat(80))).toHaveLength(40);
    const candidates = senderLocalPartCandidates("y".repeat(60), 3);
    expect(candidates).toEqual(["y".repeat(40), `${"y".repeat(38)}-2`, `${"y".repeat(38)}-3`]);
    for (const candidate of senderLocalPartCandidates("Atelier Camille", 20)) expect(senderLocalPartProblem(candidate)).toBeNull();
  });

  it("refuse une partie locale mal formée ou réservée", () => {
    for (const bad of ["a", "Atelier", "atelier camille", "-atelier", "atelier-", "ate..lier", "ate.-lier", "x".repeat(41), "atelier@x"]) expect(senderLocalPartProblem(bad), bad).toBe("format");
    for (const reserved of ["postmaster", "abuse", "no-reply", "symbola"]) expect(senderLocalPartProblem(reserved)).toBe("reserved");
    expect(senderLocalPartProblem("atelier.camille-2")).toBeNull();
  });

  it("l'identifiant du message porte l'organisation et la ligne du journal, sans donnée personnelle", () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const deliveryId = "22222222-2222-4222-8222-222222222222";
    const reference = deliveryReference(organizationId, deliveryId, "envoi.symbola.fr");
    expect(parseDeliveryReference(`<${reference}>`)).toEqual({ organizationId, deliveryId });
    expect(parseDeliveryReference("lea@example.test")).toBeNull();
    expect(messageIdDomain("organization", "envoi.symbola.fr", "Symbola <no-reply@symbola.fr>")).toBe("envoi.symbola.fr");
    expect(messageIdDomain("shared", "envoi.symbola.fr", "Symbola <no-reply@symbola.fr>")).toBe("symbola.fr");
  });
});

describe("SEC-19 — Signature du webhook simulé (HMAC-SHA256 horodaté)", () => {
  const secret = "s".repeat(40);
  const body = JSON.stringify({ events: [{ reference: "x", status: "delivered", occurred_at: "2027-06-01T10:00:00Z" }] });
  const now = new Date("2027-06-01T10:00:00Z");
  const verify = (header: string | null, raw = body, at = now) => simulatedWebhookAdapter(secret).verify(new Headers(header ? { [SIMULATED_SIGNATURE_HEADER]: header } : {}), raw, at);

  it("accepte la signature du bon secret, dans la fenêtre de cinq minutes", () => {
    expect(verify(signSimulatedWebhook(secret, body, now))).toMatchObject({ ok: true, events: [{ reference: "x", status: "delivered", reason: null }] });
    expect(verify(signSimulatedWebhook(secret, body, new Date(now.getTime() - 299_000)))).toMatchObject({ ok: true });
  });

  it("refuse : sans en-tête, autre secret, corps modifié, hors fenêtre, en-tête mal formé", () => {
    expect(verify(null)).toEqual({ ok: false, reason: "signature_missing" });
    expect(verify(signSimulatedWebhook("t".repeat(40), body, now))).toEqual({ ok: false, reason: "signature_invalid" });
    expect(verify(signSimulatedWebhook(secret, body, now), body.replace("delivered", "bounced"))).toEqual({ ok: false, reason: "signature_invalid" });
    expect(verify(signSimulatedWebhook(secret, body, new Date(now.getTime() - 301_000)))).toEqual({ ok: false, reason: "signature_expired" });
    expect(verify("t=abc,v1=zz")).toEqual({ ok: false, reason: "signature_invalid" });
    // Bien signé, mais illisible ou hors du format attendu.
    expect(verify(signSimulatedWebhook(secret, "pas du json", now), "pas du json")).toEqual({ ok: false, reason: "payload_invalid" });
    const empty = JSON.stringify({ events: [] });
    expect(verify(signSimulatedWebhook(secret, empty, now), empty)).toEqual({ ok: false, reason: "payload_invalid" });
  });

  it("un rejet sans motif devient « autre motif » ; une plainte, « signalé comme indésirable »", () => {
    const raw = JSON.stringify({ events: [{ reference: "a", status: "bounced", occurred_at: "2027-06-01T10:00:00Z" }, { reference: "b", status: "complained", occurred_at: "2027-06-01T10:00:00Z" }] });
    expect(verify(signSimulatedWebhook(secret, raw, now), raw)).toMatchObject({ ok: true, events: [{ reason: "other" }, { reason: "spam_complaint" }] });
  });

  it("l'adaptateur en service suit EMAIL_DELIVERY_WEBHOOK ; un test peut en poser un autre", () => {
    const saved = { kind: process.env.EMAIL_DELIVERY_WEBHOOK, secret: process.env.EMAIL_DELIVERY_WEBHOOK_SECRET };
    try {
      process.env.EMAIL_DELIVERY_WEBHOOK = "none";
      expect(currentDeliveryWebhookAdapter()).toBeNull();
      process.env.EMAIL_DELIVERY_WEBHOOK = "simulated";
      process.env.EMAIL_DELIVERY_WEBHOOK_SECRET = secret;
      expect(currentDeliveryWebhookAdapter()?.name).toBe("simulated");
      configureDeliveryWebhookAdapter(null);
      expect(currentDeliveryWebhookAdapter()).toBeNull();
    } finally {
      configureDeliveryWebhookAdapter(undefined);
      if (saved.kind === undefined) delete process.env.EMAIL_DELIVERY_WEBHOOK;
      else process.env.EMAIL_DELIVERY_WEBHOOK = saved.kind;
      if (saved.secret === undefined) delete process.env.EMAIL_DELIVERY_WEBHOOK_SECRET;
      else process.env.EMAIL_DELIVERY_WEBHOOK_SECRET = saved.secret;
    }
  });
});
