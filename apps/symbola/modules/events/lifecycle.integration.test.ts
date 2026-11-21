// Lot 34a (EVT-05, EVT-01, CHR-01, DAT-07, ARC-17 ; D2 à D9) — cycle de vie d'un évènement contre
// un vrai PostgreSQL (RLS), par la porte d'entrée du module : report à l'horloge simulée (jour
// même, lendemain), annulation et réactivation, rétroplanning du type dès la création, tâches
// relatives ou fixées, fuseau, événements internes en version 2, isolation entre organisations.
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql as rawSql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { EVT_EVENT_CREATED, EVT_EVENT_STATUS_CHANGED } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { parisToday } from "@symbola/i18n";
import {
  addEventTask,
  cancelEvent,
  changeEventDate,
  changeEventStatus,
  confirmPostponement,
  createEventType,
  createProspect,
  createProspectSource,
  createTaskTemplate,
  EventDateRequiredError,
  EventNotFoundError,
  EventStatusTransitionError,
  EventTaskNotFoundError,
  EventTypeNotFoundError,
  getEvent,
  getEventStatusDates,
  listEvents,
  listEventTasks,
  postponeEvent,
  previewTaskRecalculation,
  reactivateEvent,
  releaseEventTask,
  resolveTaskRecalculation,
  setEventTimeZone,
  setTaskTemplateEventType,
  TaskTemplateNotFoundError,
  updateEventTask,
} from "./service";

const plannerId = randomUUID();
const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

const WEDDING = [
  { label: "Réserver le lieu", offsetDays: -365, responsible: "planner" as const },
  { label: "Dégustation chez le traiteur", offsetDays: -90, responsible: "planner" as const },
  { label: "Plan de table", offsetDays: -14, responsible: "clients" as const },
];

// Lot 63a : seul le modèle du type de l'évènement s'applique. Le mariage a donc son type, auquel le
// modèle est rattaché (comme le fait le kit de départ, lib/setup/starter-kit.ts).
const weddingTypes = new Map<string, string>();

async function weddingTemplate(organizationId: string, name = "Mariage — 12 mois") {
  const type = await createEventType(organizationId, { label: "Mariage", audience: "couple" });
  weddingTypes.set(organizationId, type.id);
  return createTaskTemplate(organizationId, name, WEDDING, type.id);
}

async function wedding(organizationId: string, eventDate: string | null, options: { eventTypeId?: string | null; applyTemplate?: boolean } = {}) {
  const source = await createProspectSource(organizationId, "Salon");
  const eventTypeId = options.eventTypeId === undefined ? weddingTypes.get(organizationId) : (options.eventTypeId ?? undefined);
  return (
    await createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: source.id,
      clients: [
        { firstName: "Léa", lastName: null },
        { firstName: "Hugo", lastName: null },
      ],
      eventDate,
      ...(eventTypeId ? { eventTypeId } : {}),
      ...(options.applyTemplate === undefined ? {} : { applyTemplate: options.applyTemplate }),
    })
  ).id;
}

// Tâches par libellé : échéance, faite, fixée (l'ordre d'affichage suit le mois et la position).
async function tasksByLabel(organizationId: string, eventId: string) {
  return Object.fromEntries((await listEventTasks(organizationId, eventId)).map((task) => [task.label, [task.dueDate, task.done, task.fixed]]));
}

async function statusChanges(organizationId: string, eventId: string) {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ version: domainEvents.version, payload: domainEvents.payload })
      .from(domainEvents)
      .where(and(eq(domainEvents.name, EVT_EVENT_STATUS_CHANGED), rawSql`${domainEvents.payload}->>'eventId' = ${eventId}`))
      .orderBy(asc(domainEvents.occurredAt)),
  );
  return rows.map((row) => {
    const payload = row.payload as { fromStatus: string; toStatus: string };
    return [row.version, payload.fromStatus, payload.toStatus];
  });
}

