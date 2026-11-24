// Lot 67b (HUB-08, CHR-03, CHR-10 ; recette du 24/11/2026, R01) — le compte des tâches du menu et de
// la page Tâches : tâches d'évènement et tâches hors évènement, ensemble.
import { describe, expect, it } from "vitest";
import { countTasks } from "./task-counts";

const today = "2026-11-24";

describe("HUB-08, CHR-10 — Un seul compte des tâches (lot 67b)", () => {
  it("compte les tâches à faire des évènements et hors évènement", () => {
    const eventTasks = [
      { done: false, dueDate: "2026-12-01", overdue: false },
      { done: false, dueDate: "2026-10-17", overdue: true },
      { done: true, dueDate: "2026-11-01", overdue: false },
    ];
    const standalone = [
      { done: false, dueDate: "2026-11-22" },
      { done: false, dueDate: "2026-11-30" },
      { done: true, dueDate: "2026-11-10" },
    ];
    expect(countTasks(eventTasks, standalone, today)).toEqual({ todo: 4, overdue: 2 });
  });

  it("une tâche hors évènement à échéance aujourd'hui n'est pas en retard ; celle d'hier l'est", () => {
    expect(countTasks([], [{ done: false, dueDate: today }], today).overdue).toBe(0);
    expect(countTasks([], [{ done: false, dueDate: "2026-11-23" }], today).overdue).toBe(1);
  });

  it("une tâche faite ne compte ni à faire ni en retard", () => {
    expect(countTasks([], [{ done: true, dueDate: "2026-01-01" }], today)).toEqual({ todo: 0, overdue: 0 });
  });
});
