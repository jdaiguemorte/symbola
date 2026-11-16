// Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) — flux de calendrier ICS par personne et par évènement,
// contre un vrai PostgreSQL (RLS), par la route lue par les agendas. Tests d'abus (CLAUDE.md
// § 2.11) : une adresse inconnue, mal formée, régénérée, retirée, d'une personne retirée de l'équipe
// ou portant une autre organisation ne répond rien ; ni essai, ni évènement d'une autre organisation.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser, removeMember } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { ensureEventTypes } from "@/lib/events/event-types";
import { addProgramItem, changeEventStatus, createLossReason, createProspect, createProspectSource, setEventType, startEventsTrial } from "@/modules/events/service";
import { issueCalendarFeed, listCalendarFeeds, resolveCalendarFeed, revokeCalendarFeed } from "@/modules/hub/service";
import { GET } from "@/app/calendrier/[jeton]/route";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function feed(token: string): Promise<Response> {
  return GET(new Request(`http://localhost/calendrier/${token}.ics`), { params: Promise.resolve({ jeton: `${token}.ics` }) });
}

// Atelier : sa titulaire et une collaboratrice ; le mariage de Léa et Maxime (daté, avec son
// programme), un prospect sans date, un évènement perdu.
async function atelier() {
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
  const owner = await createUser(db, { organizationId, email: `camille-${randomUUID()}@example.test`, role: "owner" });
  const member = await createUser(db, { organizationId, email: `hugo-${randomUUID()}@example.test`, role: "member" });
  const source = await createProspectSource(organizationId, "Salon");
  const wedding = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
  const types = await ensureEventTypes(organizationId, "fr");
  await setEventType(organizationId, wedding.id, types.find((type) => type.starterKey === "wedding")!.id);
  await addProgramItem(organizationId, wedding.id, { startTime: "15:30", endTime: "16:15", label: "Cérémonie laïque", location: "Jardin, Domaine des Tilleuls", internalNote: "Alliances chez le témoin", responsible: "Camille", vendorSlotIds: [], freeParticipants: ["Officiant"] });
  await addProgramItem(organizationId, wedding.id, { startTime: "23:30", endTime: "02:00", label: "Soirée dansante", vendorSlotIds: [], freeParticipants: [] });
  await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: null });
  const lost = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Perdu" }], eventDate: "2027-07-03" });
  const reason = await createLossReason(organizationId, "Budget", false);
  await changeEventStatus({ organizationId, eventId: lost.id, changedByUserId: owner.id, toStatus: "cancelled", lossReasonId: reason.id });
  return { organizationId, owner, member, weddingId: wedding.id };
}

describe("HUB-29 — Flux ICS par utilisateur et par évènement (lot 38b)", () => {
  it("le flux d'une personne : les évènements datés de l'organisation, en journée entière, « Mariage — Léa & Maxime », avec le lien vers la fiche ; ni sans date, ni perdu, ni essai", async () => {
    const w = await atelier();
    const trial = await startEventsTrial({ organizationId: w.organizationId, userId: w.owner.id, locale: "fr" });
    const { token } = await issueCalendarFeed({ organizationId: w.organizationId, userId: w.owner.id, eventId: null });
    const response = await feed(token);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const ics = await response.text();
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("SUMMARY:Mariage — Léa & Maxime\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270612\r\n");
    expect(ics).toContain(`/events/${w.weddingId}`);
    for (const absent of ["Inès", "Perdu", trial.eventId]) expect(ics).not.toContain(absent);
    expect((await listCalendarFeeds(w.organizationId, w.owner.id))[0]!.lastUsedAt).not.toBeNull();
  });

  it("le flux d'un évènement : son programme, aux heures de son fuseau (après minuit le lendemain), sans note interne", async () => {
    const w = await atelier();
    const { token } = await issueCalendarFeed({ organizationId: w.organizationId, userId: w.member.id, eventId: w.weddingId });
    const ics = await (await feed(token)).text();
    expect(ics).toContain("SUMMARY:Cérémonie laïque\r\n");
    expect(ics).toContain("DTSTART:20270612T133000Z\r\n");
    expect(ics).toContain("DTEND:20270612T141500Z\r\n");
    expect(ics).toContain("LOCATION:Jardin\\, Domaine des Tilleuls\r\n");
    expect(ics).toContain("DESCRIPTION:Responsable : Camille\\nIntervenants : Officiant\r\n");
    expect(ics).toContain("DTSTART:20270612T213000Z\r\n");
    expect(ics).toContain("DTEND:20270613T000000Z\r\n");
    expect(ics).not.toContain("Alliances");
  });

  it("une adresse régénérée, retirée, inconnue ou mal formée ne répond rien ; la nouvelle répond", async () => {
    const w = await atelier();
    const first = await issueCalendarFeed({ organizationId: w.organizationId, userId: w.owner.id, eventId: null });
    const second = await issueCalendarFeed({ organizationId: w.organizationId, userId: w.owner.id, eventId: null });
    expect((await feed(first.token)).status).toBe(404);
    expect((await feed(second.token)).status).toBe(200);
    await revokeCalendarFeed({ organizationId: w.organizationId, userId: w.owner.id, eventId: null });
    expect((await feed(second.token)).status).toBe(404);
    expect(await resolveCalendarFeed(`${w.organizationId}.${"A".repeat(43)}`)).toBeNull();
    for (const malformed of ["", "pas-un-jeton", `${w.organizationId}`, `${w.organizationId}.court`, `x.${"A".repeat(43)}`]) expect(await resolveCalendarFeed(malformed)).toBeNull();
    expect(await listCalendarFeeds(w.organizationId, w.owner.id)).toEqual([]);
  });

  it("l'adresse d'une personne retirée de l'équipe ne répond plus", async () => {
    const w = await atelier();
    const { token } = await issueCalendarFeed({ organizationId: w.organizationId, userId: w.member.id, eventId: null });
    expect((await feed(token)).status).toBe(200);
    expect(await removeMember(db, { organizationId: w.organizationId, userId: w.member.id, removedByUserId: w.owner.id })).toBe("removed");
    expect((await feed(token)).status).toBe(404);
  });

  it("isolation : une adresse ne lit que son organisation ; portée sur une autre organisation, elle ne répond rien ; le programme d'un essai non plus", async () => {
    const a = await atelier();
    const b = await atelier();
    const { token } = await issueCalendarFeed({ organizationId: a.organizationId, userId: a.owner.id, eventId: null });
    const ics = await (await feed(token)).text();
    expect(ics).toContain(`/events/${a.weddingId}`);
    expect(ics).not.toContain(b.weddingId);
    const secret = token.split(".")[1]!;
    expect((await feed(`${b.organizationId}.${secret}`)).status).toBe(404);
    // Le programme d'un évènement d'une autre organisation : rien.
    const foreign = await issueCalendarFeed({ organizationId: a.organizationId, userId: a.owner.id, eventId: b.weddingId });
    expect((await feed(foreign.token)).status).toBe(404);
    const trial = await startEventsTrial({ organizationId: a.organizationId, userId: a.owner.id, locale: "fr" });
    const demo = await issueCalendarFeed({ organizationId: a.organizationId, userId: a.owner.id, eventId: trial.eventId });
    expect((await feed(demo.token)).status).toBe(404);
  });
});
