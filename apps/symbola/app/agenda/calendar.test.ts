// PRD-HUB-02 — calendrier de l'accueil : mois affichés, week-ends des mariages,
// badge quand deux événements tombent le même week-end.
import { describe, expect, it } from "vitest";
import { addMonths, buildCalendar, type CalendarEvent } from "./calendar";

const events: CalendarEvent[] = [
  { id: "a", date: "2027-06-12", status: "confirmed", names: "Inès & Sacha", isDemo: false },
  { id: "b", date: "2027-06-13", status: "prospect", names: "Léa & Hugo", isDemo: false },
  { id: "c", date: "2027-06-26", status: "quote_sent", names: "Zoé & Paul", isDemo: false },
  { id: "d", date: "2027-07-03", status: "lost", names: "Perdu", isDemo: false },
  { id: "e", date: "2027-09-18", status: "confirmed", names: "Hors période", isDemo: false },
];

describe("PRD-HUB-02 — Calendrier de l'accueil", () => {
  it("affiche le nombre de mois demandé à partir du mois de départ, semaines commençant le lundi", () => {
    const months = buildCalendar({ start: "2027-06", months: 3, events });
    expect(months.map((month) => month.key)).toEqual(["2027-06", "2027-07", "2027-08"]);
    const june = months[0]!;
    // Le 1er juin 2027 est un mardi : une case vide avant.
    expect(june.cells[0]).toBeNull();
    expect(june.cells[1]?.date).toBe("2027-06-01");
    expect(june.cells.filter((cell) => cell !== null)).toHaveLength(30);
  });

  it("un mariage confirmé est plein, une date posée sur un prospect est atténuée ; un événement perdu n'apparaît pas", () => {
    const [june, july] = buildCalendar({ start: "2027-06", months: 2, events });
    const day = (date: string) => [...june!.cells, ...july!.cells].find((cell) => cell?.date === date)!;
    expect(day("2027-06-12").tone).toBe("confirmed");
    expect(day("2027-06-13").tone).toBe("tentative");
    expect(day("2027-06-26").tone).toBe("tentative");
    expect(day("2027-07-03").events).toEqual([]);
    expect(day("2027-07-03").tone).toBe("none");
  });

  it("étant donné deux événements le même week-end, les deux sont affichés avec un badge « 2 »", () => {
    const [june] = buildCalendar({ start: "2027-06", months: 1, events });
    const saturday = june!.cells.find((cell) => cell?.date === "2027-06-12")!;
    const sunday = june!.cells.find((cell) => cell?.date === "2027-06-13")!;
    expect(saturday.weekendCount).toBe(2);
    expect(sunday.weekendCount).toBe(2);
    expect(saturday.weekendEvents.map((event) => event.id)).toEqual(["a", "b"]);
    expect(june!.cells.find((cell) => cell?.date === "2027-06-26")!.weekendCount).toBe(1);
  });

  it("change d'année et recule correctement", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2027-02", -6)).toBe("2026-08");
    expect(buildCalendar({ start: "2026-12", months: 2, events: [] }).map((month) => month.key)).toEqual(["2026-12", "2027-01"]);
  });
});
