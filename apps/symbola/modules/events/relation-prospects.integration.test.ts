// Lot 45 (CRM-05, CRM-06 ; D1 à D3 ; ADR 0090) — répondre en un clic et relancer, contre un vrai
// PostgreSQL (RLS), avec une horloge simulée : envoi depuis Symbola ou préparé, historique du contact,
// brochure par lien de 30 jours, relances à J+3 et J+7, arrêt par chaque fait (y compris entre la
// préparation et l'envoi), envoi automatique en réglage, isolation entre organisations (SEC-36).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { eventLinks, prospectFollowUps } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { eq } from "drizzle-orm";
import {
  changeEventStatus,
  createProspect,
  createProspectSource,
  describeEventDocumentLink,
  getProspectFollowUp,
  getProspectFollowUpSettings,
  listContactMessages,
  listEventMessages,
  listReadyFollowUps,
  movePipelineCard,
  listPipelineStages,
  noteProspectAnswered,
  openEventDocumentLink,
  prepareDueFollowUps,
  ProspectMessageInvalidError,
  prospectMessageContext,
  saveProspectBrochure,
  saveProspectFollowUpSettings,
  sendProspectFollowUp,
  sendProspectMessage,
  stopProspectFollowUps,
  withdrawProspectFollowUp,
  type ProspectRecipient,
} from "./service";

const plannerId = randomUUID();
const MARCH_1 = new Date("2027-03-01T09:00:00.000Z");
const DAY = 86_400_000;

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Atelier ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function prospect(organizationId: string): Promise<{ eventId: string; recipients: ProspectRecipient[] }> {
  const source = await createProspectSource(organizationId, "Instagram");
  const { id } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin", email: `lea.${randomUUID().slice(0, 8)}@example.test` }], eventDate: "2027-06-12" });
  const context = await prospectMessageContext({ organizationId, eventId: id, locale: "fr", bookingUrl: null });
  return { eventId: id, recipients: context!.recipients };
}

async function reply(organizationId: string, eventId: string, recipients: ProspectRecipient[], at: Date, overrides: Partial<Parameters<typeof sendProspectMessage>[0]> = {}) {
  return sendProspectMessage({ organizationId, eventId, recipients, templateId: null, subject: "Merci pour votre message", body: "Bonjour Léa,\n\nMerci pour votre message !", userId: plannerId, locale: "fr", delivery: "sent", values: {}, now: at, ...overrides });
}

async function prepare(organizationId: string, now: Date) {
  return prepareDueFollowUps({ organizationId, now, locale: "fr", context: async ({ eventId, contactIds }) => prospectMessageContext({ organizationId, eventId, locale: "fr", contactIds, bookingUrl: null }) });
}

async function followUps(organizationId: string) {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) => tx.select().from(prospectFollowUps).orderBy(prospectFollowUps.rank));
  } finally {
    await sql.end();
  }
}

