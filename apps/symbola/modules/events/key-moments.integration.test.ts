// Lot 49 (EVT-04 premier pas, D2) — temps forts d'un évènement, contre un vrai PostgreSQL (RLS) :
// ajout, ordre, lieu parmi ceux de l'évènement, suppression logique, isolation entre organisations,
// et ce que le module Invités lit d'un évènement (clients, annulation).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { keyMoments } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import {
  addEventPlace,
  addKeyMoment,
  changeEventStatus,
  createProspect,
  createProspectSource,
  guestEventContexts,
  KeyMomentInvalidError,
  KeyMomentNotFoundError,
  listKeyMoments,
  removeKeyMoment,
  updateKeyMoment,
} from "./service";

const plannerId = randomUUID();

async function organization() {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function event(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  return (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" })).id;
}

describe("EVT-04 (lot 49, D2) — Temps forts de l'évènement", () => {
  it("ajout, ordre par date et heure, lieu de l'évènement, modification, suppression logique", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const place = await addEventPlace(organizationId, eventId, { label: "Domaine des Tilleuls" });
    const brunch = await addKeyMoment(organizationId, eventId, { name: "Brunch", date: "2027-06-13", startTime: "11:00" });
    const dinner = await addKeyMoment(organizationId, eventId, { name: "Dîner", date: "2027-06-12", startTime: "20:00", placeId: place.id });
    const ceremony = await addKeyMoment(organizationId, eventId, { name: "Cérémonie laïque", date: "2027-06-12", startTime: "15:00" });
    expect((await listKeyMoments(organizationId, eventId)).map((moment) => moment.name)).toEqual(["Cérémonie laïque", "Dîner", "Brunch"]);
    expect(dinner).toMatchObject({ placeLabel: "Domaine des Tilleuls", startTime: "20:00" });
    expect(await updateKeyMoment(organizationId, eventId, brunch.id, { name: "Brunch du lendemain", date: "2027-06-13", startTime: null })).toMatchObject({ name: "Brunch du lendemain", startTime: null });
    await removeKeyMoment(organizationId, eventId, ceremony.id);
    expect((await listKeyMoments(organizationId, eventId)).map((moment) => moment.name)).toEqual(["Dîner", "Brunch du lendemain"]);
    await expect(removeKeyMoment(organizationId, eventId, ceremony.id)).rejects.toBeInstanceOf(KeyMomentNotFoundError);
  });

  it("refuse un nom vide, une date ou une heure invalides, le lieu d'un autre évènement", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    const otherEvent = await event(organizationId);
    const otherPlace = await addEventPlace(organizationId, otherEvent, { label: "Ailleurs" });
    await expect(addKeyMoment(organizationId, eventId, { name: " ", date: "2027-06-12" })).rejects.toMatchObject({ problem: "name" });
    await expect(addKeyMoment(organizationId, eventId, { name: "Dîner", date: "12/06/2027" })).rejects.toMatchObject({ problem: "date" });
    await expect(addKeyMoment(organizationId, eventId, { name: "Dîner", date: "2027-06-12", startTime: "25:00" })).rejects.toBeInstanceOf(KeyMomentInvalidError);
    await expect(addKeyMoment(organizationId, eventId, { name: "Dîner", date: "2027-06-12", placeId: otherPlace.id })).rejects.toMatchObject({ problem: "place" });
  });

  it("une autre organisation ne lit, ne modifie ni ne supprime les temps forts (RLS)", async () => {
    const a = await organization();
    const b = await organization();
    const eventId = await event(b);
    const moment = await addKeyMoment(b, eventId, { name: "Dîner", date: "2027-06-12" });
    expect(await listKeyMoments(a, eventId)).toEqual([]);
    await expect(addKeyMoment(a, eventId, { name: "Intrus", date: "2027-06-12" })).rejects.toBeInstanceOf(KeyMomentNotFoundError);
    await expect(updateKeyMoment(a, eventId, moment.id, { name: "Volé", date: "2027-06-12" })).rejects.toBeInstanceOf(KeyMomentNotFoundError);
    await expect(removeKeyMoment(a, eventId, moment.id)).rejects.toBeInstanceOf(KeyMomentNotFoundError);
    const { sql, db } = createAppConnection();
    try {
      expect(await withOrganization(db, a, (tx) => tx.select().from(keyMoments))).toEqual([]);
    } finally {
      await sql.end();
    }
    expect(await guestEventContexts(a, [eventId])).toEqual([]);
  });

  it("le contexte lu par le module Invités : clients, temps forts, jour d'annulation", async () => {
    const organizationId = await organization();
    const eventId = await event(organizationId);
    await addKeyMoment(organizationId, eventId, { name: "Dîner", date: "2027-06-12" });
    const [before] = await guestEventContexts(organizationId, [eventId]);
    expect(before).toMatchObject({ eventId, isDemo: false, eventDate: "2027-06-12", cancelledOn: null, clients: [{ firstName: "Léa", lastName: "Martin" }] });
    expect(before!.keyMoments.map((moment) => moment.name)).toEqual(["Dîner"]);
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "cancelled" });
    const [after] = await guestEventContexts(organizationId, [eventId]);
    expect(after!.status).toBe("cancelled");
    expect(after!.cancelledOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
