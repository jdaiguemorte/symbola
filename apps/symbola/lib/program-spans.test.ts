// Lot 30b (CHR-06, décision D7) — durées et heures de fin du programme : la durée
// donne la fin et l'inverse, une fin absente vaut la suivante, après minuit compris.
import { describe, expect, it } from "vitest";
import { durationText, endTimeAfter, minutesBetween, programSpans, spanLabel, type SpanWords } from "./program-spans";

const words: SpanWords = {
  minutes: (minutes) => `${minutes} min`,
  hours: (hours) => `${hours} h`,
  hoursMinutes: (hours, minutes) => `${hours} h ${minutes}`,
  range: (start, end, duration) => `${start} – ${end} · ${duration}`,
};

describe("CHR-06 — Les durées et les heures de fin se calculent seules (lot 30b)", () => {
  it("la durée donne l'heure de fin, après minuit compris", () => {
    expect(endTimeAfter("16:00", 60)).toBe("17:00");
    expect(endTimeAfter("15:30", 45)).toBe("16:15");
    expect(endTimeAfter("23:15", 105)).toBe("01:00");
  });

  it("l'heure de fin donne la durée ; une fin plus petite passe minuit", () => {
    expect(minutesBetween("16:00", "17:30")).toBe(90);
    expect(minutesBetween("23:25", "02:00")).toBe(155);
    expect(minutesBetween("12:00", "12:00")).toBe(1440);
  });

  it("une fin absente vaut le début de la suivante ; la dernière sans fin n'a que son début", () => {
    const spans = programSpans([
      { id: "diner", startTime: "19:00", endTime: null },
      { id: "ceremonie", startTime: "15:30", endTime: "16:15" },
      { id: "cocktail", startTime: "17:00", endTime: null },
    ]);
    expect(spans.map((span) => span.id)).toEqual(["ceremonie", "cocktail", "diner"]);
    expect(spans.map((span) => spanLabel(span, words))).toEqual(["15:30 – 16:15 · 45 min", "17:00 – 19:00 · 2 h", "19:00"]);
    expect(spans.map((span) => [span.computedEnd, span.openEnded])).toEqual([
      [false, false],
      [true, false],
      [true, true],
    ]);
  });

  it("une séquence qui passe minuit garde sa durée", () => {
    const [bal] = programSpans([{ id: "bal", startTime: "23:25", endTime: "02:00" }]);
    expect(spanLabel(bal!, words)).toBe("23:25 – 02:00 · 2 h 35");
  });

  it("durées en minutes, en heures, en heures et minutes", () => {
    expect([45, 60, 90, 0].map((minutes) => durationText(minutes, words))).toEqual(["45 min", "1 h", "1 h 30", "0 min"]);
  });
});
