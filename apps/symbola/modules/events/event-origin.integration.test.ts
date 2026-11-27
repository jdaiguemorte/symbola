// Lot 70e (EVT-01, EVT-07, CRM-03, SEC-10 à SEC-13 ; A14) — la source et un client de plus, complétés
// depuis la fiche, contre un vrai PostgreSQL : écriture, deux clients au plus, isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventClient, createProspect, createProspectSource, EventClientsFullError, EventNotFoundError, getEvent, InvalidProspectSourceError, setEventProspectSource } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function atelier() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  const { id } = await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: null, name: "Léa & Maxime", clients: [] });
  return { organizationId: organization.id, eventId: id, sourceId: source.id };
}

describe("EVT-01 / EVT-07 — la source d'un évènement se complète depuis la fiche (lot 70e, A14)", () => {
  it("la source est posée, puis retirée", async () => {
    const { organizationId, eventId, sourceId } = await atelier();
    await setEventProspectSource(organizationId, eventId, sourceId);
    expect((await getEvent(organizationId, eventId))!.prospectSourceId).toBe(sourceId);
    await setEventProspectSource(organizationId, eventId, null);
    expect((await getEvent(organizationId, eventId))!.prospectSourceId).toBeNull();
  });

  it("une source qui n'existe pas est refusée", async () => {
    const { organizationId, eventId } = await atelier();
    await expect(setEventProspectSource(organizationId, eventId, randomUUID())).rejects.toBeInstanceOf(InvalidProspectSourceError);
  });

  it("abus — l'organisation B ne change ni la source de l'évènement de A, ni n'emploie une source de A", async () => {
    const a = await atelier();
    const b = await atelier();
    await expect(setEventProspectSource(b.organizationId, a.eventId, b.sourceId)).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(setEventProspectSource(b.organizationId, b.eventId, a.sourceId)).rejects.toBeInstanceOf(InvalidProspectSourceError);
    expect((await getEvent(a.organizationId, a.eventId))!.prospectSourceId).toBeNull();
  });
});

describe("CRM-03 / EVT-01 — un client de plus depuis la fiche (lot 70e, A14)", () => {
  it("ajoute un premier puis un second client, dans l'ordre ; deux au plus", async () => {
    const { organizationId, eventId } = await atelier();
    await addEventClient({ organizationId, eventId, client: { firstName: "Léa", lastName: "Martin" } });
    await addEventClient({ organizationId, eventId, client: { firstName: "Maxime", lastName: "Durand" } });
    expect((await getEvent(organizationId, eventId))!.clients.map((client) => client.firstName)).toEqual(["Léa", "Maxime"]);
    await expect(addEventClient({ organizationId, eventId, client: { firstName: "Troisième" } })).rejects.toBeInstanceOf(EventClientsFullError);
  });

  it("un même contact n'est client qu'une fois", async () => {
    const { organizationId, eventId } = await atelier();
    await addEventClient({ organizationId, eventId, client: { firstName: "Léa", email: "lea@exemple.test" } });
    await addEventClient({ organizationId, eventId, client: { firstName: "Léa", email: "lea@exemple.test" } });
    expect((await getEvent(organizationId, eventId))!.clients).toHaveLength(1);
  });

  it("abus — l'organisation B n'ajoute aucun client à l'évènement de A", async () => {
    const a = await atelier();
    const b = await atelier();
    await expect(addEventClient({ organizationId: b.organizationId, eventId: a.eventId, client: { firstName: "Intrus" } })).rejects.toBeInstanceOf(EventNotFoundError);
    expect((await getEvent(a.organizationId, a.eventId))!.clients).toHaveLength(0);
  });
});