async function send(organizationId: string, followUpId: string, recipients: ProspectRecipient[], now: Date, external?: () => Promise<Date | null>) {
  return sendProspectFollowUp({ organizationId, followUpId, userId: plannerId, locale: "fr", recipients, values: {}, now, ...(external ? { external } : {}) });
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

describe("CRM-05 — Réponse en un clic depuis des modèles (D1)", () => {
  it("le texte relu et modifié part de Symbola et se range dans l'historique du contact ; les relances repartent de cet envoi", async () => {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    const result = await reply(organizationId, eventId, recipients, MARCH_1, { subject: "Votre mariage le 12 juin", body: "Bonjour Léa,\n\nTexte modifié par la planner avant l'envoi." });
    expect(result.subject).toBe("Votre mariage le 12 juin");
    const history = await listContactMessages(organizationId, recipients[0]!.contactId);
    expect(history).toMatchObject([{ kind: "reply", delivery: "sent", subject: "Votre mariage le 12 juin", body: "Bonjour Léa,\n\nTexte modifié par la planner avant l'envoi." }]);
    const { sql, db } = createAppConnection();
    try {
      const audit = await withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "events.prospect_message.sent")));
      expect(audit).toHaveLength(1);
      // SEC-20 : aucune adresse dans le journal.
      expect(JSON.stringify(audit[0]!.details)).not.toContain("@");
    } finally {
      await sql.end();
    }
  });

  it("« Ouvrir dans ma messagerie » : rien ne part, l'envoi est noté « préparé »", async () => {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, MARCH_1, { delivery: "prepared" });
    expect((await listEventMessages(organizationId, eventId)).map((message) => message.delivery)).toEqual(["prepared"]);
  });

  it("un message vide, ou avec une variable sans valeur, ne part pas", async () => {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await expect(reply(organizationId, eventId, recipients, MARCH_1, { body: "   " })).rejects.toThrow(ProspectMessageInvalidError);
    await expect(reply(organizationId, eventId, recipients, MARCH_1, { body: "Bonjour {{prénom}}" })).rejects.toThrow(/missing/);
    await expect(reply(organizationId, eventId, [], MARCH_1)).rejects.toThrow(/no_recipient/);
    expect(await listEventMessages(organizationId, eventId)).toEqual([]);
  });

  it("la brochure part par un lien sécurisé, valable 30 jours ; expiré, il est refusé sans rien révéler", async () => {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await expect(reply(organizationId, eventId, recipients, MARCH_1, { body: "Voici la brochure : {{brochure}}" })).rejects.toThrow(/no_brochure/);
    await saveProspectBrochure(organizationId, { content: PDF, fileName: "Brochure Atelier.pdf" });
    expect((await getProspectFollowUpSettings(organizationId)).brochure).toMatchObject({ fileName: "Brochure Atelier.pdf" });
    const sent = await reply(organizationId, eventId, recipients, new Date(), { body: "Voici la brochure :\n\n{{brochure}}" });
    const token = /\/partage#(\S+)/.exec(sent.body)![1]!;
    expect(sent.body).not.toContain("{{brochure}}");
    expect(await describeEventDocumentLink(token)).toMatchObject({ label: "Brochure Atelier.pdf", mime: "application/pdf" });
    const opened = await openEventDocumentLink(token);
    expect((await opened!.file()).data.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await openEventDocumentLink(token, new Date(Date.now() + 31 * DAY))).toBeNull();
    expect(await describeEventDocumentLink(`${organizationId}.inconnu`)).toBeNull();
  });

  it("la brochure n'accepte qu'un PDF", async () => {
    const organizationId = await organization();
    await expect(saveProspectBrochure(organizationId, { content: Buffer.from("\x89PNG\r\n\x1a\n0000000000000000"), fileName: "image.png" })).rejects.toThrow(/unsupported_type/);
  });
});

