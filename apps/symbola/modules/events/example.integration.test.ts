// Lot 33b (HUB-10, PAR-01 ; D10) — l'exemple du démarrage, contre un vrai PostgreSQL : le mariage
// de référence en données fictives, confirmé, exclu des statistiques ; purgé seul au bout de
// 30 jours (horloge simulée) ; aucun envoi possible vers un tiers réel, canal par canal.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  addVendorCandidate,
  countEventsCreatedByMonth,
  countOrganizationClientLinks,
  countOrganizationRealEvents,
  createEventLink,
  DemoEventRestrictionError,
  EXAMPLE_DURATION_MS,
  getActiveEventsTrial,
  getEvent,
  hasRealEvents,
  listEventTasks,
  listEventVendorSlots,
  purgeExpiredDemoEvents,
  recordVendorReminder,
  requestDecision,
  sendClientTaskReminders,
  startExampleEvent,
} from "./service";

const { sql, db } = createAppConnection();
const plannerId = randomUUID();
const NOW = new Date("2026-11-14T10:00:00Z");
const MINUTE = 60 * 1000;
const RIGHTS = { rubrics: ["tasks" as const], budgetScope: "all" as const, sharedSlotIds: [] };

afterAll(async () => {
  await sql.end();
});

async function organizationWithExample() {
  const organizationId = (await createOrganization(db, `Org ${randomUUID()}`)).id;
  const example = await startExampleEvent({ organizationId, userId: plannerId, locale: "fr", now: NOW });
  return { organizationId, eventId: example.eventId, expiresAt: example.expiresAt };
}

describe("HUB-10 — Données de démonstration étiquetées, exclues, supprimées", () => {
  it("« Explorer avec un exemple » crée le mariage de référence, fictif et confirmé, avec rétroplanning et postes ; le relancer le rouvre", async () => {
    const { organizationId, eventId, expiresAt } = await organizationWithExample();
    expect(expiresAt).toBe(new Date(NOW.getTime() + EXAMPLE_DURATION_MS).toISOString());
    expect(EXAMPLE_DURATION_MS).toBe(30 * 24 * 60 * MINUTE);
    const event = await getEvent(organizationId, eventId);
    expect(event).toMatchObject({ isDemo: true, status: "confirmed", venueName: "Domaine des Tilleuls (fictif)" });
    expect(event?.clients.map((client) => `${client.firstName} ${client.lastName}`)).toEqual(["Léa Martin (exemple)", "Maxime Dubois (exemple)"]);
    expect((await listEventTasks(organizationId, eventId)).length).toBeGreaterThan(0);
    expect((await listEventVendorSlots(organizationId, eventId)).length).toBeGreaterThan(0);
    expect((await startExampleEvent({ organizationId, userId: plannerId, locale: "fr", now: NOW })).eventId).toBe(eventId);
  });

  it("l'exemple n'entre pas dans les statistiques : ni évènement réel, ni comptage d'usage", async () => {
    const { organizationId } = await organizationWithExample();
    expect(await hasRealEvents(organizationId)).toBe(false);
    expect(await countOrganizationRealEvents(organizationId)).toBe(0);
    const byMonth = await countEventsCreatedByMonth([organizationId], new Date("2026-01-01T00:00:00Z"));
    expect(byMonth[organizationId] ?? []).toEqual([]);
  });

  it("D10 — l'exemple se supprime seul au bout de 30 jours, pas une minute avant (horloge simulée)", async () => {
    const { organizationId, eventId } = await organizationWithExample();
    const expiry = NOW.getTime() + EXAMPLE_DURATION_MS;
    expect(await purgeExpiredDemoEvents(organizationId, new Date(expiry - MINUTE))).toBe(0);
    expect(await getActiveEventsTrial(organizationId, new Date(expiry - MINUTE))).toMatchObject({ eventId });
    expect(await purgeExpiredDemoEvents(organizationId, new Date(expiry + MINUTE))).toBe(1);
    expect(await getEvent(organizationId, eventId)).toBeNull();
  });
});

describe("HUB-10 — Aucun envoi possible vers un tiers réel depuis l'exemple", () => {
  it("lien du client : refusé, aucun e-mail (et rien ne compte comme « client invité »)", async () => {
    const { organizationId, eventId } = await organizationWithExample();
    await expect(
      createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `lea-${randomUUID()}@example.test`, rights: RIGHTS } }),
    ).rejects.toBeInstanceOf(DemoEventRestrictionError);
    expect(await countOrganizationClientLinks(organizationId)).toBe(0);
  });

  it("lien d'un prestataire : refusé", async () => {
    const { organizationId, eventId } = await organizationWithExample();
    const [slot] = await listEventVendorSlots(organizationId, eventId);
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot!.id, vendorName: "Maison Haddad" });
    await expect(
      createEventLink({
        organizationId,
        eventId,
        createdByUserId: plannerId,
        audience: "vendor",
        vendorCandidateId: candidate.id,
        locale: "fr",
        link: { personName: "Karim Haddad", email: `karim-${randomUUID()}@example.test`, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } },
      }),
    ).rejects.toBeInstanceOf(DemoEventRestrictionError);
  });

  it("relance d'un prestataire : refusée, même pour un prestataire du carnet", async () => {
    const { organizationId, eventId } = await organizationWithExample();
    const [slot] = await listEventVendorSlots(organizationId, eventId);
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot!.id, vendorName: "Studio Lumière" });
    await expect(recordVendorReminder({ organizationId, eventId, candidateId: candidate.id, userId: plannerId })).rejects.toBeInstanceOf(DemoEventRestrictionError);
  });

  it("demande de décision au client : refusée", async () => {
    const { organizationId, eventId } = await organizationWithExample();
    await expect(requestDecision({ organizationId, eventId, requestedByUserId: plannerId, kind: "program" })).rejects.toBeInstanceOf(DemoEventRestrictionError);
  });

  it("rappels de tâches au client : aucun ne part de l'exemple", async () => {
    const { organizationId } = await organizationWithExample();
    expect(await sendClientTaskReminders(organizationId, new Date(NOW.getTime() + 200 * 24 * 60 * MINUTE))).toBe(0);
  });
});
