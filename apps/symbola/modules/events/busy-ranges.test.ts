import { describe, expect, it } from "vitest";
import { busyRange, busyRangeDates, busyRuleMinutes, isBlocking, isValidBusyRule, overlapsWindow, resolveBusyRule, type BusyRule } from "./busy-ranges";

const wedding: BusyRule = { startDayOffset: 0, startTime: "08:00", endDayOffset: 0, endTime: "22:00" };
const ownRule: BusyRule = { startDayOffset: -1, startTime: "14:00", endDayOffset: 1, endTime: "12:00" };
const fallback: BusyRule = { startDayOffset: 0, startTime: "08:00", endDayOffset: 0, endTime: "22:00" };

describe("HUB-29 — Plages occupées : la règle d'un évènement (lot 64, D1)", () => {
  it("le réglage propre de l'évènement passe avant la règle de son type", () => {
    expect(resolveBusyRule({ own: ownRule, type: wedding, fallback })).toEqual({ rule: ownRule, source: "event" });
  });

  it("sans réglage propre, la règle du type ; sans type, la règle de repli", () => {
    expect(resolveBusyRule({ own: null, type: wedding, fallback })).toEqual({ rule: wedding, source: "type" });
    expect(resolveBusyRule({ own: null, type: null, fallback })).toEqual({ rule: fallback, source: "fallback" });
  });

  it("une règle valable : jours de -7 à 7, heures HH:MM, la fin après le début (D6)", () => {
    expect(isValidBusyRule(wedding)).toBe(true);
    expect(isValidBusyRule(ownRule)).toBe(true);
    expect(isValidBusyRule({ ...wedding, endTime: "08:00" })).toBe(false);
    expect(isValidBusyRule({ ...wedding, startTime: "23:00", endTime: "22:00" })).toBe(false);
    expect(isValidBusyRule({ ...wedding, startDayOffset: -8 })).toBe(false);
    expect(isValidBusyRule({ ...wedding, endDayOffset: 8 })).toBe(false);
    expect(isValidBusyRule({ ...wedding, endTime: "24:00" })).toBe(false);
    expect(isValidBusyRule({ ...wedding, startDayOffset: 0.5 })).toBe(false);
    // La veille au soir jusqu'au lendemain matin : la fin vient après le début.
    expect(isValidBusyRule({ startDayOffset: -1, startTime: "22:00", endDayOffset: 0, endTime: "06:00" })).toBe(true);
    expect(busyRuleMinutes(wedding)).toBe(14 * 60);
    expect(busyRuleMinutes(ownRule)).toBe(46 * 60);
  });

  it("accepte l'heure lue en base (« 08:00:00 »)", () => {
    expect(isValidBusyRule({ ...wedding, startTime: "08:00:00", endTime: "22:00:00" })).toBe(true);
  });
});

describe("HUB-29 — Plages occupées : instants à l'heure locale de l'évènement (lot 64, ARC-17)", () => {
  it("un mariage d'été à Paris : 8 h et 22 h locales (UTC+2)", () => {
    const range = busyRange("2027-06-12", wedding, "Europe/Paris");
    expect(range.start.toISOString()).toBe("2027-06-12T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-06-12T20:00:00.000Z");
  });

  it("de la veille à 14 h au lendemain à 12 h, recalé sur la date (report compris)", () => {
    expect(busyRangeDates("2027-06-12", ownRule)).toEqual({ startDate: "2027-06-11", endDate: "2027-06-13" });
    const range = busyRange("2027-06-12", ownRule, "Europe/Paris");
    expect(range.start.toISOString()).toBe("2027-06-11T12:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-06-13T10:00:00.000Z");
    // Reporté au 18 septembre : la même règle, la nouvelle veille et le nouveau lendemain.
    const postponed = busyRange("2027-09-18", ownRule, "Europe/Paris");
    expect(postponed.start.toISOString()).toBe("2027-09-17T12:00:00.000Z");
    expect(postponed.end.toISOString()).toBe("2027-09-19T10:00:00.000Z");
  });

  it("passage à l'heure d'été (28 mars 2027) : 8 h reste 8 h, la journée fait 13 h", () => {
    const range = busyRange("2027-03-28", wedding, "Europe/Paris");
    expect(range.start.toISOString()).toBe("2027-03-28T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-03-28T20:00:00.000Z");
    const eve = busyRange("2027-03-28", { startDayOffset: -1, startTime: "08:00", endDayOffset: 0, endTime: "08:00" }, "Europe/Paris");
    expect(eve.start.toISOString()).toBe("2027-03-27T07:00:00.000Z");
    expect((eve.end.getTime() - eve.start.getTime()) / 3_600_000).toBe(23);
  });

  it("retour à l'heure d'hiver (31 octobre 2027) : 8 h reste 8 h (UTC+1)", () => {
    const range = busyRange("2027-10-31", wedding, "Europe/Paris");
    expect(range.start.toISOString()).toBe("2027-10-31T07:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-10-31T21:00:00.000Z");
  });

  it("un évènement hors de France suit son propre fuseau", () => {
    const range = busyRange("2027-06-12", wedding, "America/Martinique");
    expect(range.start.toISOString()).toBe("2027-06-12T12:00:00.000Z");
  });

  it("fin de mois et d'année : la veille du 1er janvier est le 31 décembre", () => {
    expect(busyRangeDates("2028-01-01", ownRule)).toEqual({ startDate: "2027-12-31", endDate: "2028-01-02" });
    expect(busyRangeDates("2028-03-01", { ...ownRule, startDayOffset: -1 })).toEqual({ startDate: "2028-02-29", endDate: "2028-03-02" });
  });
});

describe("RDV-02 — Plages occupées : ce qui bloque (lot 64, D2)", () => {
  const dated = { isDemo: false, eventDate: "2027-06-12" };

  it("confirmé, en préparation et clôturé bloquent toujours", () => {
    for (const status of ["confirmed", "closed"] as const) expect(isBlocking({ ...dated, status }, false)).toBe(true);
  });

  it("une option ou un report en cours ne bloque que si l'organisation l'a réglé", () => {
    for (const status of ["option", "postponed"] as const) {
      expect(isBlocking({ ...dated, status }, false)).toBe(false);
      expect(isBlocking({ ...dated, status }, true)).toBe(true);
    }
  });

  it("ne bloquent jamais : annulé, essai, évènement sans date", () => {
    expect(isBlocking({ ...dated, status: "cancelled" }, true)).toBe(false);
    expect(isBlocking({ ...dated, status: "confirmed", isDemo: true }, true)).toBe(false);
    expect(isBlocking({ status: "confirmed", isDemo: false, eventDate: null }, true)).toBe(false);
  });

  it("une plage touche une fenêtre si elle la chevauche, bornes exclues", () => {
    const range = { start: new Date("2027-06-12T06:00:00Z"), end: new Date("2027-06-12T20:00:00Z") };
    expect(overlapsWindow(range, { from: new Date("2027-06-12T19:00:00Z"), to: new Date("2027-06-13T00:00:00Z") })).toBe(true);
    expect(overlapsWindow(range, { from: new Date("2027-06-12T20:00:00Z"), to: new Date("2027-06-13T00:00:00Z") })).toBe(false);
    expect(overlapsWindow(range, { from: new Date("2027-06-11T00:00:00Z"), to: new Date("2027-06-12T06:00:00Z") })).toBe(false);
  });
});