describe("CRM-06 — Relances réglables, préparées dans « Aujourd'hui » (D2, horloge simulée)", () => {
  it("le réglage de départ : J+3 et J+7, envoi automatique désactivé", async () => {
    const organizationId = await organization();
    expect(await getProspectFollowUpSettings(organizationId)).toMatchObject({ enabled: true, autoSend: false, steps: [{ days: 3, messageTemplateId: null }, { days: 7, messageTemplateId: null }] });
  });

  it("rien la veille de J+3 ; à J+3 la relance est prête, à relire ; envoyée d'un geste, elle entre dans l'historique ; la seconde vient à J+7", async () => {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, MARCH_1);
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 3 * DAY - 60_000))).prepared).toBe(0);
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 3 * DAY))).prepared).toBe(1);
    // Rejouer la tâche ne prépare rien de plus.
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 3 * DAY + 60_000))).prepared).toBe(0);
    const [ready] = await listReadyFollowUps(organizationId, new Date(MARCH_1.getTime() + 3 * DAY));
    expect(ready).toMatchObject({ eventId, rank: 1, sentAt: null });
    expect(ready!.body).toContain("Léa");
    const outcome = await send(organizationId, ready!.id, recipients, new Date(MARCH_1.getTime() + 3 * DAY + 3_600_000));
    expect(outcome).toEqual({ status: "sent", deferred: false });
    const history = await listEventMessages(organizationId, eventId);
    expect(history[0]).toMatchObject({ kind: "follow_up", delivery: "sent" });
    // AV-9 : la phrase « Répondez simplement » est dans chaque relance.
    expect(history[0]!.body).toContain("Répondez simplement");
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 7 * DAY - 60_000))).prepared).toBe(0);
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 7 * DAY))).prepared).toBe(1);
  });

  it("la planner retire une relance : elle ne part pas", async () => {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, MARCH_1);
    await prepare(organizationId, new Date(MARCH_1.getTime() + 3 * DAY));
    const [row] = await followUps(organizationId);
    await withdrawProspectFollowUp(organizationId, row!.id);
    expect(await send(organizationId, row!.id, recipients, new Date(MARCH_1.getTime() + 4 * DAY))).toEqual({ status: "stopped", reason: "withdrawn" });
  });

  it("envoi automatique en réglage : la relance part seule à son jour", async () => {
    const organizationId = await organization();
    await saveProspectFollowUpSettings(organizationId, { enabled: true, autoSend: true, steps: [{ days: 3, messageTemplateId: null }] });
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, MARCH_1);
    const result = await prepare(organizationId, new Date(MARCH_1.getTime() + 3 * DAY));
    expect(result).toMatchObject({ prepared: 1, sent: 1 });
    expect((await followUps(organizationId))[0]!.sentAt).not.toBeNull();
  });

  it("relances désactivées : rien ne se prépare", async () => {
    const organizationId = await organization();
    await saveProspectFollowUpSettings(organizationId, { enabled: false, autoSend: false, steps: [{ days: 3, messageTemplateId: null }] });
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, MARCH_1);
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 10 * DAY))).prepared).toBe(0);
  });
});

