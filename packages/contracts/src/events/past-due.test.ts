import { describe, expect, it } from "vitest";
import { addDays, DEFAULT_PAST_DUE_SPREAD, isWorkingDay, pastDueAnswersSchema, pastDueOutcomes, publicHolidaysBetween, spreadDueDates, templateDueDate } from "./past-due";

// Le rétroplanning de départ des mariages (18 tâches, de J-365 à J+30), comme packages/starter-templates.
const OFFSETS = [-365, -365, -330, -300, -300, -240, -240, -210, -180, -120, -90, -90, -45, -30, -21, -14, -10, 30];
const ITEMS = OFFSETS.map((offsetDays, index) => ({ id: `item-${index}`, offsetDays }));
const HOLIDAYS = { fixed: ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"], easterOffsets: [1, 39, 50] };

describe("EVT-01, CHR-01 — Les échéances déjà passées d'un mariage créé (lot 74b, B7)", () => {
  it("critère 1 : créé le 25/11/2026 pour le 12/06/2027, 8 des 18 tâches tombent avant aujourd'hui", () => {
    const outcomes = pastDueOutcomes(ITEMS, { eventDate: "2027-06-12", today: "2026-11-25", answers: {}, spread: DEFAULT_PAST_DUE_SPREAD, holidays: new Set() });
    expect(outcomes.filter((outcome) => outcome.past)).toHaveLength(8);
    // Rien n'est coché : sans réponse, chaque tâche passée est « à dater ».
    expect(outcomes.filter((outcome) => outcome.past).every((outcome) => outcome.kind === "undated")).toBe(true);
  });

  it("la veille et le jour même : une tâche due aujourd'hui n'est pas « passée », celle d'hier l'est", () => {
    const items = [
      { id: "yesterday", offsetDays: -1 },
      { id: "today", offsetDays: 0 },
    ];
    const outcomes = pastDueOutcomes(items, { eventDate: "2026-11-25", today: "2026-11-25", answers: {}, spread: "4w", holidays: new Set() });
    expect(outcomes.map((outcome) => [outcome.id, outcome.past])).toEqual([
      ["yesterday", true],
      ["today", false],
    ]);
  });

  it("critère 2 : quelle que soit la réponse, aucune tâche ne garde une échéance avant aujourd'hui", () => {
    for (const answer of ["done", "todo", undefined] as const) {
      for (const spread of ["2w", "4w", "8w", "undated"] as const) {
        const answers = Object.fromEntries(ITEMS.slice(0, 8).map((item) => [item.id, answer]).filter(([, value]) => value));
        const outcomes = pastDueOutcomes(ITEMS, { eventDate: "2027-06-12", today: "2026-11-25", answers, spread, holidays: new Set() });
        for (const outcome of outcomes) if (outcome.kind === "dated") expect(outcome.dueDate >= "2026-11-25").toBe(true);
      }
    }
  });

  it("critère 3 : « Déjà fait » donne une tâche faite", () => {
    const outcomes = pastDueOutcomes(ITEMS, { eventDate: "2027-06-12", today: "2026-11-25", answers: { "item-0": "done" }, spread: "4w", holidays: new Set() });
    expect(outcomes[0]).toMatchObject({ kind: "done", past: true });
  });

  it("critère 4 : « À faire » sur 4 semaines, entre demain et J+28, jours ouvrés, dans l'ordre du modèle, jamais après la tâche suivante", () => {
    const answers = Object.fromEntries(ITEMS.slice(0, 8).map((item) => [item.id, "todo" as const]));
    const holidays = publicHolidaysBetween("2026-11-26", "2027-01-31", HOLIDAYS);
    const outcomes = pastDueOutcomes(ITEMS, { eventDate: "2027-06-12", today: "2026-11-25", answers, spread: "4w", holidays });
    const dates = outcomes.slice(0, 8).map((outcome) => (outcome.kind === "dated" ? outcome.dueDate : ""));
    // La tâche suivante du modèle (J-180) tombe le 14/12/2026.
    const next = templateDueDate("2027-06-12", -180);
    expect(next).toBe("2026-12-14");
    for (const date of dates) {
      expect(date >= "2026-11-26").toBe(true);
      expect(date <= addDays("2026-11-25", 28)).toBe(true);
      expect(date <= next).toBe(true);
      expect(isWorkingDay(date, holidays)).toBe(true);
    }
    expect([...dates].sort()).toEqual(dates);
    // Les tâches à venir gardent la date du modèle.
    expect(outcomes[8]).toMatchObject({ kind: "dated", dueDate: "2026-12-14", past: false });
  });

  it("la répartition franchit un week-end sans y poser de tâche", () => {
    // Vendredi 27/11/2026 : demain est un samedi.
    expect(spreadDueDates(3, "2026-11-27", "2w", null, new Set())).toEqual(["2026-11-30", "2026-12-07", "2026-12-11"]);
    const dates = spreadDueDates(10, "2026-11-27", "2w", null, new Set());
    for (const date of dates) expect(isWorkingDay(date, new Set())).toBe(true);
    expect(dates[0]! >= "2026-11-30").toBe(true);
  });

  it("un jour férié n'est pas compté comme jour ouvré (Noël, lundi de Pâques)", () => {
    const holidays = publicHolidaysBetween("2026-12-01", "2027-04-30", HOLIDAYS);
    expect(holidays.has("2026-12-25")).toBe(true);
    // Pâques 2027 : le dimanche 28 mars ; le lundi de Pâques est le 29.
    expect(holidays.has("2027-03-29")).toBe(true);
    expect(holidays.has("2027-05-06")).toBe(false);
    expect(publicHolidaysBetween("2027-05-01", "2027-05-31", HOLIDAYS).has("2027-05-06")).toBe(true);
    const dates = spreadDueDates(40, "2026-12-20", "2w", null, holidays);
    expect(dates).not.toContain("2026-12-25");
    expect(isWorkingDay("2026-12-25", holidays)).toBe(false);
  });

  it("le passage à l'heure d'été du 28/03/2027 ne fait ni gagner ni perdre un jour", () => {
    expect(addDays("2027-03-27", 1)).toBe("2027-03-28");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
    const holidays = publicHolidaysBetween("2027-03-01", "2027-04-30", HOLIDAYS);
    const dates = spreadDueDates(5, "2027-03-26", "2w", null, holidays);
    // Ni le week-end du changement d'heure, ni le lundi de Pâques.
    expect(dates.some((date) => ["2027-03-27", "2027-03-28", "2027-03-29"].includes(date))).toBe(false);
    expect(dates[dates.length - 1]! <= "2027-04-09").toBe(true);
  });

  it("« Laisser à dater » : les tâches à faire sont créées à dater", () => {
    const answers = { "item-0": "todo" as const };
    const outcomes = pastDueOutcomes(ITEMS, { eventDate: "2027-06-12", today: "2026-11-25", answers, spread: "undated", holidays: new Set() });
    expect(outcomes[0]).toMatchObject({ kind: "undated" });
  });

  it("une tâche suivante due aujourd'hui borne la répartition à aujourd'hui, jamais avant", () => {
    const items = [
      { id: "a", offsetDays: -10 },
      { id: "b", offsetDays: 0 },
    ];
    const outcomes = pastDueOutcomes(items, { eventDate: "2026-11-25", today: "2026-11-25", answers: { a: "todo" }, spread: "4w", holidays: new Set() });
    expect(outcomes[0]).toMatchObject({ kind: "dated", dueDate: "2026-11-25" });
  });

  it("les réponses se valident : identifiants, réponses et répartition connus seulement", () => {
    expect(pastDueAnswersSchema.safeParse({ spread: "4w", answers: { "0b9a8f43-5a3e-4b7e-9c41-0f7a3c2d1e00": "done" } }).success).toBe(true);
    expect(pastDueAnswersSchema.safeParse({ spread: "3w", answers: {} }).success).toBe(false);
    expect(pastDueAnswersSchema.safeParse({ spread: "4w", answers: { "pas-un-id": "done" } }).success).toBe(false);
    expect(pastDueAnswersSchema.safeParse({ spread: "4w", answers: { "0b9a8f43-5a3e-4b7e-9c41-0f7a3c2d1e00": "late" } }).success).toBe(false);
  });
});
