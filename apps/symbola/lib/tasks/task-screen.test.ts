// Lot 70d (CHR-02, CHR-03, CHR-10, UX-08 ; C-31, C-33, C-37, D1) — l'écran « Tâches » sans React : adresse,
// anciennes adresses, pastilles, décompte, état vide et regroupements.
import { describe, expect, it } from "vitest";
import { activeFilters, countLine, DEFAULT_VIEW, doneTotal, emptyKind, groupLines, listFiltersOf, readTaskScreen, taskScreenHref, withoutFilter, withoutFilters, withView, dayWord, type GroupableLine } from "./task-screen";

const EVENT = "0b9d5c1e-2f4a-4b6c-8d7e-9f0a1b2c3d4e";
const MEMBER = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const CATEGORY = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a";

describe("CHR-03 crit. 2 et 10 — l'adresse de « Tâches » : filtres nommés, anciennes adresses", () => {
  it("sans paramètre : à faire, tout le monde, toutes les périodes, groupé par mois", () => {
    expect(readTaskScreen({})).toEqual({ view: DEFAULT_VIEW, legacy: false });
    expect(taskScreenHref(DEFAULT_VIEW)).toBe("/taches");
  });

  it("chaque filtre se lit et s'écrit, avec des identifiants seulement (aucun nom dans l'adresse)", () => {
    const query = { evenement: EVENT, qui: MEMBER, periode: "15j", categorie: CATEGORY, etat: "toutes", grouper: "qui" };
    const { view, legacy } = readTaskScreen(query);
    expect(legacy).toBe(false);
    expect(view).toEqual({ event: { kind: "event", eventId: EVENT }, who: { kind: "member", userId: MEMBER }, period: { kind: "fortnight" }, category: CATEGORY, state: "all", group: "who", calendar: false, month: null });
    expect(Object.fromEntries(new URL(taskScreenHref(view), "http://x").searchParams)).toEqual(query);
    expect(listFiltersOf(view)).toEqual({ state: "all", event: { kind: "event", eventId: EVENT }, assignee: { kind: "member", userId: MEMBER }, period: { kind: "fortnight" }, categoryId: CATEGORY });
  });

  it("« Hors évènement », « Mes tâches », les clients, les prestataires, entre deux dates (remises dans l'ordre)", () => {
    expect(listFiltersOf(readTaskScreen({ evenement: "hors" }).view).event).toEqual({ kind: "none" });
    expect(listFiltersOf(readTaskScreen({ qui: "moi" }).view).assignee).toEqual({ kind: "me" });
    expect(listFiltersOf(readTaskScreen({ qui: "clients" }).view).assignee).toEqual({ kind: "clients" });
    expect(listFiltersOf(readTaskScreen({ qui: "prestataires" }).view).assignee).toEqual({ kind: "vendors" });
    expect(readTaskScreen({ periode: "entre", du: "2027-03-31", au: "2027-03-01" }).view.period).toEqual({ kind: "between", from: "2027-03-01", to: "2027-03-31" });
    expect(readTaskScreen({ periode: "entre", du: "2027-02-30", au: "2027-03-01" }).view.period).toEqual({ kind: "all" });
  });

  it("une valeur inconnue ou inventée revient au défaut (jamais d'erreur, jamais de nom)", () => {
    const { view } = readTaskScreen({ evenement: "Léa & Maxime", qui: "bastien@example.test", periode: "hier", categorie: "1", etat: "x", grouper: "y", mois: "2027-13" });
    expect(view).toEqual(DEFAULT_VIEW);
  });

  it("les anciennes adresses mènent à la vue équivalente", () => {
    const cases: [Record<string, string>, string][] = [
      [{ vue: "en-retard" }, "/taches?periode=retard"],
      [{ vue: "faites" }, "/taches?etat=faites"],
      [{ vue: "toutes", qui: "planner" }, "/taches?etat=toutes"],
      [{ vue: "a-faire", qui: "clients" }, "/taches?qui=clients"],
      [{ qui: "tous" }, "/taches"],
      [{ qui: `member:${MEMBER}` }, `/taches?qui=${MEMBER}`],
      [{ periode: "en-retard" }, "/taches?periode=retard"],
      [{ periode: "quinzaine" }, "/taches?periode=15j"],
    ];
    for (const [query, href] of cases) {
      const read = readTaskScreen(query);
      expect(read.legacy, JSON.stringify(query)).toBe(true);
      expect(taskScreenHref(read.view)).toBe(href);
    }
  });

  it("le calendrier garde les filtres et le regroupement (et son mois)", () => {
    const { view } = readTaskScreen({ qui: "moi", periode: "retard", grouper: "evenement", affichage: "calendrier", mois: "2027-04" });
    expect(taskScreenHref(view)).toBe("/taches?qui=moi&periode=retard&grouper=evenement&affichage=calendrier&mois=2027-04");
    expect(taskScreenHref({ ...view, calendar: false })).toBe("/taches?qui=moi&periode=retard&grouper=evenement");
  });

  it("les faites se rangent par jour par défaut ; « Jour » ne vaut que pour elles", () => {
    expect(readTaskScreen({ etat: "faites" }).view.group).toBe("day");
    expect(readTaskScreen({ grouper: "jour" }).view.group).toBe("month");
    expect(withView(DEFAULT_VIEW, { state: "done" }).group).toBe("day");
    expect(withView(withView(DEFAULT_VIEW, { state: "done" }), { state: "todo" }).group).toBe("month");
    expect(taskScreenHref(withView(DEFAULT_VIEW, { state: "done" }))).toBe("/taches?etat=faites");
  });
});

