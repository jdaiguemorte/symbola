// Lot 72e (EVT-03, EVT-05, SEC-10 à SEC-13, DAT-08 ; C-26, D7, M1) — « Modifier les informations »
// s'enregistre d'un coup, contre un vrai PostgreSQL : toutes les rubriques ensemble, rien quand une est
// refusée, la date d'un évènement signé en lecture, l'isolation entre organisations, les notes
// confidentielles sans le droit, une modification faite entre-temps.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import type { EventDetailsInput } from "@symbola/contracts";
import {
  changeEventStatus,
  createEventType,
  createProspect,
  createProspectSource,
  EventDetailsConflictError,
  EventDetailsRefusedError,
  EventNotFoundError,
  getEvent,
  getEventBusy,
  getEventIdentityState,
  readEventConfidentialNotes,
  saveEventDetails,
  saveEventNotes,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function atelier(options: { signed?: boolean } = {}) {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `o-${randomUUID()}@symbola.test`, role: "owner" });
  const member = await createUser(db, { organizationId: organization.id, email: `m-${randomUUID()}@symbola.test`, role: "member" });
  const wedding = await createEventType(organization.id, { label: "Mariage", audience: "couple" });
  const baptism = await createEventType(organization.id, { label: "Baptême", audience: "clients" });
  const source = await createProspectSource(organization.id, "Salon du mariage");
  const { id } = await createProspect({
    organizationId: organization.id,
    createdByUserId: owner.id,
    prospectSourceId: null,
    eventTypeId: wedding.id,
    clients: [{ firstName: "Léa", lastName: "Martin" }],
    eventDate: "2027-06-12",
    venueName: "Manoir des Aulnes",
    venueCity: "Poitiers",
  });
  if (options.signed) await changeEventStatus({ organizationId: organization.id, eventId: id, changedByUserId: owner.id, toStatus: "confirmed" });
  return { organizationId: organization.id, eventId: id, owner: { userId: owner.id, role: "owner" as const }, member: { userId: member.id, role: "member" as const }, wedding: wedding.id, baptism: baptism.id, source: source.id };
}

function details(base: Awaited<ReturnType<typeof atelier>>, changes: Partial<EventDetailsInput> = {}): EventDetailsInput {
  return {
    timeZone: "Europe/Paris",
    venueName: "Manoir des Aulnes",
    venueCity: "Poitiers",
    busyRule: null,
    guestsEstimated: null,
    guestsConfirmed: null,
    wantedBudgetCents: null,
    style: null,
    notes: { text: null, confidential: false },
    eventTypeId: base.wedding,
    prospectSourceId: null,
    ...changes,
  };
}