describe("EVT-01, CHR-01 — Le rétroplanning du type de l'évènement, et de lui seul (D8 ; lot 63a)", () => {
  it("le modèle du type s'applique à la création, l'évènement reste en Option", async () => {
    const organizationId = randomUUID();
    await weddingTemplate(organizationId);
    const birthday = await createEventType(organizationId, { label: "Anniversaire", audience: "clients" });
    await createTaskTemplate(organizationId, "Anniversaire — 2 mois", [{ label: "Choisir la salle", offsetDays: -60, responsible: "planner" }], birthday.id);

    const typed = await wedding(organizationId, "2027-06-12", { eventTypeId: birthday.id });
    expect(await tasksByLabel(organizationId, typed)).toEqual({ "Choisir la salle": ["2027-04-13", false, false] });
    expect((await getEvent(organizationId, typed))?.status).toBe("option");

    const married = await wedding(organizationId, "2027-06-12");
    expect((await listEventTasks(organizationId, married)).map((task) => [task.label, task.dueDate, task.offsetDays])).toEqual([
      ["Réserver le lieu", "2026-06-12", -365],
      ["Dégustation chez le traiteur", "2027-03-14", -90],
      ["Plan de table", "2027-05-29", -14],
    ]);
  });

  it("recette du 21/11 : un type sans modèle, ou un évènement sans type, ne reçoit pas le rétroplanning du mariage", async () => {
    const organizationId = randomUUID();
    await weddingTemplate(organizationId);
    const other = await createEventType(organizationId, { label: "Autres", audience: "clients" });
    // Un modèle sans type ne s'applique plus de lui-même.
    await createTaskTemplate(organizationId, "Modèle libre", [{ label: "Tâche libre", offsetDays: -10, responsible: "planner" }]);

    expect(await listEventTasks(organizationId, await wedding(organizationId, "2027-06-12", { eventTypeId: other.id }))).toEqual([]);
    expect(await listEventTasks(organizationId, await wedding(organizationId, "2027-06-12", { eventTypeId: null }))).toEqual([]);
  });

  it("sans date, rien ne s'applique ; la première date donne le rétroplanning, une fois seulement", async () => {
    const organizationId = randomUUID();
    await weddingTemplate(organizationId);
    const eventId = await wedding(organizationId, null);
    expect(await listEventTasks(organizationId, eventId)).toEqual([]);

    await changeEventDate(organizationId, eventId, "2027-06-12");
    expect(await listEventTasks(organizationId, eventId)).toHaveLength(3);
    await changeEventDate(organizationId, eventId, null);
    await changeEventDate(organizationId, eventId, "2027-07-03");
    expect(await listEventTasks(organizationId, eventId)).toHaveLength(3);

    // Une création qui l'écarte (exemple, import) n'a pas de tâches.
    expect(await listEventTasks(organizationId, await wedding(organizationId, "2027-06-12", { applyTemplate: false }))).toEqual([]);
  });

  it("un modèle se rattache à un type de la même organisation seulement", async () => {
    const organizationId = randomUUID();
    const other = randomUUID();
    const template = await weddingTemplate(organizationId, "Mariage");
    const foreignType = await createEventType(other, { label: "Pacs", audience: "couple" });
    await expect(setTaskTemplateEventType(other, template.id, foreignType.id)).rejects.toBeInstanceOf(TaskTemplateNotFoundError);
    await expect(setTaskTemplateEventType(organizationId, template.id, foreignType.id)).rejects.toBeInstanceOf(EventTypeNotFoundError);
  });
});

