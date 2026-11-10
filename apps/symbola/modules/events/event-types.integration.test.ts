// Lot 16 (ADR 0045) — types d'événement : installation, modification,
// suppression protégée, type d'un événement et vocabulaire de ses clients,
// contre un vrai PostgreSQL (RLS), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { starterEventTypes } from "@symbola/starter-templates";
import {
  addStarterEventTypes,
  countEventsByType,
  createEventType,
  createProspect,
  createProspectSource,
  EventTypeInUseError,
  EventTypeNotFoundError,
  getEvent,
  getEventAudience,
  LastEventTypeError,
  listEventAudiences,
  listEventTypes,
  removeEventType,
  setEventType,
  startEventsTrial,
  updateEventType,
} from "./service";

const plannerId = randomUUID();

async function seedOrganization() {
  const organizationId = randomUUID();
  const source = await createProspectSource(organizationId, "Instagram");
  await addStarterEventTypes(organizationId, starterEventTypes("fr", "wedding_planner"));
  const types = await listEventTypes(organizationId);
  const typeOf = (key: string) => types.find((type) => type.starterKey === key)!;
  const createEvent = async (eventTypeId: string | null) =>
    (await createProspect({ organizationId, createdByUserId: plannerId, clients: [{ firstName: "Léa", lastName: null }], prospectSourceId: source.id, eventTypeId })).id;
  return { organizationId, types, typeOf, createEvent };
}

describe("lot 16 (ADR 0045) — Types d'événement", () => {
  it("les types de départ s'installent une seule fois, même demandés deux fois en même temps", async () => {
    const organizationId = randomUUID();
    const starters = starterEventTypes("fr", "event_agency");
    const added = await Promise.all([addStarterEventTypes(organizationId, starters), addStarterEventTypes(organizationId, starters)]);
    expect(added.reduce((sum, count) => sum + count, 0)).toBe(starters.length);
    expect((await listEventTypes(organizationId)).map((type) => type.label)).toEqual(starters.map((type) => type.label));
    expect(await addStarterEventTypes(organizationId, starters)).toBe(0);
  });

  it("un événement prend un type de l'organisation, et son vocabulaire suit ce type", async () => {
    const { organizationId, typeOf, createEvent } = await seedOrganization();
    const wedding = await createEvent(typeOf("wedding").id);
    const seminar = await createEvent(typeOf("seminar").id);
    const untyped = await createEvent(null);
    expect((await getEvent(organizationId, seminar))?.eventTypeId).toBe(typeOf("seminar").id);
    expect(await getEventAudience(organizationId, wedding)).toBe("couple");
    expect(await getEventAudience(organizationId, seminar)).toBe("clients");
    // Sans type (événement d'avant le lot 16) : le vocabulaire suit le métier.
    expect(await getEventAudience(organizationId, untyped)).toBeNull();
    await setEventType(organizationId, seminar, typeOf("wedding").id);
    expect(await getEventAudience(organizationId, seminar)).toBe("couple");
  });

  it("le type d'une autre organisation est refusé, à la création comme au changement", async () => {
    const mine = await seedOrganization();
    const other = await seedOrganization();
    await expect(mine.createEvent(other.typeOf("wedding").id)).rejects.toBeInstanceOf(EventTypeNotFoundError);
    const event = await mine.createEvent(mine.typeOf("wedding").id);
    await expect(setEventType(mine.organizationId, event, other.typeOf("seminar").id)).rejects.toBeInstanceOf(EventTypeNotFoundError);
    expect(await getEventAudience(mine.organizationId, event)).toBe("couple");
  });

  it("un type se renomme, change de vocabulaire, s'ajoute ; un nom vide est refusé", async () => {
    const { organizationId, typeOf, createEvent } = await seedOrganization();
    const event = await createEvent(typeOf("birthday").id);
    await updateEventType(organizationId, typeOf("birthday").id, { label: "Fiançailles", audience: "couple" });
    expect(await getEventAudience(organizationId, event)).toBe("couple");
    const created = await createEventType(organizationId, { label: "Pacs", audience: "couple" });
    expect((await listEventTypes(organizationId)).at(-1)).toMatchObject({ id: created.id, label: "Pacs", starterKey: null });
    await expect(createEventType(organizationId, { label: "  ", audience: "clients" })).rejects.toBeInstanceOf(RangeError);
  });

  it("un type utilisé ne se supprime qu'en confiant ses événements à un autre ; le dernier type reste", async () => {
    const { organizationId, types, typeOf, createEvent } = await seedOrganization();
    const event = await createEvent(typeOf("seminar").id);
    await expect(removeEventType(organizationId, typeOf("seminar").id, null)).rejects.toBeInstanceOf(EventTypeInUseError);
    await expect(removeEventType(organizationId, typeOf("seminar").id, typeOf("seminar").id)).rejects.toBeInstanceOf(EventTypeInUseError);
    await removeEventType(organizationId, typeOf("seminar").id, typeOf("corporate_party").id);
    expect((await getEvent(organizationId, event))?.eventTypeId).toBe(typeOf("corporate_party").id);
    expect((await countEventsByType(organizationId))[typeOf("corporate_party").id]).toBe(1);
    // Un type sans événement se supprime sans remplacement, jusqu'au dernier.
    const remaining = types.filter((type) => type.starterKey !== "seminar" && type.starterKey !== "corporate_party");
    for (const type of remaining) await removeEventType(organizationId, type.id, null);
    await expect(removeEventType(organizationId, typeOf("corporate_party").id, null)).rejects.toBeInstanceOf(LastEventTypeError);
    expect(await listEventTypes(organizationId)).toHaveLength(1);
  });

  it("le mariage fictif de l'essai guidé prend le type « mariage » de l'organisation", async () => {
    const { organizationId } = await seedOrganization();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr" });
    expect(await getEventAudience(organizationId, trial.eventId)).toBe("couple");
  });
});

describe("Lot 20 (décision 6) — Vocabulaire des écrans qui mêlent les événements", () => {
  it("le vocabulaire de chaque événement de l'organisation, en une fois ; nul pour un événement sans type", async () => {
    const { organizationId, typeOf, createEvent } = await seedOrganization();
    const wedding = await createEvent(typeOf("wedding").id);
    const seminar = await createEvent(typeOf("seminar").id);
    const untyped = await createEvent(null);
    const audiences = await listEventAudiences(organizationId);
    expect(audiences.get(wedding)).toBe("couple");
    expect(audiences.get(seminar)).toBe("clients");
    expect(audiences.get(untyped)).toBeNull();
  });

  it("isolation : une organisation ne voit pas le vocabulaire des événements d'une autre", async () => {
    const mine = await seedOrganization();
    const other = await seedOrganization();
    const theirs = await other.createEvent(other.typeOf("seminar").id);
    const audiences = await listEventAudiences(mine.organizationId);
    expect(audiences.has(theirs)).toBe(false);
  });
});
