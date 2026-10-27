// AIDE-02 — essai guidé du module events (ADR 0008), contre un vrai
// PostgreSQL : un événement fictif complet, de vraies opérations, puis
// aucune donnée « démo » ne subsiste après l'essai ou au bout de 24 h.
import { randomUUID } from "node:crypto";
import { and, eq, sql as rawSql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import {
  eventClients,
  events,
  eventStatusHistory,
  eventTasks,
  eventVendorSlots,
  programItemParticipants,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import {
  addProgramItem,
  changeEventStatus,
  createProspect,
  createProspectSource,
  DemoEventRestrictionError,
  endEventsTrial,
  eventsPrivacy,
  getActiveEventsTrial,
  getEvent,
  getEventProgram,
  hasRealEvents,
  inviteEventClient,
  listEvents,
  listEventTasks,
  listEventVendorSlots,
  purgeExpiredDemoEvents,
  startEventsTrial,
  updateEventTask,
  updateEventVendorSlot,
} from "./service";

const { sql, db } = createAppConnection();
const plannerId = randomUUID();
const NOW = new Date("2026-10-27T10:00:00Z");
const HOUR = 60 * 60 * 1000;

afterAll(async () => {
  await sql.end();
});

// Compte, pour une organisation, toutes les lignes rattachées à un
// événement, dans chaque table du module, et les événements internes qui
// le citent.
async function remainingRows(organizationId: string, eventId: string): Promise<number> {
  return withOrganization(db, organizationId, async (tx) => {
    const counts = await Promise.all([
      tx.select().from(events).where(eq(events.id, eventId)),
      tx.select().from(eventClients).where(eq(eventClients.eventId, eventId)),
      tx.select().from(eventStatusHistory).where(eq(eventStatusHistory.eventId, eventId)),
      tx.select().from(eventVendorSlots).where(eq(eventVendorSlots.eventId, eventId)),
      tx.select().from(eventTasks).where(eq(eventTasks.eventId, eventId)),
      tx.select().from(programItems).where(eq(programItems.eventId, eventId)),
      tx.select().from(programItemParticipants).where(eq(programItemParticipants.organizationId, organizationId)),
      tx
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.organizationId, organizationId), rawSql`${domainEvents.payload}->>'eventId' = ${eventId}`)),
    ]);
    return counts.reduce((total, rows) => total + rows.length, 0);
  });
}

