// Lot 55 (MSG-04 révisée, MSG-05 ; D1, D2 ; ADR 0102) — adresse d'expédition de l'organisation, journal
// des envois et webhook du service d'envoi, contre un vrai PostgreSQL (RLS), un double de l'envoi des
// e-mails et l'adaptateur de webhook simulé (HMAC-SHA256 horodaté). Tests d'abus : webhook mal signé,
// ancien ou rejoué ; référence d'une autre organisation ; isolation du journal.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { emailDeliveries, notifications } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { configureMailTransport, memoryTransport, type MemoryMailTransport } from "@symbola/mail";
import { upsertOrganizationProfileFields } from "./repository";
import {
  configureDeliveryWebhookAdapter,
  contactDeliveryAlert,
  createContact,
  getSenderAddress,
  handleEmailDeliveryWebhook,
  hubPrivacy,
  listEmailDeliveries,
  purgeEmailDeliveries,
  SenderAddressError,
  sendOrganizationEmail,
  setSenderLocalPart,
  signSimulatedWebhook,
  simulatedWebhookAdapter,
  SIMULATED_SIGNATURE_HEADER,
} from "./service";

const SECRET = "s".repeat(40);
const RULES = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };
let mail: MemoryMailTransport;
const savedMode = process.env.SMTP_SENDER_MODE;
const savedDomain = process.env.SMTP_FROM_DOMAIN;

beforeEach(() => {
  mail = memoryTransport();
  configureMailTransport(mail);
  configureDeliveryWebhookAdapter(simulatedWebhookAdapter(SECRET));
  process.env.SMTP_SENDER_MODE = "organization";
  process.env.SMTP_FROM_DOMAIN = "envoi.symbola.test";
});

afterEach(() => {
  configureMailTransport(null);
  configureDeliveryWebhookAdapter(undefined);
  if (savedMode === undefined) delete process.env.SMTP_SENDER_MODE;
  else process.env.SMTP_SENDER_MODE = savedMode;
  if (savedDomain === undefined) delete process.env.SMTP_FROM_DOMAIN;
  else process.env.SMTP_FROM_DOMAIN = savedDomain;
});

async function organization(name = `Atelier Camille ${randomUUID().slice(0, 6)}`) {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, name)).id;
  const owner = await createUser(db, { organizationId, email: `proprietaire-${randomUUID()}@example.test`, role: "owner" });
  await upsertOrganizationProfileFields(db, organizationId, { contactEmail: "contact@atelier-camille.test" });
  return { organizationId, ownerId: owner.id };
}

async function send(organizationId: string, to: string, eventId: string | null = null) {
  await sendOrganizationEmail({
    organizationId,
    to,
    kind: "new_message",
    locale: "fr",
    values: { first_name: "Léa", event: "votre mariage", topic: "Traiteur", link: "https://app.symbola.test/portail/messages" },
    eventId,
  });
  const sent = mail.sent.at(-1)!;
  return { sent, reference: sent.messageId!.replace(/^<|>$/g, "") };
}

function webhook(body: unknown, options: { now?: Date; secret?: string; signedAt?: Date } = {}) {
  const rawBody = JSON.stringify(body);
  const headers = new Headers({ [SIMULATED_SIGNATURE_HEADER]: signSimulatedWebhook(options.secret ?? SECRET, rawBody, options.signedAt ?? options.now ?? new Date()) });
  return handleEmailDeliveryWebhook({ headers, rawBody, ...(options.now ? { now: options.now } : {}) });
}

const event = (reference: string, status: "delivered" | "bounced" | "complained", reason: string | null = null) => ({ events: [{ reference, status, reason, occurred_at: new Date().toISOString() }] });

