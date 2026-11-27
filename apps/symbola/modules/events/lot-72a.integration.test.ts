// Lot 72a (EVT-05, EVT-07, UX-01 ; J1, J2 ; ADR 0121) — contre un vrai PostgreSQL (RLS), par la porte
// d'entrée du module : « Le contrat est signé… » à une date passée, refusé dans le futur ou trop tôt, ou
// pour un évènement d'une autre organisation ; la date de l'étape lue à la date effective ; le compte des
// tâches par évènement (faites, total, en retard, hors corbeille), isolé par organisation et assez rapide
// pour une agence (seuil de NFR-02, ADR 0115).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { sql as rawSql } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { eventTasks } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import {
  cancelEvent,
  ContractSignedDateError,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  EventStatusTransitionError,
  getEvent,
  getEventStatusDates,
  listEvents,
  markContractSigned,
  removeEventTask,
  taskProgressByEvent,
} from "./service";

const plannerId = randomUUID();
const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function wedding(organizationId: string, eventDate: string | null = "2027-06-12") {
  const source = await createProspectSource(organizationId, "Salon");
  return (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }, { firstName: "Paul", lastName: null }], eventDate })).id;
}

type Task = { dueDate: string; done?: boolean; deleted?: boolean };
async function tasks(organizationId: string, eventId: string, list: Task[]) {
  const ids = await withOrganization(db, organizationId, async (tx) => {
    const inserted: string[] = [];
    for (let start = 0; start < list.length; start += 500) {
      const rows = await tx.insert(eventTasks).values(
        list.slice(start, start + 500).map((task, index) => ({
          organizationId,
          eventId,
          label: `Tâche ${start + index}`,
          dueDate: task.dueDate,
          responsible: "planner" as const,
          position: start + index,
          doneAt: task.done ? new Date() : null,
        })),
      ).returning({ id: eventTasks.id });
      inserted.push(...rows.map((row) => row.id));
    }
    return inserted;
  });
  // La corbeille passe par la porte d'entrée du module (la base masque ensuite la tâche, lot 70a).
  for (const [index, task] of list.entries()) if (task.deleted) await removeEventTask(organizationId, ids[index]!);
}

describe("EVT-05 — « Le contrat est signé… » (lot 72a, J2, critère 8)", () => {
  // 25 nov. 2026, 10 h à Paris.
  const now = new Date("2026-11-25T09:00:00Z");

  it("au 2 avril, pose « Confirmé » et la date du 2 avril ; la frise lit cette date", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId);
    await markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "2026-04-02", now });
    expect((await getEvent(organizationId, eventId))?.status).toBe("confirmed");
    expect((await getEventStatusDates(organizationId, eventId)).confirmed).toBe("2026-04-02");
  });

  it("aujourd'hui est accepté ; demain est refusé ; plus d'un an avant la création aussi", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId);
    await expect(markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "2026-11-26", now })).rejects.toMatchObject({ name: "ContractSignedDateError", reason: "future" });
    // L'évènement est créé aujourd'hui (horloge réelle) : la date la plus ancienne est un an avant.
    await expect(markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "2020-01-01", now })).rejects.toBeInstanceOf(ContractSignedDateError);
    await expect(markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "pas-une-date", now })).rejects.toBeInstanceOf(ContractSignedDateError);
    expect((await getEvent(organizationId, eventId))?.status).toBe("option");
    await markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "2026-11-25", now });
    expect((await getEventStatusDates(organizationId, eventId)).confirmed).toBe("2026-11-25");
  });

  it("seule une demande en cours se signe ; un évènement d'une autre organisation répond comme inexistant", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId);
    await markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "2026-11-20", now });
    await expect(markContractSigned({ organizationId, eventId, changedByUserId: plannerId, signedOn: "2026-11-20", now })).rejects.toBeInstanceOf(EventStatusTransitionError);
    await expect(markContractSigned({ organizationId: randomUUID(), eventId, changedByUserId: plannerId, signedOn: "2026-11-20", now })).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("une annulation est datée du jour", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId);
    await cancelEvent({ organizationId, eventId, changedByUserId: plannerId, lossReasonId: null, lossReasonNote: null });
    const [row] = await withOrganization(db, organizationId, (tx) => tx.execute<{ effective_on: string | null }>(rawSql`select effective_on::text from events.event_status_history where event_id = ${eventId} and to_status = 'cancelled'`));
    expect(row?.effective_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("EVT-07, UX-01 — Tâches faites par évènement (lot 72a, critère 9)", () => {
  const today = "2026-11-25";

  it("faites, total et en retard (la veille l'est, le jour même non), hors corbeille ; jointes à la liste", async () => {
    const organizationId = randomUUID();
    const eventId = await wedding(organizationId);
    const empty = await wedding(organizationId);
    await tasks(organizationId, eventId, [
      { dueDate: "2026-11-24" },
      { dueDate: "2026-11-25" },
      { dueDate: "2026-10-01", done: true },
      { dueDate: "2026-12-10" },
      { dueDate: "2026-11-01", deleted: true },
    ]);
    const progress = await taskProgressByEvent(organizationId, [eventId, empty], today);
    expect(progress.get(eventId)).toEqual({ done: 1, total: 4, late: 1 });
    expect(progress.get(empty)).toEqual({ done: 0, total: 0, late: 0 });
    const listed = await listEvents({ organizationId, withTaskProgress: true });
    expect(listed.find((event) => event.id === eventId)?.taskProgress).toMatchObject({ done: 1, total: 4 });
    expect((await listEvents({ organizationId })).find((event) => event.id === eventId)?.taskProgress).toBeUndefined();
  });

  it("isolation : l'organisation B ne lit aucun compte des évènements de A", async () => {
    const organizationA = randomUUID();
    const eventId = await wedding(organizationA);
    await tasks(organizationA, eventId, [{ dueDate: "2026-11-01" }]);
    const fromB = await taskProgressByEvent(randomUUID(), [eventId], today);
    expect(fromB.get(eventId)).toEqual({ done: 0, total: 0, late: 0 });
  });

  it("une agence de 40 évènements et 1 600 tâches se compte sous le seuil de NFR-02 (médiane de trois mesures)", async () => {
    const organizationId = randomUUID();
    const ids: string[] = [];
    for (let index = 0; index < 40; index += 1) ids.push(await wedding(organizationId));
    for (const eventId of ids) await tasks(organizationId, eventId, Array.from({ length: 40 }, (_, index) => ({ dueDate: `2026-${String(1 + (index % 12)).padStart(2, "0")}-15`, done: index % 3 === 0 })));
    const timings: number[] = [];
    for (let round = 0; round < 3; round += 1) {
      const start = performance.now();
      const progress = await taskProgressByEvent(organizationId, ids, today);
      timings.push(performance.now() - start);
      expect(progress.get(ids[0]!)?.total).toBe(40);
    }
    expect(timings.sort((a, b) => a - b)[1]!).toBeLessThan(300);
  }, 120_000);
});