describe("AIDE-02 — Essai guidé avec données de test (module événements)", () => {
  it("l'essai crée un événement fictif complet, marqué démo, que la planner manipule comme un vrai", async () => {
    const organizationId = randomUUID();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    expect(trial.expiresAt).toBe(new Date(NOW.getTime() + 24 * HOUR).toISOString());
    // Relancer l'essai reprend le même, sans en créer un second.
    expect((await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW })).eventId).toBe(
      trial.eventId,
    );

    const event = await getEvent(organizationId, trial.eventId);
    expect(event).toMatchObject({ isDemo: true, status: "prospect", venueName: "Domaine des Tilleuls (fictif)" });
    expect(event?.clients.map((client) => client.firstName)).toEqual(["Camille", "Sacha"]);
    expect(event?.eventDate).toBe("2027-07-24");
    expect((await listEventVendorSlots(organizationId, trial.eventId)).length).toBeGreaterThan(0);
    expect((await listEventTasks(organizationId, trial.eventId)).length).toBeGreaterThan(0);
    expect((await getEventProgram(organizationId, trial.eventId)).items.length).toBeGreaterThan(0);
    expect((await listEvents({ organizationId })).map((summary) => [summary.id, summary.isDemo])).toEqual([
      [trial.eventId, true],
    ]);
    expect(await getActiveEventsTrial(organizationId, NOW)).toEqual(trial);
  });

  it("les données d'essai n'apparaissent ni au tableau de bord, ni dans la recherche RGPD, ni dans les événements internes", async () => {
    const organizationId = randomUUID();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    await changeEventStatus({ organizationId, eventId: trial.eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    const [slot] = await listEventVendorSlots(organizationId, trial.eventId);
    await updateEventVendorSlot({
      organizationId,
      vendorSlotId: slot!.id,
      changedByUserId: plannerId,
      status: "booked",
      vendorName: "Prestataire Démo",
      amountCents: 150000,
    });

    expect(await hasRealEvents(organizationId)).toBe(false);
    expect(await eventsPrivacy.find({ organizationId, term: "Camille" })).toEqual([]);
    expect(await eventsPrivacy.find({ organizationId, term: "Prestataire Démo" })).toEqual([]);
    expect(await remainingRows(organizationId, trial.eventId)).toBeGreaterThan(0);
    const published = await withOrganization(db, organizationId, (tx) =>
      tx.select().from(domainEvents).where(eq(domainEvents.organizationId, organizationId)),
    );
    expect(published).toEqual([]);

    // Un vrai événement, lui, compte.
    const source = await createProspectSource(organizationId, "Salon");
    await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Lou" }] });
    expect(await hasRealEvents(organizationId)).toBe(true);
  });

  it("l'essai n'envoie jamais d'e-mail à un tiers : pas d'invitation de marié sur l'événement fictif", async () => {
    const organizationId = randomUUID();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    await expect(
      inviteEventClient({
        organizationId,
        eventId: trial.eventId,
        email: `tiers-${randomUUID()}@example.test`,
        invitedByUserId: plannerId,
        locale: "fr",
      }),
    ).rejects.toBeInstanceOf(DemoEventRestrictionError);
  });

  it("quand l'essai se termine, toutes ses données sont supprimées, sans toucher les vrais événements", async () => {
    const organizationId = randomUUID();
    const source = await createProspectSource(organizationId, "Salon");
    const real = await createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: source.id,
      clients: [{ firstName: "Lou" }],
    });
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    const [task] = await listEventTasks(organizationId, trial.eventId);
    await updateEventTask({ organizationId, taskId: task!.id, done: true });
    await addProgramItem(organizationId, trial.eventId, {
      startTime: "18:00",
      label: "Feu d'artifice",
      vendorSlotIds: [],
      freeParticipants: ["Artificier"],
    });

    await endEventsTrial(organizationId, trial.eventId);

    expect(await remainingRows(organizationId, trial.eventId)).toBe(0);
    expect(await getActiveEventsTrial(organizationId, NOW)).toBeNull();
    expect((await listEvents({ organizationId })).map((summary) => summary.id)).toEqual([real.id]);
    // Terminer « l'essai » d'un vrai événement ne supprime rien.
    await endEventsTrial(organizationId, real.id);
    expect(await getEvent(organizationId, real.id)).not.toBeNull();
  });

  it("étant donné un essai abandonné, ses données sont supprimées après 24 h, pas avant", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    const otherTrial = await startEventsTrial({
      organizationId: otherOrganizationId,
      userId: plannerId,
      locale: "en",
      now: new Date(NOW.getTime() + 2 * HOUR),
    });

    // Veille de l'échéance : rien n'est supprimé.
    expect(await purgeExpiredDemoEvents(organizationId, new Date(NOW.getTime() + 24 * HOUR - 1000))).toBe(0);
    expect(await getActiveEventsTrial(organizationId, new Date(NOW.getTime() + 23 * HOUR))).not.toBeNull();

    // Échéance passée : l'essai disparaît, celui d'une autre organisation reste.
    expect(await purgeExpiredDemoEvents(organizationId, new Date(NOW.getTime() + 25 * HOUR))).toBe(1);
    expect(await remainingRows(organizationId, trial.eventId)).toBe(0);
    expect(await getEvent(otherOrganizationId, otherTrial.eventId)).not.toBeNull();
    // Un essai expiré n'est plus « actif » même avant la purge.
    expect(
      await getActiveEventsTrial(otherOrganizationId, new Date(NOW.getTime() + 27 * HOUR)),
    ).toBeNull();
  });
});
