import { describe, expect, it } from "vitest";
import { filterEventTasks, filtersQuery, readEventTaskFilters } from "./event-task-filters";
import { periodRange } from "@/modules/events/task-filters";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const CATEGORY = "00000000-0000-4000-8000-0000000000c1";

const tasks = [
  { id: "a", dueDate: "2026-11-20", done: false, responsible: "planner" as const, assigneeUserId: ME, categoryId: CATEGORY },
  { id: "b", dueDate: "2026-11-29", done: false, responsible: "clients" as const, assigneeUserId: null, categoryId: null },
  { id: "c", dueDate: "2026-12-14", done: false, responsible: "planner" as const, assigneeUserId: OTHER, categoryId: null },
  { id: "d", dueDate: "2026-11-02", done: true, responsible: "vendor" as const, assigneeUserId: null, categoryId: CATEGORY },
];

const run = (query: Record<string, string>) => filterEventTasks(tasks, readEventTaskFilters(query), { today: "2026-11-25", meId: ME, periodRange }).map((task) => task.id);

describe("CHR-03, EVT-03 — Les filtres de l'onglet « Tâches » de la fiche (lot 70c, A21)", () => {
  it("par défaut : « À faire », tout le monde, toutes périodes, toutes catégories", () => {
    expect(readEventTaskFilters({})).toEqual({ who: "all", period: "all", category: "all", state: "todo" });
    expect(run({})).toEqual(["a", "b", "c"]);
  });

  it("Qui s'en charge : vous, un collègue, les clients, les prestataires", () => {
    expect(run({ qui: "moi" })).toEqual(["a"]);
    expect(run({ qui: `member:${OTHER}` })).toEqual(["c"]);
    expect(run({ qui: "clients" })).toEqual(["b"]);
    expect(run({ qui: "prestataires", etat: "toutes" })).toEqual(["d"]);
  });

  it("Période : en retard, cette semaine, les 15 prochains jours, ce mois-ci", () => {
    expect(run({ periode: "en-retard" })).toEqual(["a"]);
    expect(run({ periode: "semaine" })).toEqual(["b"]);
    expect(run({ periode: "quinzaine" })).toEqual(["a", "b"]);
    expect(run({ periode: "mois" })).toEqual(["a", "b"]);
  });

  it("Catégorie et État", () => {
    expect(run({ categorie: CATEGORY, etat: "toutes" })).toEqual(["a", "d"]);
    expect(run({ etat: "faites" })).toEqual(["d"]);
  });

  it("une valeur inconnue revient à la valeur par défaut ; l'ancienne « vue » se lit encore", () => {
    expect(readEventTaskFilters({ qui: "<script>", periode: "x", categorie: "pas-un-id", etat: "x" })).toEqual({ who: "all", period: "all", category: "all", state: "todo" });
    expect(readEventTaskFilters({ vue: "toutes" }).state).toBe("all");
    expect(readEventTaskFilters({ vue: "en-retard" }).period).toBe("late");
  });

  it("l'adresse ne garde que les filtres posés", () => {
    expect(filtersQuery(readEventTaskFilters({}))).toEqual({});
    expect(filtersQuery(readEventTaskFilters({ qui: "clients", etat: "faites" }))).toEqual({ qui: "clients", etat: "faites" });
  });
});