describe("EVT-03 — « Modifier les informations » s'enregistre d'un coup (lot 72e, critère 4)", () => {
  it("toutes les rubriques ensemble : date d'une demande, lieu, fuseau, agenda, invités, budget, style, notes, type, origine", async () => {
    const base = await atelier();
    const result = await saveEventDetails({
      organizationId: base.organizationId,
      eventId: base.eventId,
      actor: base.owner,
      values: details(base, {
        eventDate: "2027-09-18",
        timeZone: "Europe/Brussels",
        venueName: "Château de Vaux",
        venueCity: "Maincy",
        busyRule: { startDayOffset: -1, startTime: "14:00", endDayOffset: 1, endTime: "12:00" },
        guestsEstimated: 120,
        guestsConfirmed: 98,
        wantedBudgetCents: 4_000_000,
        style: "Champêtre, tons sauge et ivoire",
        notes: { text: "Maxime est allergique aux fruits à coque.", confidential: false },
        eventTypeId: base.baptism,
        prospectSourceId: base.source,
      }),
    });
    expect(result).toEqual({ recalculationProposed: false });
    const event = await getEvent(base.organizationId, base.eventId);
    expect(event).toMatchObject({
      eventDate: "2027-09-18",
      timeZone: "Europe/Brussels",
      venueName: "Château de Vaux",
      venueCity: "Maincy",
      guestsEstimated: 120,
      guestsConfirmed: 98,
      wantedBudgetCents: 4_000_000,
      style: "Champêtre, tons sauge et ivoire",
      notes: "Maxime est allergique aux fruits à coque.",
      eventTypeId: base.baptism,
      prospectSourceId: base.source,
    });
    const busy = await getEventBusy(base.organizationId, base.eventId);
    expect(busy).toMatchObject({ source: "event", rule: { startDayOffset: -1, startTime: "14:00", endDayOffset: 1, endTime: "12:00" } });
  });

  it("une rubrique refusée n'enregistre rien des autres, et nomme son champ", async () => {
    const base = await atelier();
    const other = await createProspectSource((await atelier()).organizationId, "Instagram");
    await expect(
      saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.owner, values: details(base, { venueName: "Château de Vaux", style: "Bohème", prospectSourceId: other.id }) }),
    ).rejects.toMatchObject({ name: "EventDetailsRefusedError", field: "prospectSourceId" });
    await expect(
      saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.owner, values: details(base, { style: "Bohème", busyRule: { startDayOffset: 0, startTime: "18:00", endDayOffset: 0, endTime: "09:00" } }) }),
    ).rejects.toMatchObject({ field: "endTime" });
    const event = await getEvent(base.organizationId, base.eventId);
    expect(event).toMatchObject({ venueName: "Manoir des Aulnes", style: null, prospectSourceId: null });
  });

  it("la date d'un évènement signé ne s'y modifie pas ; le reste s'enregistre sans la toucher", async () => {
    const base = await atelier({ signed: true });
    await expect(saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.owner, values: details(base, { eventDate: "2028-01-01", style: "Bohème" }) })).rejects.toBeInstanceOf(EventDetailsRefusedError);
    expect((await getEvent(base.organizationId, base.eventId))?.style).toBeNull();
    await saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.owner, values: details(base, { style: "Bohème" }) });
    expect(await getEvent(base.organizationId, base.eventId)).toMatchObject({ eventDate: "2027-06-12", style: "Bohème" });
  });

  it("une modification faite entre-temps n'est pas écrasée : la version lue à l'ouverture ne correspond plus", async () => {
    const base = await atelier();
    const opened = String((await getEventIdentityState(base.organizationId, base.eventId))!.updatedAt.getTime());
    await saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.member, version: opened, values: details(base, { style: "Bohème" }) });
    await expect(saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.owner, version: opened, values: details(base, { style: "Classique" }) })).rejects.toBeInstanceOf(EventDetailsConflictError);
    expect((await getEvent(base.organizationId, base.eventId))?.style).toBe("Bohème");
  });
});

describe("SEC-10 à SEC-13, DAT-08 — abus de « Modifier les informations » (lot 72e)", () => {
  it("une organisation n'enregistre rien sur l'évènement d'une autre (même réponse qu'un évènement inexistant)", async () => {
    const a = await atelier();
    const b = await atelier();
    await expect(saveEventDetails({ organizationId: b.organizationId, eventId: a.eventId, actor: b.owner, values: details(b, { style: "Volé" }) })).rejects.toBeInstanceOf(EventNotFoundError);
    expect((await getEvent(a.organizationId, a.eventId))?.style).toBeNull();
  });

  it("le type d'une autre organisation est refusé comme un type inconnu", async () => {
    const a = await atelier();
    const b = await atelier();
    await expect(saveEventDetails({ organizationId: a.organizationId, eventId: a.eventId, actor: a.owner, values: details(a, { eventTypeId: b.wedding }) })).rejects.toMatchObject({ field: "eventTypeId" });
  });

  it("des notes confidentielles ne se changent pas sans le droit ; sans `notes`, elles restent telles quelles", async () => {
    const base = await atelier();
    await saveEventNotes(base.organizationId, base.eventId, { notes: "Tension dans la famille", confidential: true }, base.owner);
    await expect(
      saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.member, values: details(base, { style: "Bohème", notes: { text: "écrasé", confidential: false } }) }),
    ).rejects.toMatchObject({ field: "notes" });
    expect((await getEvent(base.organizationId, base.eventId))?.style).toBeNull();
    const withoutNotes: EventDetailsInput = { ...details(base, { style: "Bohème" }) };
    delete withoutNotes.notes;
    await saveEventDetails({ organizationId: base.organizationId, eventId: base.eventId, actor: base.member, values: withoutNotes });
    expect((await getEvent(base.organizationId, base.eventId))?.style).toBe("Bohème");
    expect(await readEventConfidentialNotes(base.organizationId, base.eventId, base.owner)).toBe("Tension dans la famille");
  });
});