describe("CHR-03 crit. 2 — les pastilles des filtres posés", () => {
  it("chaque filtre posé est une pastille ; chacune se retire seule ; « Effacer les filtres » rend la liste par défaut", () => {
    const { view } = readTaskScreen({ evenement: EVENT, qui: MEMBER, periode: "retard", etat: "faites", affichage: "calendrier", mois: "2027-04" });
    expect(activeFilters(view)).toEqual(["event", "who", "period", "state"]);
    expect(activeFilters(withoutFilter(view, "who"))).toEqual(["event", "period", "state"]);
    expect(withoutFilter(view, "state").group).toBe("month");
    expect(activeFilters(DEFAULT_VIEW)).toEqual([]);
    const cleared = withoutFilters(view);
    expect(activeFilters(cleared)).toEqual([]);
    expect(cleared.calendar).toBe(true);
    expect(cleared.month).toBe("2027-04");
  });
});

describe("CHR-03 crit. 3 et 4 — le décompte dit combien la liste montre, sur combien, et se recoupe", () => {
  it("sans filtre : « 8 tâches à faire sur 42 · 2 en retard »", () => {
    expect(countLine(DEFAULT_VIEW, { shown: 8, total: 42, todoTotal: 8, late: 2 })).toEqual({ key: "countTodo", values: { count: 8, total: 42 }, filtered: false, late: 2 });
  });

  it("filtré : « 4 tâches sur 11 à faire · filtrées »", () => {
    const { view } = readTaskScreen({ qui: MEMBER, periode: "15j" });
    expect(countLine(view, { shown: 4, total: 42, todoTotal: 11, late: 1 })).toEqual({ key: "countTodoFiltered", values: { count: 4, total: 11 }, filtered: true, late: null });
  });

  it("« En retard » seul : « 5 tâches en retard sur 11 à faire »", () => {
    const { view } = readTaskScreen({ periode: "retard", grouper: "qui" });
    expect(countLine(view, { shown: 5, total: 42, todoTotal: 11, late: 5 })).toEqual({ key: "countLate", values: { count: 5, total: 11 }, filtered: false, late: null });
  });

  it("les faites : « 34 tâches faites sur 42 », et à faire + faites = total", () => {
    const { view } = readTaskScreen({ etat: "faites" });
    expect(countLine(view, { shown: 34, total: 42, todoTotal: 8, late: 0 })).toEqual({ key: "countDone", values: { count: 34, total: 42 }, filtered: false, late: null });
    expect(doneTotal({ total: 42, todoTotal: 8 }) + 8).toBe(42);
  });
});

