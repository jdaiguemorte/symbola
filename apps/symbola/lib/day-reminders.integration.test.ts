// Lot 66b (JRJ-01, HUB-28 ; D2 à D4 ; ADR 0112) — le rappel du jour J, contre un vrai PostgreSQL (RLS),
// horloge simulée : la planner seule au départ, la veille à 18 h (fuseau de l'évènement) ; une seule fois ;
// les clients s'ils sont cochés ; couper pour un évènement ; jamais pour un évènement annulé ; envoyé par
// Symbola (même quand la planner envoie les messages de la relation de sa messagerie). Tests d'abus : une
// organisation ne lit ni ne change le réglage d'une autre.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appDatabase } from "@symbola/db/client";
import { dayReminderOverrides } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { configureMailTransport, memoryTransport, type MemoryMailTransport } from "@symbola/mail";
import { addEventDayContact, addProgramItem, cancelEvent, createEventLink, setDayReminderOverride } from "@/modules/events/service";
import { setDayReminderTarget, setRelationMailSender } from "@/modules/hub/service";
import { readyOrganization, weddingEvent } from "@/modules/guests/test-fixtures";
import { forgetDayReminders, runDayReminders } from "./day-reminders";

let mail: MemoryMailTransport;
beforeEach(() => {
  mail = memoryTransport();
  configureMailTransport(mail);
  forgetDayReminders();
});
afterEach(() => configureMailTransport(null));

// 12 juin 2027 à Paris (heure d'été, UTC+2) : la veille à 18 h = 2027-06-11T16:00Z.
const EVE_17_59 = new Date("2027-06-11T15:59:00Z");
const EVE_18_00 = new Date("2027-06-11T16:00:00Z");
const EVE_18_05 = new Date("2027-06-11T16:05:00Z");

async function wedding() {
  const { organizationId, ownerId } = await readyOrganization({ enabled: false });
  const { eventId } = await weddingEvent(organizationId, ownerId);
  await addProgramItem(organizationId, eventId, { startTime: "15:00", endTime: "16:00", label: "Cérémonie", location: "Jardin", vendorSlotIds: [], freeParticipants: [] });
  await addEventDayContact(organizationId, eventId, { name: "Camille", role: "coordination", phone: "06 00 00 00 00" });
  return { organizationId, ownerId, eventId };
}


describe("JRJ-01 — Le rappel du jour J (66b, D2 à D4)", { timeout: 90_000 }, () => {
  it("au départ, la planner seule, la veille à 18 h : rien avant, un rappel à l'heure (programme, contacts, bouton du jour J), une seule fois ; envoyé par Symbola", async () => {
    const { organizationId, eventId } = await wedding();
    // La planner envoie les messages de la relation de sa messagerie : le rappel part quand même (D4).
    await setRelationMailSender(organizationId, "planner");
    await runDayReminders(EVE_17_59, [organizationId]);
    expect(mail.sent).toHaveLength(0);
    await runDayReminders(EVE_18_00, [organizationId]);
    expect(mail.sent).toHaveLength(1);
    const [message] = mail.sent;
    expect(message!.to).toMatch(/^owner-/);
    expect(message!.text).toContain("15:00–16:00 Cérémonie — Jardin");
    expect(message!.text).toContain("Camille (coordination) : 06 00 00 00 00");
    expect(message!.text).toContain(`/jour-j/${eventId}`);
    forgetDayReminders();
    await runDayReminders(EVE_18_05, [organizationId]);
    expect(mail.sent).toHaveLength(1);
  });

  it("les clients cochés reçoivent leur rappel ; coupé pour l'évènement, rien ne part ; un évènement annulé n'a pas de rappel", async () => {
    const { organizationId, ownerId, eventId } = await wedding();
    const tag = randomUUID().slice(0, 8);
    await createEventLink({ organizationId, eventId, createdByUserId: ownerId, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lea-${tag}@example.test`, rights: { rubrics: ["program"], budgetScope: "all", sharedSlotIds: [] } } });
    mail.sent.length = 0;
    await setDayReminderTarget(organizationId, "clients", { enabled: true, moment: "eve", sendTime: "18:00" });
    await setDayReminderOverride(organizationId, eventId, "planner", { enabled: false, moment: "eve", sendTime: "18:00" });
    await runDayReminders(EVE_18_00, [organizationId]);
    expect(mail.sent.map((message) => message.to)).toEqual([`lea-${tag}@example.test`]);

    const other = await wedding();
    await cancelEvent({ organizationId: other.organizationId, eventId: other.eventId, changedByUserId: other.ownerId, lossReasonId: null, lossReasonNote: null });
    mail.sent.length = 0;
    forgetDayReminders();
    await runDayReminders(EVE_18_00, [other.organizationId]);
    expect(mail.sent.filter((message) => message.text.includes(`/jour-j/${other.eventId}`))).toHaveLength(0);
  });
});

describe("JRJ-01 — Isolation du rappel du jour J entre organisations (66b)", { timeout: 60_000 }, () => {
  it("une organisation ne lit ni n'écrit le réglage d'un évènement d'une autre", async () => {
    const a = await wedding();
    const b = await wedding();
    await setDayReminderOverride(a.organizationId, a.eventId, "planner", { enabled: false, moment: "eve", sendTime: "18:00" });
    const seenByB = await withOrganization(appDatabase(), b.organizationId, (tx) => tx.select().from(dayReminderOverrides));
    expect(seenByB.some((row) => row.eventId === a.eventId)).toBe(false);
    await expect(setDayReminderOverride(b.organizationId, a.eventId, "planner", { enabled: true, moment: "eve", sendTime: "18:00" })).rejects.toThrow();
  });
});
