import { describe, expect, it } from "vitest";
import { nextOccurrence, planningHealth, shouldSpawnNext } from "./planning-rules";

describe("CHR-10 — Tâches hors évènement et tâches récurrentes (lot 53, D6)", () => {
  it("calcule l'occurrence suivante : semaine, mois (fin de mois comprise), trimestre, année (29 février compris)", () => {
    expect(nextOccurrence("2027-01-15", "weekly")).toBe("2027-01-22");
    expect(nextOccurrence("2027-12-28", "weekly")).toBe("2028-01-04");
    expect(nextOccurrence("2027-01-15", "monthly")).toBe("2027-02-15");
    expect(nextOccurrence("2027-01-31", "monthly")).toBe("2027-02-28");
    expect(nextOccurrence("2027-11-30", "quarterly")).toBe("2028-02-29");
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-02-28");
  });

  it("crée la suivante quand la tâche est faite, ou à sa date, une seule fois", () => {
    const base = { recurrence: "monthly" as const, recurrenceSpawnedAt: null, doneAt: null, dueDate: "2027-01-20" };
    expect(shouldSpawnNext(base, "2027-01-19")).toBe(false);
    expect(shouldSpawnNext(base, "2027-01-20")).toBe(true);
    expect(shouldSpawnNext({ ...base, doneAt: new Date("2027-01-10T10:00:00Z") }, "2027-01-10")).toBe(true);
    expect(shouldSpawnNext({ ...base, recurrenceSpawnedAt: new Date("2027-01-20T05:00:00Z") }, "2027-01-21")).toBe(false);
    expect(shouldSpawnNext({ ...base, recurrence: null }, "2027-02-01")).toBe(false);
  });
});

describe("CHR-05 — Jalons, alertes de retard et indicateur de santé du planning (lot 53)", () => {
  const thresholds = { watchPoints: 1, latePoints: 4, milestoneWeight: 3 };
  const task = (id: string, dueDate: string, extra: Partial<{ done: boolean; isMilestone: boolean }> = {}) => ({ id, label: `Tâche ${id}`, dueDate, done: false, isMilestone: false, ...extra });

  it("reste « bon » sans retard ; les tâches faites ou à venir ne comptent pas", () => {
    const health = planningHealth([task("a", "2027-01-20"), task("b", "2027-01-01", { done: true })], "2027-01-10", thresholds);
    expect(health).toMatchObject({ state: "good", points: 0, contributors: [] });
  });

  it("s'explique : il liste les tâches qui le dégradent, jalons d'abord, avec leur retard", () => {
    const health = planningHealth([task("a", "2027-01-08"), task("j", "2027-01-09", { isMilestone: true }), task("b", "2027-01-01")], "2027-01-10", thresholds);
    expect(health.contributors.map((contributor) => [contributor.taskId, contributor.daysLate, contributor.points])).toEqual([
      ["j", 1, 3],
      ["b", 9, 1],
      ["a", 2, 1],
    ]);
    expect(health.state).toBe("late");
    expect(health.points).toBe(5);
  });

  it("un jalon en retard pèse plus qu'une tâche en retard", () => {
    expect(planningHealth([task("a", "2027-01-09")], "2027-01-10", thresholds).state).toBe("watch");
    expect(planningHealth([task("a", "2027-01-09", { isMilestone: true })], "2027-01-10", { ...thresholds, latePoints: 3 }).state).toBe("late");
  });

  it("suit les seuils réglés par l'organisation", () => {
    const tasks = [task("a", "2027-01-09"), task("b", "2027-01-09")];
    expect(planningHealth(tasks, "2027-01-10", thresholds).state).toBe("watch");
    expect(planningHealth(tasks, "2027-01-10", { watchPoints: 3, latePoints: 6, milestoneWeight: 2 }).state).toBe("good");
  });
});