describe("EVT-05 / CHR-01 / DAT-07 — Reporter un évènement (D4, D5, horloge simulée)", () => {
  async function confirmedWedding() {
    const organizationId = randomUUID();
    await weddingTemplate(organizationId);
    const eventId = await wedding(organizationId, "2027-06-12");
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    const tasks = await listEventTasks(organizationId, eventId);
    const byLabel = (label: string) => tasks.find((task) => task.label === label)!;
    // Faite : ne bouge plus.
    await updateEventTask({ organizationId, taskId: byLabel("Réserver le lieu").id, done: true });
    // Déplacée à la main : fixée.
    expect(await updateEventTask({ organizationId, taskId: byLabel("Plan de table").id, dueDate: "2027-06-01" })).toMatchObject({ fixed: true, offsetDays: -14 });
    // Créée à la main sur un évènement daté : relative (J-42).
    expect(await addEventTask(organizationId, eventId, { label: "Essayage", dueDate: "2027-05-01", responsible: "clients" })).toMatchObject({ offsetDays: -42, fixed: false });
    return { organizationId, eventId, planTaskId: byLabel("Plan de table").id };
  }

  it("le report garde la date et le statut d'avant ; les échéances attendent la confirmation", async () => {
    const { organizationId, eventId } = await confirmedWedding();
    const before = await tasksByLabel(organizationId, eventId);
    await postponeEvent({ organizationId, eventId, changedByUserId: plannerId, newDate: "2027-09-18" });

    expect(await getEvent(organizationId, eventId)).toMatchObject({
      status: "postponed",
      eventDate: "2027-09-18",
      postponedFromDate: "2027-06-12",
      postponedFromStatus: "confirmed",
    });
    expect(await tasksByLabel(organizationId, eventId)).toEqual(before);
  });

  it("l'aperçu liste les tâches qui bougent et celles qui tomberaient dans le passé : le jour même non, le lendemain oui", async () => {
    const { organizationId, eventId } = await confirmedWedding();
    await postponeEvent({ organizationId, eventId, changedByUserId: plannerId, newDate: "2027-09-18" });

    const sameDay = await previewTaskRecalculation(organizationId, eventId, "2027-06-20");
    expect(sameDay.moves.map((move) => [move.label, move.fromDate, move.toDate])).toEqual([
      ["Dégustation chez le traiteur", "2027-03-14", "2027-06-20"],
      ["Essayage", "2027-05-01", "2027-08-07"],
    ]);
    expect(sameDay.inThePast).toEqual([]);
    const nextDay = await previewTaskRecalculation(organizationId, eventId, "2027-06-21");
    expect(nextDay.inThePast.map((task) => [task.label, task.toDate])).toEqual([["Dégustation chez le traiteur", "2027-06-20"]]);
  });

  it("confirmer le report recalcule les échéances relatives ; faites et fixées ne bougent pas ; le statut d'avant revient", async () => {
    const { organizationId, eventId, planTaskId } = await confirmedWedding();
    await postponeEvent({ organizationId, eventId, changedByUserId: plannerId, newDate: "2027-09-18" });

    expect(await confirmPostponement({ organizationId, eventId, changedByUserId: plannerId })).toEqual({ previousDate: "2027-06-12", eventDate: "2027-09-18" });
    expect(await getEvent(organizationId, eventId)).toMatchObject({ status: "confirmed", eventDate: "2027-09-18", postponedFromDate: null, postponedFromStatus: null });
    expect(await tasksByLabel(organizationId, eventId)).toEqual({
      "Réserver le lieu": ["2026-06-12", true, false],
      "Plan de table": ["2027-06-01", false, true],
      "Dégustation chez le traiteur": ["2027-06-20", false, false],
      Essayage: ["2027-08-07", false, false],
    });

    // Remise en relatif : elle reprend sa place, J-14 de la nouvelle date.
    expect(await releaseEventTask(organizationId, planTaskId)).toMatchObject({ dueDate: "2027-09-04", fixed: false });
    expect(Object.keys(await getEventStatusDates(organizationId, eventId)).sort()).toEqual(["confirmed", "option", "postponed"]);
  });

  it("garder les échéances après un changement de date : un report suivant ne rejoue pas le décalage refusé", async () => {
    const { organizationId, eventId } = await confirmedWedding();
    await changeEventDate(organizationId, eventId, "2027-06-19");
    await resolveTaskRecalculation(organizationId, eventId, false);
    await postponeEvent({ organizationId, eventId, changedByUserId: plannerId, newDate: "2027-06-26" });
    await confirmPostponement({ organizationId, eventId, changedByUserId: plannerId });
    // Gardée au 14 mars malgré le 19 juin (J-97), elle suit ensuite le report d'une semaine.
    expect((await listEventTasks(organizationId, eventId)).find((task) => task.label === "Dégustation chez le traiteur")).toMatchObject({ dueDate: "2027-03-21", offsetDays: -97 });
  });

  it("« date à définir » : la confirmation attend une date ; une option ne se reporte pas ; un report en cours ne se pose pas à la main", async () => {
    const { organizationId, eventId } = await confirmedWedding();
    await postponeEvent({ organizationId, eventId, changedByUserId: plannerId, newDate: null });
    expect(await getEvent(organizationId, eventId)).toMatchObject({ status: "postponed", eventDate: null, postponedFromDate: "2027-06-12" });
    await expect(confirmPostponement({ organizationId, eventId, changedByUserId: plannerId })).rejects.toBeInstanceOf(EventDateRequiredError);
    await expect(changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" })).rejects.toBeInstanceOf(EventStatusTransitionError);

    await changeEventDate(organizationId, eventId, "2027-10-02");
    expect(await confirmPostponement({ organizationId, eventId, changedByUserId: plannerId })).toEqual({ previousDate: "2027-06-12", eventDate: "2027-10-02" });

    const option = await wedding(organizationId, "2027-06-12");
    await expect(postponeEvent({ organizationId, eventId: option, changedByUserId: plannerId, newDate: "2027-07-01" })).rejects.toBeInstanceOf(EventStatusTransitionError);
  });
});

describe("EVT-05 — Annuler et réactiver (D6)", () => {
  it("annulé avec son motif ; il ne change plus de statut qu'en se réactivant, en Option", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId, "2027-06-12");
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    await cancelEvent({ organizationId, eventId, changedByUserId: plannerId, lossReasonId: null, lossReasonNote: "Séparation" });
    expect(await getEvent(organizationId, eventId)).toMatchObject({ status: "cancelled", lossReasonNote: "Séparation" });

    await expect(cancelEvent({ organizationId, eventId, changedByUserId: plannerId, lossReasonId: null, lossReasonNote: "Doublon" })).rejects.toBeInstanceOf(EventStatusTransitionError);
    await expect(changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" })).rejects.toBeInstanceOf(EventStatusTransitionError);
    await reactivateEvent({ organizationId, eventId, changedByUserId: plannerId });
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
  });
});

