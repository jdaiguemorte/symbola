// Lot 72c (PAR-10, HUB-03, EVT-06, SEC-10 à SEC-13 ; C-14, A7 ; spécification du lot 72, § 5.3) — contre un
// vrai PostgreSQL (RLS), par la porte d'entrée du module : la vue « L'agence » compte les tâches à faire par
// personne (en retard, aujourd'hui, d'ici 14 jours) et l'avancement de chaque évènement en cours (les mêmes
// nombres que « Tâches faites » de la liste), dans ce que la personne voit (lot 52, A20) ; une organisation ne
// lit rien d'une autre ; une agence de six personnes et 1 600 tâches se compte sous le seuil de NFR-02.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { sql as rawSql } from "drizzle-orm";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventTasks } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { cancelEvent, createProspect, createProspectSource, listAgencyOverview, setEventTeamMember, taskProgressByEvent } from "./service";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

const today = "2026-11-25";
// Chaque test a son agence : la titulaire, Hugo et Lina (Planners), et trois collègues pour la mesure.
let owner = "";
let hugo = "";
let lina = "";
let others: string[] = [];
let seesAll = { userId: "", role: "owner" as const, allPlannersSeeAll: false };
async function agency(): Promise<string> {
  const organization = await createOrganization(db, `Agence 72c ${randomUUID()}`);
  const person = async (role: "owner" | "member") => (await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, role })).id;
  owner = await person("owner");
  hugo = await person("member");
  lina = await person("member");
  others = [await person("member"), await person("member"), await person("member")];
  seesAll = { userId: owner, role: "owner", allPlannersSeeAll: false };
  return organization.id;
}

async function wedding(organizationId: string, eventDate = "2027-06-12") {
  const source = await createProspectSource(organizationId, "Salon");
  return (await createProspect({ organizationId, createdByUserId: owner, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate })).id;
}

type Task = { eventId: string | null; dueDate: string; label?: string; done?: boolean; assignee?: string | null; responsible?: "planner" | "clients" | "vendor"; createdBy?: string | null };
async function tasks(organizationId: string, list: Task[]) {
  await withOrganization(db, organizationId, async (tx) => {
    for (let start = 0; start < list.length; start += 500) {
      await tx.insert(eventTasks).values(
        list.slice(start, start + 500).map((task, index) => ({
          organizationId,
          eventId: task.eventId,
          label: task.label ?? `Tâche ${start + index}`,
          dueDate: task.dueDate,
          responsible: task.responsible ?? ("planner" as const),
          assigneeUserId: task.assignee ?? null,
          createdBy: task.createdBy ?? null,
          position: start + index,
          doneAt: task.done ? new Date() : null,
        })),
      );
    }
  });
}

const counts = (overview: Awaited<ReturnType<typeof listAgencyOverview>>, who: string) => overview.byWho.find((row) => row.who === who) ?? { who, late: 0, today: 0, horizon: 0 };