describe("CRM-06 — Aucune relance ne part après une réponse ou un refus (D3)", () => {
  async function readyFollowUp() {
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, MARCH_1);
    await prepare(organizationId, new Date(MARCH_1.getTime() + 3 * DAY));
    const [row] = await followUps(organizationId);
    return { organizationId, eventId, recipients, followUpId: row!.id };
  }
  const later = new Date(MARCH_1.getTime() + 3 * DAY + 3_600_000);
  const sendAt = new Date(MARCH_1.getTime() + 3 * DAY + 7_200_000);

  it("« a répondu », noté entre la préparation et l'envoi : la relance ne part pas", async () => {
    const { organizationId, eventId, recipients, followUpId } = await readyFollowUp();
    await noteProspectAnswered({ organizationId, eventId, userId: plannerId, now: later });
    expect(await send(organizationId, followUpId, recipients, sendAt)).toEqual({ status: "stopped", reason: "answered" });
    expect((await prepare(organizationId, new Date(MARCH_1.getTime() + 20 * DAY))).prepared).toBe(0);
  });

  it("un changement d'étape arrête la relance (revérifié juste avant l'envoi)", async () => {
    // Le passage d'étape est daté de l'horloge réelle : l'envoi de la planner la précède de quatre jours.
    const organizationId = await organization();
    const { eventId, recipients } = await prospect(organizationId);
    await reply(organizationId, eventId, recipients, new Date(Date.now() - 4 * DAY));
    await prepare(organizationId, new Date());
    const followUpId = (await followUps(organizationId))[0]!.id;
    const stages = await listPipelineStages(organizationId, "fr");
    await movePipelineCard({ organizationId, eventId, stageId: stages[2]!.id, userId: plannerId, locale: "fr" });
    expect(await send(organizationId, followUpId, recipients, new Date(Date.now() + DAY))).toEqual({ status: "stopped", reason: "stage_changed" });
  });

  it("la confirmation et le refus arrêtent les relances", async () => {
    const confirmed = await readyFollowUp();
    await changeEventStatus({ organizationId: confirmed.organizationId, eventId: confirmed.eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    expect(await send(confirmed.organizationId, confirmed.followUpId, confirmed.recipients, sendAt)).toEqual({ status: "stopped", reason: "confirmed" });
    const lost = await readyFollowUp();
    await changeEventStatus({ organizationId: lost.organizationId, eventId: lost.eventId, changedByUserId: plannerId, toStatus: "cancelled" });
    expect(await send(lost.organizationId, lost.followUpId, lost.recipients, sendAt)).toEqual({ status: "stopped", reason: "lost" });
  });

  it("une action du prospect dans Symbola (portail ouvert, rendez-vous, signature) arrête la relance", async () => {
    const opened = await readyFollowUp();
    const { sql, db } = createAppConnection();
    try {
      await withOrganization(db, opened.organizationId, (tx) =>
        tx.insert(eventLinks).values({ organizationId: opened.organizationId, eventId: opened.eventId, audience: "client", personName: "Léa", email: "lea@example.test", lastOpenedAt: later }),
      );
    } finally {
      await sql.end();
    }
    expect(await send(opened.organizationId, opened.followUpId, opened.recipients, sendAt)).toEqual({ status: "stopped", reason: "prospect_action" });
    const booked = await readyFollowUp();
    expect(await send(booked.organizationId, booked.followUpId, booked.recipients, sendAt, async () => later)).toEqual({ status: "stopped", reason: "prospect_action" });
  });

  it("un nouvel envoi de la planner repart à zéro : la relance d'avant s'arrête", async () => {
    const { organizationId, eventId, recipients, followUpId } = await readyFollowUp();
    await reply(organizationId, eventId, recipients, later);
    expect(await getProspectFollowUp(organizationId, followUpId)).toMatchObject({ stopReason: "new_message" });
    expect((await prepare(organizationId, new Date(later.getTime() + 3 * DAY))).prepared).toBe(1);
  });

  it("« ne plus relancer » vaut pour toujours", async () => {
    const { organizationId, eventId, recipients, followUpId } = await readyFollowUp();
    await stopProspectFollowUps({ organizationId, eventId, userId: plannerId, now: later });
    expect(await getProspectFollowUp(organizationId, followUpId)).toMatchObject({ stopReason: "stopped" });
    await reply(organizationId, eventId, recipients, new Date(later.getTime() + DAY));
    expect((await prepare(organizationId, new Date(later.getTime() + 10 * DAY))).prepared).toBe(0);
  });
});

describe("SEC-36 — Relances et messages : isolation entre organisations", () => {
  it("l'organisation B ne lit ni n'envoie les messages et relances de A", async () => {
    const a = await organization();
    const b = await organization();
    const { eventId, recipients } = await prospect(a);
    await reply(a, eventId, recipients, MARCH_1);
    await prepare(a, new Date(MARCH_1.getTime() + 3 * DAY));
    const [row] = await followUps(a);
    expect(await listEventMessages(b, eventId)).toEqual([]);
    expect(await listContactMessages(b, recipients[0]!.contactId)).toEqual([]);
    expect(await getProspectFollowUp(b, row!.id)).toBeNull();
    await expect(send(b, row!.id, recipients, new Date(MARCH_1.getTime() + 4 * DAY))).rejects.toThrow(ProspectMessageInvalidError);
    await expect(withdrawProspectFollowUp(b, row!.id)).rejects.toThrow(ProspectMessageInvalidError);
    await expect(noteProspectAnswered({ organizationId: b, eventId, userId: plannerId })).rejects.toThrow(ProspectMessageInvalidError);
    await expect(reply(b, eventId, recipients, MARCH_1)).rejects.toThrow(/not_found/);
    expect(await listReadyFollowUps(b, new Date(MARCH_1.getTime() + 4 * DAY))).toEqual([]);
  });
});