describe("EVT-05 — Événements internes en version 2 (contrats du lot 34a)", () => {
  it("création et changements de statut publiés en version 2, avec les statuts du cahier des charges", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId, "2027-06-12");
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    await postponeEvent({ organizationId, eventId, changedByUserId: plannerId, newDate: "2027-09-18" });
    await confirmPostponement({ organizationId, eventId, changedByUserId: plannerId });

    const created = await withOrganization(db, organizationId, (tx) =>
      tx
        .select({ version: domainEvents.version })
        .from(domainEvents)
        .where(and(eq(domainEvents.name, EVT_EVENT_CREATED), rawSql`${domainEvents.payload}->>'eventId' = ${eventId}`)),
    );
    expect(created).toEqual([{ version: 2 }]);
    expect(await statusChanges(organizationId, eventId)).toEqual([
      [2, "option", "confirmed"],
      [2, "confirmed", "postponed"],
      [2, "postponed", "confirmed"],
    ]);
  });
});

describe("ARC-17 — Fuseau de l'évènement (D9)", () => {
  it("Europe/Paris par défaut ; un fuseau connu s'enregistre, un inconnu est refusé ; Jour J se lit le jour même", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId, "2027-06-12");
    expect((await getEvent(organizationId, eventId))?.timeZone).toBe("Europe/Paris");
    await setEventTimeZone(organizationId, eventId, "America/Montreal");
    expect((await getEvent(organizationId, eventId))?.timeZone).toBe("America/Montreal");
    await expect(setEventTimeZone(organizationId, eventId, "Mars/Olympus")).rejects.toBeInstanceOf(RangeError);

    const today = await wedding(organizationId, parisToday());
    await changeEventStatus({ organizationId, eventId: today, changedByUserId: plannerId, toStatus: "confirmed" });
    const listed = await listEvents({ organizationId });
    expect(listed.find((event) => event.id === today)).toMatchObject({ status: "confirmed", phase: "day_of" });
    expect(listed.find((event) => event.id === eventId)).toMatchObject({ status: "option", phase: "option" });
  });
});

describe("EVT-05 — Isolation par la porte d'entrée du module", () => {
  it("une autre organisation ne reporte, ne confirme, n'annule, ne réactive, ne prévisualise ni ne change le fuseau", async () => {
    const organizationId = randomUUID();
    const other = randomUUID();
    await weddingTemplate(organizationId, "Mariage");
    const eventId = await wedding(organizationId, "2027-06-12");
    await changeEventStatus({ organizationId, eventId, changedByUserId: plannerId, toStatus: "confirmed" });
    const [task] = await listEventTasks(organizationId, eventId);

    await expect(postponeEvent({ organizationId: other, eventId, changedByUserId: plannerId, newDate: "2027-09-18" })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(confirmPostponement({ organizationId: other, eventId, changedByUserId: plannerId })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(cancelEvent({ organizationId: other, eventId, changedByUserId: plannerId, lossReasonId: null, lossReasonNote: "x" })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(reactivateEvent({ organizationId: other, eventId, changedByUserId: plannerId })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(previewTaskRecalculation(other, eventId, "2027-01-01")).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(setEventTimeZone(other, eventId, "America/Montreal")).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(releaseEventTask(other, task!.id)).rejects.toBeInstanceOf(EventTaskNotFoundError);
    expect(await getEvent(organizationId, eventId)).toMatchObject({ status: "confirmed", eventDate: "2027-06-12", timeZone: "Europe/Paris" });
  });
});
