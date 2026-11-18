// Lot 51 (EVT-04, JRJ-05, JRJ-08, PAR-08 ; ADR 0091) — règles pures du jour J de terrain, sur
// l'appareil comme sur le serveur : heures prévues dans le fuseau de l'évènement (changement
// d'heure compris), première heure retenue, retard et décalage proposé, prestataires concernés,
// jours de l'évènement, bilan prêt le lendemain. Horloge simulée : aucune lecture de l'heure réelle.
import { describe, expect, it } from "vitest";
import {
  concernedVendorSlots,
  eventDays,
  isReportReady,
  itemActuals,
  openingDay,
  originalTimes,
  plannedInstants,
  proposeDayShift,
  reportReadyOn,
  zonedDate,
  zonedInstant,
  type ShiftableItem,
} from "./rules";

const PARIS = "Europe/Paris";

describe("EVT-04 — Évènements sur plusieurs jours et en plusieurs temps forts", () => {
  it("les jours de l'évènement sont ceux de ses temps forts, triés, le jour de l'évènement compris", () => {
    expect(eventDays([{ date: "2027-06-13" }, { date: "2027-06-11" }, { date: "2027-06-12" }, { date: "2027-06-12" }], "2027-06-12")).toEqual(["2027-06-11", "2027-06-12", "2027-06-13"]);
    expect(eventDays([], "2027-06-12")).toEqual(["2027-06-12"]);
    expect(eventDays([], null)).toEqual([]);
  });

  it("le mode Jour J s'ouvre sur le jour en cours, sinon le prochain, sinon le dernier", () => {
    const days = ["2027-06-11", "2027-06-12", "2027-06-13"];
    expect(openingDay(days, "2027-06-12")).toBe("2027-06-12");
    expect(openingDay(days, "2027-06-01")).toBe("2027-06-11");
    expect(openingDay(days, "2027-06-20")).toBe("2027-06-13");
    expect(openingDay([], "2027-06-20")).toBeNull();
  });
});

describe("JRJ-05 — heures prévues dans le fuseau de l'évènement", () => {
  it("une heure murale devient un instant, l'été comme l'hiver", () => {
    expect(zonedInstant("2027-06-12", "16:00", PARIS).toISOString()).toBe("2027-06-12T14:00:00.000Z");
    expect(zonedInstant("2027-01-12", "16:00", PARIS).toISOString()).toBe("2027-01-12T15:00:00.000Z");
    expect(zonedInstant("2027-06-12", "16:00", "America/New_York").toISOString()).toBe("2027-06-12T20:00:00.000Z");
  });

  it("le jour du passage à l'heure d'été (28/03/2027) et à l'heure d'hiver (31/10/2027)", () => {
    // 02:30 n'existe pas le 28 mars : l'heure qui suit le saut.
    expect(zonedInstant("2027-03-28", "02:30", PARIS).toISOString()).toBe("2027-03-28T01:30:00.000Z");
    expect(zonedInstant("2027-03-28", "16:00", PARIS).toISOString()).toBe("2027-03-28T14:00:00.000Z");
    // 02:30 existe deux fois le 31 octobre : la première.
    expect(zonedInstant("2027-10-31", "02:30", PARIS).toISOString()).toBe("2027-10-31T00:30:00.000Z");
    expect(zonedInstant("2027-10-31", "16:00", PARIS).toISOString()).toBe("2027-10-31T15:00:00.000Z");
  });

  it("une fin plus petite que le début passe minuit", () => {
    const planned = plannedInstants({ startTime: "22:00", endTime: "02:00" }, "2027-06-12", PARIS);
    expect(planned.start.toISOString()).toBe("2027-06-12T20:00:00.000Z");
    expect(planned.end?.toISOString()).toBe("2027-06-13T00:00:00.000Z");
    expect(plannedInstants({ startTime: "22:00", endTime: null }, "2027-06-12", PARIS).end).toBeNull();
  });

  it("le jour d'un instant dans le fuseau : la veille, le jour même, le lendemain", () => {
    expect(zonedDate(new Date("2027-06-11T21:59:00Z"), PARIS)).toBe("2027-06-11");
    expect(zonedDate(new Date("2027-06-11T22:00:00Z"), PARIS)).toBe("2027-06-12");
  });
});

describe("JRJ-08 — Partage en temps réel avec l'équipe sur place", () => {
  it("deux pointages simultanés de la même séquence restent : l'écran retient la première heure", () => {
    const actuals = itemActuals([
      { id: "b", itemId: "i1", kind: "started", deviceAt: "2027-06-12T14:20:30Z", userId: "hugo" },
      { id: "a", itemId: "i1", kind: "started", deviceAt: "2027-06-12T14:20:05Z", userId: "camille" },
      { id: "c", itemId: "i1", kind: "finished", deviceAt: "2027-06-12T15:30:00Z", userId: "hugo" },
      { id: "d", itemId: "i2", kind: "started", deviceAt: "2027-06-12T16:00:00Z", userId: "camille" },
    ]);
    expect(actuals).toEqual([
      { itemId: "i1", startedAt: "2027-06-12T14:20:05.000Z", startedBy: "camille", finishedAt: "2027-06-12T15:30:00.000Z", finishedBy: "hugo", count: 3 },
      { itemId: "i2", startedAt: "2027-06-12T16:00:00.000Z", startedBy: "camille", finishedAt: null, finishedBy: null, count: 1 },
    ]);
  });

  it("à la même seconde, l'ordre reste stable (identifiant)", () => {
    const [first] = itemActuals([
      { id: "z", itemId: "i1", kind: "started", deviceAt: "2027-06-12T14:20:00Z", userId: "hugo" },
      { id: "a", itemId: "i1", kind: "started", deviceAt: "2027-06-12T14:20:00Z", userId: "camille" },
    ]);
    expect(first?.startedBy).toBe("camille");
  });
});

