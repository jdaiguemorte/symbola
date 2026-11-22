// Lot 63d (HUB-08, BUD-11, CHR-03 ; maquette M3) — le calendrier du mois d'« Aujourd'hui », avec une horloge
// simulée : semaines du lundi au dimanche, jours d'un autre mois, semaine en cours sur téléphone, ordre des
// éléments d'un jour, rendez-vous rangé au jour de Paris autour de minuit et du changement d'heure.
import { describe, expect, it } from "vitest";
import { calendarRange, currentWeek, isCalendarView, isMonthKey, isWeekKey, listDays, mondayOf, monthBounds, monthWeeks, parisDay, sortItems, viewRange, weekDays, type CalendarItem } from "./calendar";

function item(partial: Partial<CalendarItem> & Pick<CalendarItem, "key" | "kind" | "date">): CalendarItem {
  return { label: partial.key, detail: null, href: "/", color: null, categoryLabel: null, overdue: false, highPriority: false, time: null, ...partial };
}

describe("HUB-08 — Calendrier du mois sur « Aujourd'hui » (lot 63d, maquette M3)", () => {
  it("novembre 2026 : six semaines du lundi 26 octobre au dimanche 6 décembre, les jours des autres mois marqués", () => {
    const weeks = monthWeeks("2026-11", "2026-11-21", []);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]![0]).toMatchObject({ date: "2026-10-26", inMonth: false });
    expect(weeks[0]![6]).toMatchObject({ date: "2026-11-01", inMonth: true, weekend: true });
    expect(weeks[4]![6]).toMatchObject({ date: "2026-11-29" });
    expect(weeks[5]![0]).toMatchObject({ date: "2026-11-30", inMonth: true });
    expect(weeks[5]![1]).toMatchObject({ date: "2026-12-01", inMonth: false });
    expect(weeks.flat().filter((day) => day.today).map((day) => day.date)).toEqual(["2026-11-21"]);
    // Février 2027 commence un lundi : quatre semaines.
    expect(monthWeeks("2027-02", "2027-02-10", [])).toHaveLength(4);
  });

  it("chaque élément est à sa date ; un élément d'un autre mois n'apparaît pas dans la grille", () => {
    const weeks = monthWeeks("2026-11", "2026-11-21", [item({ key: "a", kind: "task", date: "2026-11-23" }), item({ key: "b", kind: "event", date: "2026-10-31" })]);
    const days = weeks.flat();
    expect(days.find((day) => day.date === "2026-11-23")!.items.map((entry) => entry.key)).toEqual(["a"]);
    expect(days.find((day) => day.date === "2026-10-31")!.items).toEqual([]);
  });

  it("dans un jour : l'évènement, puis les rendez-vous par heure, les paiements, les tâches (haute priorité d'abord)", () => {
    const sorted = sortItems([
      item({ key: "tâche", kind: "task", date: "2026-11-14", label: "Relancer" }),
      item({ key: "haute", kind: "task", date: "2026-11-14", label: "Signer", highPriority: true }),
      item({ key: "solde", kind: "payment", date: "2026-11-14" }),
      item({ key: "rdv-15", kind: "appointment", date: "2026-11-14", time: "15:00" }),
      item({ key: "rdv-09", kind: "appointment", date: "2026-11-14", time: "09:30" }),
      item({ key: "mariage", kind: "event", date: "2026-11-14" }),
    ]);
    expect(sorted.map((entry) => entry.key)).toEqual(["mariage", "rdv-09", "rdv-15", "solde", "haute", "tâche"]);
  });

  it("sur téléphone, la semaine en cours, du lundi au dimanche, même à cheval sur deux mois", () => {
    const week = currentWeek("2026-12-02", [item({ key: "x", kind: "task", date: "2026-11-30" })]);
    expect(week.map((day) => day.date)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
    expect(week[0]!.items.map((entry) => entry.key)).toEqual(["x"]);
    expect(week[2]!.today).toBe(true);
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
  });

  it("ce qu'il faut charger couvre le mois affiché et la semaine en cours", () => {
    expect(calendarRange("2026-11", "2026-11-21")).toEqual({ from: "2026-11-01", until: "2026-11-30" });
    expect(calendarRange("2026-12", "2026-11-21")).toEqual({ from: "2026-11-16", until: "2026-12-31" });
    expect(calendarRange("2026-12", "2026-12-02")).toEqual({ from: "2026-11-30", until: "2026-12-31" });
    expect(monthBounds("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
  });

  it("un rendez-vous se range au jour de Paris : la veille au soir, juste après minuit, au passage à l'heure d'été", () => {
    expect(parisDay("2026-11-21T22:30:00Z")).toBe("2026-11-21");
    expect(parisDay("2026-11-21T23:30:00Z")).toBe("2026-11-22");
    expect(parisDay("2027-03-27T23:30:00Z")).toBe("2027-03-28");
    expect(parisDay("2027-03-28T22:30:00Z")).toBe("2027-03-29");
  });

  it("le mois demandé dans l'adresse est contrôlé", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
  });
});

describe("HUB-08 — Lot 65c : le calendrier d'« Aujourd'hui » par mois, semaine ou liste (M15)", () => {
  const entry = (key: string, date: string) => ({ key, kind: "task" as const, date, label: key, href: "#", color: null, categoryLabel: null, detail: null, time: null, highPriority: false, overdue: false });
  it("une vue inconnue n'est pas reçue ; une semaine est un lundi valide", () => {
    expect(isCalendarView("semaine")).toBe(true);
    expect(isCalendarView("annee")).toBe(false);
    expect(isWeekKey("2026-11-23")).toBe(true);
    expect(isWeekKey("2026-11-24")).toBe(false);
    expect(isWeekKey("2026-02-30")).toBe(false);
    expect(isWeekKey(undefined)).toBe(false);
  });
  it("la semaine : sept jours du lundi au dimanche, y compris à cheval sur deux mois et au passage à l'heure d'hiver", () => {
    const days = weekDays("2026-10-26", "2026-10-28", [entry("a", "2026-11-01"), entry("b", "2026-10-25")]);
    expect(days.map((day) => day.date)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(days[2]!.today).toBe(true);
    expect(days[6]!.items.map((item) => item.key)).toEqual(["a"]);
    expect(days.flatMap((day) => day.items).map((item) => item.key)).not.toContain("b");
  });
  it("la liste : les seuls jours du mois qui ont quelque chose, dans l'ordre", () => {
    const days = listDays("2026-11", "2026-11-23", [entry("c", "2026-11-28"), entry("a", "2026-11-02"), entry("x", "2026-12-01"), entry("b", "2026-11-02")]);
    expect(days.map((day) => [day.date, day.items.length])).toEqual([
      ["2026-11-02", 2],
      ["2026-11-28", 1],
    ]);
  });
  it("chaque vue charge ce qu'elle montre", () => {
    expect(viewRange("semaine", "2026-11", "2026-12-28", "2026-11-23")).toEqual({ from: "2026-12-28", until: "2027-01-03" });
    expect(viewRange("liste", "2026-11", "2026-11-23", "2026-11-23")).toEqual(calendarRange("2026-11", "2026-11-23"));
  });
});
