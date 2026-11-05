// Lot 12 (EVT-15) — lieux de l'événement saisis une fois, contre un vrai
// PostgreSQL (RLS), par la porte d'entrée du module events.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addEventPlace, createProspect, createProspectSource, EventPlaceEventNotFoundError, listEventPlaces, removeEventPlace } from "./service";

const plannerId = randomUUID();

async function newOrganization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function newEvent(organizationId: string): Promise<string> {
  const source = await createProspectSource(organizationId, "Salon");
  return (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }] })).id;
}

describe("EVT-15 — Lieux de l'événement saisis une fois", () => {
  it("elle ajoute les lieux dans l'ordre, sans doublon de nom, et peut en retirer un", async () => {
    const organizationId = await newOrganization();
    const eventId = await newEvent(organizationId);
    await addEventPlace(organizationId, eventId, { label: "Mairie de Lyon 2e", address: "2 rue de la République" });
    const domain = await addEventPlace(organizationId, eventId, { label: "Domaine des Tilleuls" });
    const again = await addEventPlace(organizationId, eventId, { label: "  domaine des tilleuls " });
    expect(again.id).toBe(domain.id);
    expect((await listEventPlaces(organizationId, eventId)).map((place) => [place.label, place.address])).toEqual([
      ["Mairie de Lyon 2e", "2 rue de la République"],
      ["Domaine des Tilleuls", null],
    ]);
    await removeEventPlace(organizationId, eventId, domain.id);
    expect((await listEventPlaces(organizationId, eventId)).map((place) => place.label)).toEqual(["Mairie de Lyon 2e"]);
  });

  it("un nom vide est refusé", async () => {
    const organizationId = await newOrganization();
    const eventId = await newEvent(organizationId);
    await expect(addEventPlace(organizationId, eventId, { label: "   " })).rejects.toBeInstanceOf(RangeError);
  });

  it("isolation : une autre organisation ne lit, n'ajoute ni ne retire aucun lieu", async () => {
    const organizationId = await newOrganization();
    const otherId = await newOrganization();
    const eventId = await newEvent(organizationId);
    const place = await addEventPlace(organizationId, eventId, { label: "Domaine des Tilleuls" });
    expect(await listEventPlaces(otherId, eventId)).toEqual([]);
    await expect(addEventPlace(otherId, eventId, { label: "Intrus" })).rejects.toBeInstanceOf(EventPlaceEventNotFoundError);
    await removeEventPlace(otherId, eventId, place.id);
    expect(await listEventPlaces(organizationId, eventId)).toHaveLength(1);
  });
});