describe("MSG-04 — Adresse d'expédition personnalisée sur le domaine de Symbola (décision du 19/11)", () => {
  it("proposée depuis le nom de l'organisation, unique : deux organisations du même nom n'ont pas la même", async () => {
    const name = `Atelier Camille R. ${randomUUID().slice(0, 4)}`;
    const a = await organization(name);
    const b = await organization(name);
    const first = await getSenderAddress(a.organizationId);
    const second = await getSenderAddress(b.organizationId);
    expect(first.localPart).toMatch(/^atelier-camille-r-[0-9a-f]{4}$/);
    expect(first.address).toBe(`${first.localPart}@envoi.symbola.test`);
    expect(second.localPart).toBe(`${first.localPart}-2`);
    expect(first.replyTo).toBe("contact@atelier-camille.test");
    // Relue : la même, enregistrée.
    expect((await getSenderAddress(a.organizationId)).localPart).toBe(first.localPart);
  });

  it("modifiable ; refusée si mal formée, réservée ou déjà prise (sans dire par qui)", async () => {
    const a = await organization();
    const b = await organization();
    const wanted = `camille-${randomUUID().slice(0, 8)}`;
    expect(await setSenderLocalPart(a.organizationId, `  ${wanted.toUpperCase()} `)).toBe(wanted);
    await expect(setSenderLocalPart(b.organizationId, wanted)).rejects.toMatchObject({ reason: "taken" });
    await expect(setSenderLocalPart(b.organizationId, "postmaster")).rejects.toMatchObject({ reason: "reserved" });
    for (const bad of ["a", "camille@x", "-camille", "camille.", "cam..ille", "été"]) await expect(setSenderLocalPart(b.organizationId, bad)).rejects.toBeInstanceOf(SenderAddressError);
  });

  it("tous les e-mails de l'organisation en partent, avec son nom affiché ; les réponses vont à son adresse de contact", async () => {
    const a = await organization();
    const local = `atelier-${randomUUID().slice(0, 8)}`;
    await setSenderLocalPart(a.organizationId, local);
    const { sent, reference } = await send(a.organizationId, "lea@example.test");
    expect(sent.fromAddress).toBe(`${local}@envoi.symbola.test`);
    expect(sent.fromName).toMatch(/^Atelier Camille/);
    expect(sent.replyTo).toBe("contact@atelier-camille.test");
    expect(reference).toMatch(new RegExp(`^${a.organizationId}\\.[0-9a-f-]{36}@envoi\\.symbola\\.test$`));
  });

  it("en mode « shared » (avant l'activation du service), l'adresse commune de SMTP_FROM reste l'expéditeur", async () => {
    process.env.SMTP_SENDER_MODE = "shared";
    const a = await organization();
    const { sent } = await send(a.organizationId, "lea@example.test");
    expect(sent.fromAddress).toBeUndefined();
    expect(sent.replyTo).toBe("contact@atelier-camille.test");
  });
});