const items: ShiftableItem[] = [
  { id: "ceremony", keyMomentId: "samedi", startTime: "16:00", endTime: "16:45", vendorSlotIds: ["officiant"] },
  { id: "cocktail", keyMomentId: "samedi", startTime: "17:00", endTime: "19:00", vendorSlotIds: ["traiteur", "dj"] },
  { id: "bus", keyMomentId: "samedi", startTime: "19:15", endTime: null, vendorSlotIds: ["autocar"] },
  { id: "diner", keyMomentId: "samedi", startTime: "20:00", endTime: "23:30", vendorSlotIds: ["traiteur"] },
  { id: "brunch", keyMomentId: "dimanche", startTime: "11:00", endTime: "14:00", vendorSlotIds: ["traiteur"] },
];

describe("JRJ-05 — Pointage des séquences ; un retard propose le décalage de la suite", () => {
  it("16 h 20, la cérémonie commence avec vingt minutes de retard : la séquence et la suite de ce temps fort, pas le brunch du lendemain", () => {
    const proposal = proposeDayShift({ items, lateItemId: "ceremony", checkpoint: "started", actualAt: new Date("2027-06-12T14:20:00Z"), momentDate: "2027-06-12", timeZone: PARIS, thresholdMinutes: 5 });
    expect(proposal).toEqual({ minutes: 20, itemIds: ["ceremony", "cocktail", "bus", "diner"], vendorSlotIds: ["officiant", "traiteur", "dj", "autocar"] });
  });

  it("une fin en retard décale ce qui suit, pas la séquence finie", () => {
    const proposal = proposeDayShift({ items, lateItemId: "ceremony", checkpoint: "finished", actualAt: new Date("2027-06-12T15:05:00Z"), momentDate: "2027-06-12", timeZone: PARIS, thresholdMinutes: 5 });
    expect(proposal).toEqual({ minutes: 20, itemIds: ["cocktail", "bus", "diner"], vendorSlotIds: ["traiteur", "dj", "autocar"] });
  });

  it("à l'heure, en avance, ou sous le seuil : rien n'est proposé", () => {
    const base = { items, lateItemId: "ceremony", checkpoint: "started" as const, momentDate: "2027-06-12", timeZone: PARIS, thresholdMinutes: 5 };
    expect(proposeDayShift({ ...base, actualAt: new Date("2027-06-12T14:00:00Z") })).toBeNull();
    expect(proposeDayShift({ ...base, actualAt: new Date("2027-06-12T13:50:00Z") })).toBeNull();
    expect(proposeDayShift({ ...base, actualAt: new Date("2027-06-12T14:04:00Z") })).toBeNull();
    expect(proposeDayShift({ ...base, actualAt: new Date("2027-06-12T14:05:00Z") })?.minutes).toBe(5);
  });

  it("la planner décoche une séquence fixe (le bus) : ses prestataires ne sont plus concernés, ceux des autres restent", () => {
    expect(concernedVendorSlots(items, ["cocktail", "diner"])).toEqual(["traiteur", "dj"]);
    expect(concernedVendorSlots(items, ["bus"])).toEqual(["autocar"]);
    expect(concernedVendorSlots(items, [])).toEqual([]);
  });

  it("l'heure prévue d'origine se retrouve sous les décalages appliqués", () => {
    const shifts = [
      { itemIds: ["cocktail", "diner"], minutes: 20, outcome: "applied" as const },
      { itemIds: ["diner"], minutes: 10, outcome: "applied" as const },
      { itemIds: ["diner"], minutes: 30, outcome: "out_of_day" as const },
    ];
    expect(originalTimes({ id: "diner", startTime: "20:30", endTime: "00:00" }, shifts)).toEqual({ startTime: "20:00", endTime: "23:30" });
    expect(originalTimes({ id: "bus", startTime: "19:15", endTime: null }, shifts)).toEqual({ startTime: "19:15", endTime: null });
  });
});

describe("PAR-08 — le bilan est prêt le lendemain, dans le fuseau de l'évènement", () => {
  it("prêt le lendemain du dernier jour, à minuit dans le fuseau : ni la veille, ni le jour même", () => {
    expect(reportReadyOn("2027-06-13")).toBe("2027-06-14");
    expect(isReportReady("2027-06-13", PARIS, new Date("2027-06-12T10:00:00Z"))).toBe(false);
    expect(isReportReady("2027-06-13", PARIS, new Date("2027-06-13T21:59:59Z"))).toBe(false);
    expect(isReportReady("2027-06-13", PARIS, new Date("2027-06-13T22:00:00Z"))).toBe(true);
  });

  it("le changement d'heure ne décale pas le lendemain (31/10/2027 → 01/11 à minuit, UTC+1)", () => {
    expect(isReportReady("2027-10-31", PARIS, new Date("2027-10-31T22:59:00Z"))).toBe(false);
    expect(isReportReady("2027-10-31", PARIS, new Date("2027-10-31T23:00:00Z"))).toBe(true);
    // Au printemps : 28/03/2027 → 29/03 à minuit, UTC+2.
    expect(isReportReady("2027-03-28", PARIS, new Date("2027-03-28T21:59:00Z"))).toBe(false);
    expect(isReportReady("2027-03-28", PARIS, new Date("2027-03-28T22:00:00Z"))).toBe(true);
  });

  it("un évènement à New York : son propre minuit", () => {
    expect(isReportReady("2027-06-12", "America/New_York", new Date("2027-06-13T03:59:00Z"))).toBe(false);
    expect(isReportReady("2027-06-12", "America/New_York", new Date("2027-06-13T04:00:00Z"))).toBe(true);
  });
});