describe("UX-08, CHR-03 crit. 7 — quatre états vides", () => {
  it("rien encore, tout est fait, aucun résultat ; aucun état vide quand la liste a des lignes", () => {
    expect(emptyKind(DEFAULT_VIEW, { shown: 0, total: 0 })).toBe("new");
    expect(emptyKind(DEFAULT_VIEW, { shown: 0, total: 42 })).toBe("allDone");
    expect(emptyKind(readTaskScreen({ periode: "retard" }).view, { shown: 0, total: 42 })).toBe("noResult");
    expect(emptyKind(readTaskScreen({ etat: "faites" }).view, { shown: 0, total: 3 })).toBe("noResult");
    expect(emptyKind(DEFAULT_VIEW, { shown: 3, total: 42 })).toBeNull();
  });
});

describe("CHR-03 crit. 4 — Grouper par mois, évènement, qui s'en charge, jour", () => {
  const line = (id: string, values: Partial<GroupableLine>): GroupableLine => ({ id, dueDate: "2026-11-20", eventId: null, eventLabel: "Hors évènement", responsibleValue: "planner", whoName: "Personne", late: false, doneDay: null, ...values });
  const lines = [
    line("a", { dueDate: "2026-11-20", eventId: "e1", responsibleValue: `member:${MEMBER}`, whoName: "Vous", late: true }),
    line("b", { dueDate: "2026-11-21", eventId: "e1", responsibleValue: "member:bastien", whoName: "Bastien", late: true }),
    line("c", { dueDate: "2026-11-23", eventId: "e2", responsibleValue: "member:bastien", whoName: "Bastien", late: true }),
    line("d", { dueDate: "2026-11-22", eventId: "e3", responsibleValue: "clients", whoName: "Les mariés", late: true }),
    line("e", { dueDate: "2026-12-01", eventId: null, responsibleValue: "vendor:v1", whoName: "Maison Lumen" }),
  ];

  it("par mois, dans l'ordre des échéances", () => {
    expect(groupLines(lines, "month").map((group) => [group.key, group.lines.map((item) => item.id)])).toEqual([
      ["2026-11", ["a", "b", "c", "d"]],
      ["2026-12", ["e"]],
    ]);
  });

  it("par évènement, « Hors évènement » à sa place", () => {
    expect(groupLines(lines, "event").map((group) => group.key)).toEqual(["e1", "e2", "e3", "none"]);
  });

  it("par personne : la plus en retard d'abord, les clients de tous les évènements ensemble, les prestataires à la fin", () => {
    expect(groupLines(lines, "who").map((group) => [group.key, group.lines.length])).toEqual([
      ["member:bastien", 2],
      ["clients", 1],
      [`member:${MEMBER}`, 1],
      ["vendors", 1],
    ]);
  });

  it("par jour de coche ; « Aujourd'hui », « Hier »", () => {
    const done = [line("x", { doneDay: "2026-11-25" }), line("y", { doneDay: "2026-11-25" }), line("z", { doneDay: "2026-11-24" })];
    expect(groupLines(done, "day").map((group) => [group.key, group.lines.length])).toEqual([
      ["2026-11-25", 2],
      ["2026-11-24", 1],
    ]);
    expect(dayWord("2026-11-25", "2026-11-25")).toBe("today");
    expect(dayWord("2026-11-24", "2026-11-25")).toBe("yesterday");
    expect(dayWord("2026-02-28", "2026-03-01")).toBe("yesterday");
    expect(dayWord("2026-11-20", "2026-11-25")).toBeNull();
  });
});
