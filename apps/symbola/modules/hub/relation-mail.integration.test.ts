// Lot 65d (MSG-01, HUB-20, HUB-28 ; décisions de Julien du 22/11/2026 ; ADR 0110) — qui envoie les
// messages de la relation, contre un vrai PostgreSQL (RLS) :
// - par défaut, la planner les envoie de sa messagerie : aucun modèle de la relation ne part de
//   Symbola, même appelé directement ; les modèles techniques partent toujours ;
// - « Symbola les envoie pour moi » se règle par organisation ; changer de réglage ne perd rien ;
// - un message préparé est déposé une fois par clé, puis « envoyé » (date, personne, modèle,
//   destinataire par son identifiant) ou « écarté » ;
// - tests d'abus : une autre organisation ne lit, n'envoie ni n'écarte ses messages ; ni son réglage.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { jobs, preparedEmails, relationMailSettings } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { assertOrganizationIsolation } from "@symbola/testing";
import {
  depositPreparedEmail,
  dismissPreparedEmail,
  getPreparedEmail,
  getRelationMailSender,
  listPreparedEmails,
  markPreparedEmailSent,
  PreparedEmailError,
  preparesRelationEmail,
  RELATION_EMAIL_KINDS,
  sendOrganizationEmail,
  setRelationMailSender,
  TECHNICAL_EMAIL_KINDS,
} from "./service";

const db = appDatabase();

async function organization(): Promise<string> {
  return (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
}

async function queuedMails(organizationId: string): Promise<number> {
  const rows = await withOrganization(db, organizationId, (tx) => tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.organizationId, organizationId)));
  return rows.length;
}

describe("MSG-01 — Qui envoie les messages de la relation (lot 65d, ADR 0110)", () => {
  it("par défaut, la planner les envoie de sa messagerie ; « Symbola les envoie pour moi » se règle ; une valeur inconnue est refusée", async () => {
    const organizationId = await organization();
    expect(await getRelationMailSender(organizationId)).toBe("planner");
    expect(await preparesRelationEmail(organizationId, "proposal_sent")).toBe(true);
    expect(await preparesRelationEmail(organizationId, "client_link")).toBe(false);
    await setRelationMailSender(organizationId, "symbola");
    expect(await getRelationMailSender(organizationId)).toBe("symbola");
    expect(await preparesRelationEmail(organizationId, "proposal_sent")).toBe(false);
    await expect(setRelationMailSender(organizationId, "pigeon")).rejects.toBeInstanceOf(PreparedEmailError);
    expect(await getRelationMailSender(organizationId)).toBe("symbola");
  });

  it("en mode « Je les envoie de ma messagerie », aucun des modèles de la relation ne part de Symbola, même appelé directement ; un modèle technique part", async () => {
    const organizationId = await organization();
    for (const kind of RELATION_EMAIL_KINDS) {
      const result = await sendOrganizationEmail({ organizationId, to: `client-${randomUUID()}@example.test`, kind, locale: "fr", values: {} });
      expect(result).toEqual({ deferred: false, prepared: true });
    }
    expect(await queuedMails(organizationId)).toBe(0);
    expect(TECHNICAL_EMAIL_KINDS).toContain("client_link");
    await sendOrganizationEmail({ organizationId, to: `client-${randomUUID()}@example.test`, kind: "client_link", locale: "fr", values: { first_name: "Léa", event: "votre mariage", client_term: "mariés", link: "https://app.symbola.test/portail#x", valid_until: "12 juin 2027" } });
    expect(await queuedMails(organizationId)).toBe(1);
  });

  it("changer de réglage ne perd rien : les messages déjà préparés restent « à envoyer »", async () => {
    const organizationId = await organization();
    const { id } = await depositPreparedEmail({ organizationId, kind: "proposal_sent", eventId: randomUUID(), recipientType: "event_link", recipientId: randomUUID(), ref: { quoteId: randomUUID() }, origin: "gesture" });
    await setRelationMailSender(organizationId, "symbola");
    await setRelationMailSender(organizationId, "planner");
    expect((await getPreparedEmail(organizationId, id))?.status).toBe("to_send");
  });
});

