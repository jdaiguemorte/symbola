// Lot 72d (EVT-02, EVT-05 ; J2, J9, J12 ; SEC-12, SEC-13) — contre un vrai PostgreSQL (RLS) : le délai de
// « Ouvrir le Jour J » (1 à 30, isolé par organisation) ; « Le contrat est signé… » refusé sans session de
// l'équipe, pour un évènement d'une autre organisation et pour une Planner hors de l'équipe ; ce que fait
// vraiment « Rétablir l'évènement » (le texte de sa fenêtre le dit).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventTeamMembers } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { cancelEvent, changeEventStatus, createEventLink, createLossReason, createProspect, createProspectSource, getDayOfLeadDays, getEvent, getLinkAccess, reactivateEvent, setDayOfLeadDays } from "@/modules/events/service";
import { signContractAs } from "./contract-signed";

const plannerId = randomUUID();
const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function organization() {
  return (await createOrganization(db, `Atelier 72d ${randomUUID().slice(0, 6)}`)).id;
}

async function wedding(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  return (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }, { firstName: "Paul", lastName: null }], eventDate: "2027-09-18" })).id;
}

const owner = (organizationId: string) => ({ organizationId, userId: plannerId, role: "owner" as const, allPlannersSeeAll: true });

describe("EVT-02 — Le délai de « Ouvrir le Jour J » est un réglage de l'organisation (J9)", () => {
  it("7 jours au départ ; 14 s'enregistre ; 0 et 31 sont refusés", async () => {
    const organizationId = await organization();
    expect(await getDayOfLeadDays(organizationId)).toBe(7);
    await setDayOfLeadDays(organizationId, 14);
    expect(await getDayOfLeadDays(organizationId)).toBe(14);
    await expect(setDayOfLeadDays(organizationId, 0)).rejects.toBeInstanceOf(RangeError);
    await expect(setDayOfLeadDays(organizationId, 31)).rejects.toBeInstanceOf(RangeError);
    expect(await getDayOfLeadDays(organizationId)).toBe(14);
  });

  it("une organisation ne lit ni ne change celui d'une autre", async () => {
    const [a, b] = [await organization(), await organization()];
    await setDayOfLeadDays(a, 21);
    expect(await getDayOfLeadDays(b)).toBe(7);
    await setDayOfLeadDays(b, 3);
    expect(await getDayOfLeadDays(a)).toBe(21);
    expect(await getDayOfLeadDays(b)).toBe(3);
  });
});

describe("EVT-05 — « Le contrat est signé… » pour la personne connectée (abus, SEC-12, SEC-13)", () => {
  const now = new Date("2026-11-27T10:00:00Z");

  it("la titulaire pose « Confirmé » à la date choisie, sans créer de tâche", async () => {
    const organizationId = await organization();
    const eventId = await wedding(organizationId);
    expect(await signContractAs(owner(organizationId), { eventId, signedOn: "2026-11-02", now })).toEqual({ ok: true });
    expect((await getEvent(organizationId, eventId))?.status).toBe("confirmed");
  });

  it("sans session de l'équipe (un lien des mariés n'en ouvre pas) : refusé", async () => {
    const organizationId = await organization();
    const eventId = await wedding(organizationId);
    expect(await signContractAs(null, { eventId, signedOn: "2026-11-02", now })).toEqual({ ok: false, reason: "unauthenticated" });
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
  });

  it("un évènement d'une autre organisation répond comme un évènement inexistant", async () => {
    const [mine, other] = [await organization(), await organization()];
    const eventId = await wedding(other);
    expect(await signContractAs(owner(mine), { eventId, signedOn: "2026-11-02", now })).toEqual({ ok: false, reason: "not_found" });
    expect((await getEvent(other, eventId))?.status).toBe("option");
  });

  it("une Planner hors de l'équipe (visibilité restreinte) : comme un évènement inexistant ; dans l'équipe, accepté", async () => {
    const organizationId = await organization();
    const eventId = await wedding(organizationId);
    const outsider = { organizationId, userId: randomUUID(), role: "member" as const, allPlannersSeeAll: false };
    expect(await signContractAs(outsider, { eventId, signedOn: "2026-11-02", now })).toEqual({ ok: false, reason: "not_found" });
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
    const member = { organizationId, userId: randomUUID(), role: "member" as const, allPlannersSeeAll: false };
    await withOrganization(db, organizationId, (tx) => tx.insert(eventTeamMembers).values({ organizationId, eventId, userId: member.userId, role: "lead" }));
    expect(await signContractAs(member, { eventId, signedOn: "2026-11-02", now })).toEqual({ ok: true });
  });

  it("une date future ou trop ancienne est dite, sans rien changer", async () => {
    const organizationId = await organization();
    const eventId = await wedding(organizationId);
    expect(await signContractAs(owner(organizationId), { eventId, signedOn: "2026-11-28", now })).toEqual({ ok: false, reason: "future" });
    expect(await signContractAs(owner(organizationId), { eventId, signedOn: "2020-01-01", now })).toEqual({ ok: false, reason: "too_early" });
    expect(await signContractAs(owner(organizationId), { eventId, signedOn: "31/02/2026", now })).toEqual({ ok: false, reason: "invalid" });
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
  });
});

describe("EVT-05 — « Rétablir l'évènement » dit ce que fait l'app (J12)", () => {
  it("il revient comme demande en cours ; le lien des mariés, fermé à l'annulation, se rouvre", async () => {
    const organizationId = await organization();
    const eventId = await wedding(organizationId);
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    const link = await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Inès", email: `ines-${randomUUID()}@symbola.test`, rights: { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] } } });
    expect(await getLinkAccess(organizationId, link.link.id)).not.toBeNull();
    const reason = await createLossReason(organizationId, "Budget", false);
    await cancelEvent({ organizationId, eventId, changedByUserId: plannerId, lossReasonId: reason.id, lossReasonNote: null });
    expect(await getLinkAccess(organizationId, link.link.id)).toBeNull();
    await reactivateEvent({ organizationId, eventId, changedByUserId: plannerId });
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
    expect(await getLinkAccess(organizationId, link.link.id)).not.toBeNull();
  });
});
