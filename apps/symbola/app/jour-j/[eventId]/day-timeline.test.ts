// Lot 30a (JRJ-01, décision D2) — « Maintenant » et « Ensuite » avec une horloge
// simulée : avant le jour J, séquence en cours, pause, fin absente, après minuit,
// chevauchement, programme terminé, passage à l'heure d'été.
import { describe, expect, it } from "vitest";
import { dayMoment, durationParts, spanMinutes, timelineSpans, type TimelineItem } from "./day-timeline";

const DAY = "2027-06-12";
const item = (id: string, startTime: string, endTime: string | null = null): TimelineItem => ({ id, startTime, endTime });
const paris = (local: string) => new Date(`${local}+02:00`);

const wedding = [
  item("acces", "09:00", "10:00"),
  item("deco", "10:00", "12:00"),
  item("dejeuner", "13:00", "13:30"),
  item("ceremonie", "15:30", "16:15"),
  item("sortie", "16:15", "16:30"),
  item("soiree", "23:25", "02:00"),
];

describe("JRJ-01 — « Maintenant » et « Ensuite » (décision D2)", () => {
  it("avant le jour J : combien de jours, et la première séquence en « Ensuite »", () => {
    expect(dayMoment(wedding, DAY, paris("2027-06-11T20:00:00"))).toEqual({ phase: "before", daysUntil: 1, nextId: "acces" });
    expect(dayMoment(wedding, DAY, paris("2027-06-01T08:00:00"))).toMatchObject({ phase: "before", daysUntil: 11 });
  });

  it("le jour même : la séquence en cours, ce qui lui reste, la suivante et dans combien de temps", () => {
    expect(dayMoment(wedding, DAY, paris("2027-06-12T15:40:00"))).toEqual({ phase: "now", currentId: "ceremonie", endsInMinutes: 35, nextId: "sortie", nextStartsInMinutes: 35 });
  });

  it("le matin avant la première séquence, et entre deux séquences : une pause jusqu'à la suivante", () => {
    expect(dayMoment(wedding, DAY, paris("2027-06-12T08:00:00"))).toEqual({ phase: "pause", nextId: "acces", nextStartsInMinutes: 60 });
    expect(dayMoment(wedding, DAY, paris("2027-06-12T12:20:00"))).toEqual({ phase: "pause", nextId: "dejeuner", nextStartsInMinutes: 40 });
  });

  it("à l'heure pile, la séquence qui commence est en cours", () => {
    expect(dayMoment(wedding, DAY, paris("2027-06-12T10:00:00"))).toMatchObject({ phase: "now", currentId: "deco" });
  });

  it("une fin absente vaut le début de la suivante ; la dernière dure jusqu'à minuit", () => {
    const open = [item("cocktail", "17:00"), item("diner", "19:30"), item("bal", "23:00")];
    expect(dayMoment(open, DAY, paris("2027-06-12T18:00:00"))).toMatchObject({ phase: "now", currentId: "cocktail", endsInMinutes: 90 });
    expect(spanMinutes(open, "cocktail")).toBe(150);
    expect(dayMoment(open, DAY, paris("2027-06-12T23:50:00"))).toMatchObject({ phase: "now", currentId: "bal", endsInMinutes: 10 });
    expect(dayMoment(open, DAY, paris("2027-06-13T00:10:00"))).toEqual({ phase: "over" });
  });

  it("une séquence qui passe minuit reste en cours le lendemain, jusqu'à sa fin", () => {
    expect(dayMoment(wedding, DAY, paris("2027-06-13T01:00:00"))).toEqual({ phase: "now", currentId: "soiree", endsInMinutes: 60, nextId: null, nextStartsInMinutes: null });
    expect(dayMoment(wedding, DAY, paris("2027-06-13T02:30:00"))).toEqual({ phase: "over" });
    expect(dayMoment(wedding, DAY, paris("2027-06-20T10:00:00"))).toEqual({ phase: "over" });
  });

  it("deux séquences en même temps : la plus récente est « Maintenant »", () => {
    const overlap = [item("photos", "16:00", "18:00"), item("cocktail", "17:00", "19:00")];
    expect(dayMoment(overlap, DAY, paris("2027-06-12T17:30:00"))).toMatchObject({ phase: "now", currentId: "cocktail" });
  });

  it("la nuit du passage à l'heure d'été (28 mars 2027), l'horloge murale fait foi", () => {
    const night = [item("soiree", "23:00", "03:00")];
    // 01:30, heure d'hiver encore : en cours.
    expect(dayMoment(night, "2027-03-27", new Date("2027-03-28T01:30:00+01:00"))).toMatchObject({ phase: "now", currentId: "soiree", endsInMinutes: 90 });
    // 03:10, heure d'été (02:00 est devenu 03:00) : terminé.
    expect(dayMoment(night, "2027-03-27", new Date("2027-03-28T03:10:00+02:00"))).toEqual({ phase: "over" });
  });

  it("sans programme : rien à afficher", () => {
    expect(dayMoment([], DAY, paris("2027-06-12T10:00:00"))).toEqual({ phase: "empty" });
  });

  it("durées : heures et minutes ; séquences triées par heure de début", () => {
    expect(durationParts(90)).toEqual({ hours: 1, minutes: 30 });
    expect(durationParts(45)).toEqual({ hours: 0, minutes: 45 });
    expect(timelineSpans([item("b", "14:00", "15:00"), item("a", "09:00", "10:00")]).map((span) => span.id)).toEqual(["a", "b"]);
  });
});