describe("MSG-01 — Messages préparés : « J'ai envoyé » et « Ne pas l'envoyer » (lot 65d)", () => {
  it("une seule fois par clé, même envoyé depuis ; un modèle technique ou une référence qui n'est pas un identifiant sont refusés", async () => {
    const organizationId = await organization();
    const input = { organizationId, kind: "payment_due_reminder" as const, eventId: randomUUID(), recipientType: "event_link" as const, recipientId: randomUUID(), ref: { scheduleItemId: randomUUID() }, origin: "automation" as const, automationKey: "payment_due_reminder", sourceKey: `payment-due:${randomUUID()}` };
    const first = await depositPreparedEmail(input);
    expect(first.created).toBe(true);
    await markPreparedEmailSent(organizationId, first.id, randomUUID());
    const again = await depositPreparedEmail(input);
    expect(again).toEqual({ id: first.id, created: false });
    expect((await getPreparedEmail(organizationId, first.id))?.status).toBe("sent");
    await expect(depositPreparedEmail({ ...input, kind: "client_link", sourceKey: null })).rejects.toMatchObject({ reason: "kind" });
    await expect(depositPreparedEmail({ ...input, ref: { note: "Léa Martin <lea@example.test>" }, sourceKey: null })).rejects.toMatchObject({ reason: "ref" });
  });

  it("« J'ai envoyé » note la date, la personne de l'équipe, le modèle et le destinataire par son identifiant ; aucune adresse ni aucun texte n'est gardé", async () => {
    const organizationId = await organization();
    const eventId = randomUUID();
    const recipientId = randomUUID();
    const userId = randomUUID();
    const { id } = await depositPreparedEmail({ organizationId, kind: "vendor_brief", eventId, recipientType: "event_link", recipientId, ref: { briefId: randomUUID() }, origin: "gesture" });
    const now = new Date("2026-11-22T10:15:00Z");
    const sent = await markPreparedEmailSent(organizationId, id, userId, now);
    expect(sent).toMatchObject({ status: "sent", kind: "vendor_brief", recipientId, sentByUserId: userId, sentAt: now.toISOString() });
    expect((await listPreparedEmails(organizationId, { eventId, status: "sent" })).map((item) => item.id)).toEqual([id]);
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(preparedEmails).where(eq(preparedEmails.id, id)));
    expect(JSON.stringify(row)).not.toMatch(/@/);
    // Déjà envoyé : rien ne change ; l'écarter ensuite est refusé.
    expect((await markPreparedEmailSent(organizationId, id, randomUUID())).sentByUserId).toBe(userId);
    await expect(dismissPreparedEmail(organizationId, id)).rejects.toMatchObject({ reason: "closed" });
  });

  it("« Ne pas l'envoyer » l'écarte : il quitte « à envoyer » et ne se déclare plus envoyé", async () => {
    const organizationId = await organization();
    const { id } = await depositPreparedEmail({ organizationId, kind: "task_reminder", eventId: randomUUID(), recipientType: "event_link", recipientId: randomUUID(), origin: "automation", automationKey: "client_task_reminder" });
    await dismissPreparedEmail(organizationId, id);
    expect(await listPreparedEmails(organizationId, { status: "to_send" })).toEqual([]);
    await expect(markPreparedEmailSent(organizationId, id, randomUUID())).rejects.toMatchObject({ reason: "closed" });
  });
});

describe("SEC-10, SEC-13 — Isolation des messages préparés et du réglage (lot 65d)", () => {
  it("la base ne montre ni ne modifie les messages préparés d'une autre organisation (RLS)", async () => {
    await assertOrganizationIsolation({
      seed: async (organizationId) => {
        const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(preparedEmails).values({ organizationId, kind: "proposal_sent", recipientType: "event_link", recipientId: randomUUID(), origin: "gesture" }).returning({ id: preparedEmails.id }));
        return row!;
      },
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select({ id: preparedEmails.id }).from(preparedEmails)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const rows = await withOrganization(db, organizationId, (tx) => tx.update(preparedEmails).set({ status: "dismissed", dismissedAt: new Date() }).where(eq(preparedEmails.id, target.id)).returning({ id: preparedEmails.id }));
        return { affectedRows: rows.length };
      },
    });
  });

  it("une autre organisation ne lit, n'envoie ni n'écarte un message, sans apprendre qu'il existe ; elle ne lit ni ne change le réglage", async () => {
    const owner = await organization();
    const other = await organization();
    const { id } = await depositPreparedEmail({ organizationId: owner, kind: "proposal_sent", eventId: randomUUID(), recipientType: "event_link", recipientId: randomUUID(), origin: "gesture" });
    expect(await getPreparedEmail(other, id)).toBeNull();
    expect(await listPreparedEmails(other, { ids: [id] })).toEqual([]);
    await expect(markPreparedEmailSent(other, id, randomUUID())).rejects.toMatchObject({ reason: "not_found" });
    await expect(dismissPreparedEmail(other, id)).rejects.toMatchObject({ reason: "not_found" });
    expect((await getPreparedEmail(owner, id))?.status).toBe("to_send");
    await setRelationMailSender(owner, "symbola");
    expect(await getRelationMailSender(other)).toBe("planner");
    const visible = await withOrganization(db, other, (tx) => tx.select().from(relationMailSettings));
    expect(visible.map((row) => row.organizationId)).not.toContain(owner);
  });
});
