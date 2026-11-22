// Lot 66a (HUB-28, CHR-05 ; D1 ; ADR 0112) : l'heure d'envoi, horloge simulée (veille, jour même,
// passage à l'heure d'été, fuseau d'un évènement à l'étranger).
import { describe, expect, it } from "vitest";
import { fromDatabaseTime, sendWindowOpen } from "./send-time-rules";

const open = (iso: string, sendTime = "09:00", timeZone?: string) => sendWindowOpen({ now: new Date(iso), sendTime, catchUpHours: 6, ...(timeZone ? { timeZone } : {}) });

describe("HUB-28 — L'heure d'envoi d'un automatisme (66a, D1)", () => {
  it("rien ne part avant l'heure ; à l'heure, l'envoi part ; un envoi manqué part encore pendant six heures, jamais la nuit", () => {
    expect(open("2027-01-10T07:59:00Z")).toBe(false); // 8 h 59 à Paris (hiver)
    expect(open("2027-01-10T08:00:00Z")).toBe(true); // 9 h 00
    expect(open("2027-01-10T13:59:00Z")).toBe(true); // 14 h 59 : rattrapage
    expect(open("2027-01-10T14:00:00Z")).toBe(false); // 15 h 00 : le lendemain
    expect(open("2027-01-10T02:00:00Z")).toBe(false); // 3 h du matin
  });

  it("une heure du soir ne déborde pas sur le lendemain", () => {
    expect(open("2027-01-10T21:30:00Z", "22:30")).toBe(true); // 22 h 30
    expect(open("2027-01-10T22:59:00Z", "22:30")).toBe(true); // 23 h 59
    expect(open("2027-01-10T23:00:00Z", "22:30")).toBe(false); // minuit
  });

  it("au passage à l'heure d'été, 9 h reste 9 h à Paris", () => {
    expect(open("2027-03-28T06:59:00Z")).toBe(false); // 8 h 59, heure d'été
    expect(open("2027-03-28T07:00:00Z")).toBe(true); // 9 h 00, heure d'été
  });

  it("l'heure s'entend dans le fuseau de l'évènement", () => {
    expect(open("2027-01-10T05:00:00Z", "09:00", "Indian/Reunion")).toBe(true); // 9 h à La Réunion
    expect(open("2027-01-10T05:00:00Z", "09:00")).toBe(false); // 6 h à Paris
  });

  it("une heure de la base se lit en « HH:MM »", () => {
    expect(fromDatabaseTime("07:15:00")).toBe("07:15");
    expect(fromDatabaseTime(null)).toBeNull();
  });
});