describe("PAR-10 — « L'agence » : par personne (lot 72c, critères 2 et 3)", () => {
  it("en retard, aujourd'hui et d'ici 14 jours (retards et jour même compris), tâches faites exclues ; mariés, prestataires et sans personne à part", async () => {
    const organizationId = await agency();
    const eventId = await wedding(organizationId);
    await tasks(organizationId, [
      { eventId, dueDate: "2026-11-20", assignee: hugo },
      { eventId, dueDate: "2026-11-24", assignee: hugo },
      { eventId, dueDate: "2026-11-25", assignee: hugo },
      { eventId, dueDate: "2026-12-09", assignee: hugo }, // le quatorzième jour : compté
      { eventId, dueDate: "2026-12-10", assignee: hugo }, // le quinzième : non
      { eventId, dueDate: "2026-11-01", assignee: hugo, done: true },
      { eventId: null, dueDate: "2026-11-23", assignee: hugo },
      { eventId, dueDate: "2026-11-22", responsible: "clients" },
      { eventId, dueDate: "2026-11-28", responsible: "vendor" },
      { eventId, dueDate: "2026-11-21" },
    ]);
    const overview = await listAgencyOverview({ organizationId, viewer: seesAll, today, horizonDays: 14 });
    expect(counts(overview, `member:${hugo}`)).toMatchObject({ late: 3, today: 1, horizon: 5 });
    expect(counts(overview, "clients")).toMatchObject({ late: 1, today: 0, horizon: 1 });
    expect(counts(overview, "vendors")).toMatchObject({ late: 0, today: 0, horizon: 1 });
    expect(counts(overview, "nobody")).toMatchObject({ late: 1, today: 0, horizon: 1 });
    // La somme des retards est celle du titre (critère 2) : 3 + 1 + 0 + 1.
    expect(overview.byWho.reduce((sum, row) => sum + row.late, 0)).toBe(5);
  });

  it("évènements suivis : planner principal ou assistant, parmi les évènements en cours", async () => {
    const organizationId = await agency();
    const [first, second, cancelled] = [await wedding(organizationId), await wedding(organizationId), await wedding(organizationId)];
    await setEventTeamMember({ organizationId, eventId: first, userId: hugo, role: "lead", byUserId: owner });
    await setEventTeamMember({ organizationId, eventId: second, userId: hugo, role: "assistant", byUserId: owner });
    await setEventTeamMember({ organizationId, eventId: cancelled, userId: hugo, role: "lead", byUserId: owner });
    await cancelEvent({ organizationId, eventId: cancelled, changedByUserId: owner, lossReasonId: null, lossReasonNote: null });
    const overview = await listAgencyOverview({ organizationId, viewer: seesAll, today, horizonDays: 14 });
    expect(overview.followedBy[hugo]).toBe(2);
  });
});

describe("PAR-10, EVT-07 — « L'agence » : par évènement (lot 72c, critère 2)", () => {
  it("les mêmes nombres que « Tâches faites » de la liste, et le plus ancien retard", async () => {
    const organizationId = await agency();
    const eventId = await wedding(organizationId);
    const upToDate = await wedding(organizationId);
    await tasks(organizationId, [
      { eventId, dueDate: "2026-11-24", label: "Réserver la navette" },
      { eventId, dueDate: "2026-11-10", label: "Faire signer le contrat du photographe" },
      { eventId, dueDate: "2026-11-25" },
      { eventId, dueDate: "2026-10-01", done: true },
      { eventId: upToDate, dueDate: "2026-12-20" },
    ]);
    const overview = await listAgencyOverview({ organizationId, viewer: seesAll, today, horizonDays: 14 });
    const progress = await taskProgressByEvent(organizationId, [eventId, upToDate], today);
    const row = overview.byEvent.find((entry) => entry.eventId === eventId);
    expect(row).toMatchObject({ ...progress.get(eventId), oldestLate: { label: "Faire signer le contrat du photographe", dueDate: "2026-11-10" } });
    expect(overview.byEvent.find((entry) => entry.eventId === upToDate)).toMatchObject({ ...progress.get(upToDate), late: 0, oldestLate: null });
  });

  it("hors démonstration et hors évènements annulés : ni ligne, ni compte", async () => {
    const organizationId = await agency();
    const demo = await wedding(organizationId);
    const cancelled = await wedding(organizationId);
    await withOrganization(db, organizationId, (tx) => tx.execute(rawSql`update events.events set is_demo = true where id = ${demo}`));
    await cancelEvent({ organizationId, eventId: cancelled, changedByUserId: owner, lossReasonId: null, lossReasonNote: null });
    await tasks(organizationId, [
      { eventId: demo, dueDate: "2026-11-01", assignee: hugo },
      { eventId: cancelled, dueDate: "2026-11-01", assignee: hugo },
    ]);
    const overview = await listAgencyOverview({ organizationId, viewer: seesAll, today, horizonDays: 14 });
    expect(overview.byEvent.map((row) => row.eventId)).not.toContain(demo);
    expect(overview.byEvent.map((row) => row.eventId)).not.toContain(cancelled);
    expect(counts(overview, `member:${hugo}`).late).toBe(0);
  });
});