describe("MSG-05 — Journal des envois : remis, rejeté ; un rejet remonte en alerte sur le contact", () => {
  it("chaque e-mail parti entre au journal (objet, destinataire, nature, évènement), jamais le corps", async () => {
    const a = await organization();
    const eventId = randomUUID();
    await send(a.organizationId, "Lea@Example.test", eventId);
    const [row] = await listEmailDeliveries(a.organizationId);
    expect(row).toMatchObject({ recipient: "lea@example.test", kind: "new_message", eventId, status: "sent", reason: null });
    expect(row!.subject).toContain("Traiteur");
    expect(await listEmailDeliveries(a.organizationId, { eventId })).toHaveLength(1);
    expect(await listEmailDeliveries(a.organizationId, { email: "LEA@example.test" })).toHaveLength(1);
    const [stored] = await withOrganization(appDatabase(), a.organizationId, (tx) => tx.select().from(emailDeliveries).where(eq(emailDeliveries.id, row!.id)));
    expect(Object.keys(stored!)).not.toContain("body");
  });

  it("webhook signé : remis, puis rejet ; le rejet crée l'alerte sur le contact et une notification à l'équipe", async () => {
    const a = await organization();
    const contact = await createContact(a.organizationId, { kind: "person", firstName: "Léa", lastName: "Martin", email: `lea-${randomUUID()}@example.test` });
    const first = await send(a.organizationId, contact.email!);
    expect((await webhook(event(first.reference, "delivered"))).httpStatus).toBe(200);
    expect((await listEmailDeliveries(a.organizationId))[0]).toMatchObject({ status: "delivered" });
    expect(await contactDeliveryAlert(a.organizationId, contact.email)).toBeNull();
    const second = await send(a.organizationId, contact.email!);
    const result = await webhook(event(second.reference, "bounced", "mailbox_not_found"));
    expect(result).toMatchObject({ httpStatus: 200, outcome: "accepted" });
    expect(await contactDeliveryAlert(a.organizationId, contact.email)).toMatchObject({ status: "bounced", reason: "mailbox_not_found" });
    const alerts = await withOrganization(appDatabase(), a.organizationId, (tx) => tx.select().from(notifications).where(and(eq(notifications.type, "email_bounced"), eq(notifications.organizationId, a.organizationId))));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ userId: a.ownerId, href: `/contacts/${contact.id}`, params: { name: "Léa Martin", status: "bounced" } });
    // Jamais l'adresse dans la notification (SEC-20).
    expect(JSON.stringify(alerts[0]!.params)).not.toContain("@");
    // Rejoué : rien de plus. Un statut plus ancien ne revient pas en arrière.
    await webhook(event(second.reference, "bounced", "mailbox_not_found"));
    await webhook(event(second.reference, "delivered"));
    expect(await withOrganization(appDatabase(), a.organizationId, (tx) => tx.select().from(notifications).where(eq(notifications.type, "email_bounced")))).toHaveLength(1);
    expect((await listEmailDeliveries(a.organizationId, { status: "bounced" }))[0]).toMatchObject({ reason: "mailbox_not_found" });
    // Un envoi plus récent remis efface l'alerte.
    const third = await send(a.organizationId, contact.email!);
    await webhook(event(third.reference, "delivered"));
    expect(await contactDeliveryAlert(a.organizationId, contact.email)).toBeNull();
  });

  it("une plainte (indésirable) remonte aussi ; sans contact, la notification mène au journal", async () => {
    const a = await organization();
    const { reference } = await send(a.organizationId, `inconnu-${randomUUID()}@example.test`);
    await webhook(event(reference, "complained"));
    const [row] = await listEmailDeliveries(a.organizationId);
    expect(row).toMatchObject({ status: "complained", reason: "spam_complaint" });
    const [alert] = await withOrganization(appDatabase(), a.organizationId, (tx) => tx.select().from(notifications).where(eq(notifications.type, "email_bounced")));
    expect(alert).toMatchObject({ href: "/parametres/envois" });
  });

  it("abus (SEC-19) : sans signature, mal signé, signé trop tôt ou trop tard, corps illisible : refusé (401) et journalisé, rien ne change", async () => {
    const a = await organization();
    const { reference } = await send(a.organizationId, "lea@example.test");
    const body = JSON.stringify(event(reference, "bounced", "mailbox_full"));
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => void warnings.push(message);
    try {
      expect((await handleEmailDeliveryWebhook({ headers: new Headers(), rawBody: body })).httpStatus).toBe(401);
      expect((await webhook(event(reference, "bounced"), { secret: "x".repeat(40) })).outcome).toBe("signature_invalid");
      expect((await webhook(event(reference, "bounced"), { signedAt: new Date(Date.now() - 10 * 60_000) })).outcome).toBe("signature_expired");
      expect((await webhook(event(reference, "bounced"), { signedAt: new Date(Date.now() + 10 * 60_000) })).outcome).toBe("signature_expired");
      // Corps modifié après la signature.
      const headers = new Headers({ [SIMULATED_SIGNATURE_HEADER]: signSimulatedWebhook(SECRET, body) });
      expect((await handleEmailDeliveryWebhook({ headers, rawBody: body.replace("mailbox_full", "other") })).outcome).toBe("signature_invalid");
      expect((await webhook({ events: [{ reference, status: "lu" }] })).outcome).toBe("payload_invalid");
    } finally {
      console.warn = original;
    }
    expect(warnings.every((warning) => warning.startsWith("webhook d'envoi rejeté : "))).toBe(true);
    expect(warnings.join(" ")).not.toContain("lea@");
    expect((await listEmailDeliveries(a.organizationId))[0]).toMatchObject({ status: "sent" });
  });

  it("sans adaptateur (EMAIL_DELIVERY_WEBHOOK=none), le webhook ne répond pas", async () => {
    configureDeliveryWebhookAdapter(null);
    const result = await handleEmailDeliveryWebhook({ headers: new Headers(), rawBody: "{}" });
    expect(result.httpStatus).toBe(404);
  });

  it("abus : une référence qui désigne une autre organisation, ou forgée, ne change rien", async () => {
    const a = await organization();
    const b = await organization();
    const { reference } = await send(a.organizationId, "lea@example.test");
    const deliveryId = reference.split("@")[0]!.split(".")[1]!;
    const forged = `${b.organizationId}.${deliveryId}@envoi.symbola.test`;
    expect((await webhook(event(forged, "bounced"))).changes).toEqual([]);
    expect((await webhook(event(`<${randomUUID()}>`, "bounced"))).changes).toEqual([]);
    expect((await listEmailDeliveries(a.organizationId))[0]).toMatchObject({ status: "sent" });
  });

  it("isolation (SEC-36) : une organisation ne lit pas le journal d'une autre", async () => {
    const a = await organization();
    const b = await organization();
    await send(a.organizationId, "lea@example.test");
    expect(await listEmailDeliveries(b.organizationId)).toEqual([]);
    expect(await listEmailDeliveries(b.organizationId, { email: "lea@example.test" })).toEqual([]);
    expect(await contactDeliveryAlert(b.organizationId, "lea@example.test")).toBeNull();
  });

  it("purge à 13 mois (horloge simulée) : la veille de l'échéance reste, le lendemain part", async () => {
    const a = await organization();
    await send(a.organizationId, "ancien@example.test");
    await send(a.organizationId, "recent@example.test");
    const [recent, old] = await listEmailDeliveries(a.organizationId);
    const now = new Date("2028-03-31T09:00:00Z");
    await withOrganization(appDatabase(), a.organizationId, async (tx) => {
      // 13 mois et un jour avant, puis 13 mois moins un jour (passage à l'heure d'été du 26/03 compris).
      await tx.update(emailDeliveries).set({ sentAt: new Date("2027-02-27T09:00:00Z") }).where(eq(emailDeliveries.id, old!.id));
      await tx.update(emailDeliveries).set({ sentAt: new Date("2027-03-01T09:00:00Z") }).where(eq(emailDeliveries.id, recent!.id));
    });
    expect(await purgeEmailDeliveries(a.organizationId, now)).toBe(1);
    expect((await listEmailDeliveries(a.organizationId)).map((row) => row.recipient)).toEqual(["recent@example.test"]);
  });

  it("RGPD (privacy/v1) : les envois à la personne se trouvent et s'effacent", async () => {
    const a = await organization();
    const email = `lea-${randomUUID()}@example.test`;
    await send(a.organizationId, email);
    const records = (await hubPrivacy.find({ organizationId: a.organizationId, terms: { email } })).filter((record) => record.kind === "email_delivery");
    expect(records).toHaveLength(1);
    expect(records[0]!.fields.to).toBe(email);
    const plan = await hubPrivacy.erase({ organizationId: a.organizationId, records, rules: RULES, today: "2027-06-01" });
    expect(plan.filter((item) => item.kind === "email_delivery")).toEqual([{ kind: "email_delivery", recordId: records[0]!.recordId, fate: "deleted", legalBasis: null, keptUntil: null }]);
    expect(await listEmailDeliveries(a.organizationId, { email })).toEqual([]);
  });
});