describe("SEC-12, SEC-13, EVT-06 — « L'agence » ne montre que ce que la personne voit (lot 72c, critère 4)", () => {
  it("une Planner restreinte ne voit que les évènements de son équipe et leurs nombres ; hors évènement, les siennes ou sans personne (A20)", async () => {
    const organizationId = await agency();
    const hers = await wedding(organizationId);
    const other = await wedding(organizationId);
    await setEventTeamMember({ organizationId, eventId: hers, userId: lina, role: "lead", byUserId: owner });
    await setEventTeamMember({ organizationId, eventId: other, userId: hugo, role: "lead", byUserId: owner });
    await tasks(organizationId, [
      { eventId: hers, dueDate: "2026-11-20", assignee: hugo },
      { eventId: other, dueDate: "2026-11-20", assignee: hugo },
      { eventId: other, dueDate: "2026-11-20", assignee: hugo },
      { eventId: null, dueDate: "2026-11-20", assignee: hugo },
      { eventId: null, dueDate: "2026-11-20", assignee: null },
    ]);
    const restricted = { userId: lina, role: "member" as const, allPlannersSeeAll: false };
    const overview = await listAgencyOverview({ organizationId, viewer: restricted, today, horizonDays: 14 });
    expect(overview.byEvent.map((row) => row.eventId)).toEqual([hers]);
    expect(counts(overview, `member:${hugo}`).late).toBe(1);
    expect(counts(overview, "nobody").late).toBe(1);
    // Hugo suit « other », hors de la vue de Lina : il n'y est pas compté.
    expect(overview.followedBy[hugo] ?? 0).toBe(0);
    expect(overview.followedBy[lina]).toBe(1);
    // Le réglage ouvert (lot 52), elle voit toute l'agence.
    const open = await listAgencyOverview({ organizationId, viewer: { ...restricted, allPlannersSeeAll: true }, today, horizonDays: 14 });
    expect(counts(open, `member:${hugo}`).late).toBe(4);
  });

  it("isolation : l'organisation B ne lit ni personne, ni évènement, ni compte de A", async () => {
    const organizationA = await agency();
    const eventId = await wedding(organizationA);
    await setEventTeamMember({ organizationId: organizationA, eventId, userId: hugo, role: "lead", byUserId: owner });
    await tasks(organizationA, [{ eventId, dueDate: "2026-11-01", assignee: hugo }]);
    // B, une autre agence réelle, avec sa propre titulaire.
    const organizationB = await agency();
    const fromB = await listAgencyOverview({ organizationId: organizationB, viewer: seesAll, today, horizonDays: 14 });
    expect(fromB).toEqual({ byWho: [], byEvent: [], followedBy: {} });
  });

  it("une date ou une personne mal formée est refusée", async () => {
    await expect(listAgencyOverview({ organizationId: randomUUID(), viewer: seesAll, today: "demain", horizonDays: 14 })).rejects.toThrow();
    await expect(listAgencyOverview({ organizationId: randomUUID(), viewer: { userId: "x' or 1=1", role: "member", allPlannersSeeAll: false }, today, horizonDays: 14 })).rejects.toThrow();
  });
});

describe("NFR-02 — « L'agence » d'une agence de six personnes (lot 72c, critère 5)", () => {
  it("40 évènements, 1 600 tâches : sous le seuil de NFR-02 (médiane de trois mesures)", async () => {
    const organizationId = await agency();
    const people = [owner, hugo, lina, ...others];
    const ids: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const eventId = await wedding(organizationId);
      ids.push(eventId);
      await setEventTeamMember({ organizationId, eventId, userId: people[index % 6]!, role: "lead", byUserId: owner });
    }
    await tasks(
      organizationId,
      ids.flatMap((eventId, eventIndex) => Array.from({ length: 40 }, (_, index) => ({ eventId, dueDate: `2026-${String(1 + (index % 12)).padStart(2, "0")}-15`, done: index % 3 === 0, assignee: people[(eventIndex + index) % 6]! }))),
    );
    const timings: number[] = [];
    for (let round = 0; round < 3; round += 1) {
      const start = performance.now();
      const overview = await listAgencyOverview({ organizationId, viewer: seesAll, today, horizonDays: 14 });
      timings.push(performance.now() - start);
      expect(overview.byEvent).toHaveLength(40);
    }
    expect(timings.sort((a, b) => a - b)[1]!).toBeLessThan(300);
  }, 120_000);
});
