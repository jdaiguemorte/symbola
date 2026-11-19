// Lot 35c (RGP-11, D8, ADR 0100) — calendrier d'une fermeture à l'horloge simulée : suppression au
// 30e jour à minuit (Paris), préavis sept jours avant ; la veille, le jour même, et les nuits de
// changement d'heure.
import { describe, expect, it } from "vitest";
import { closureSchedule, daysBeforeDeletion, parisMidnight } from "./closure-schedule";

describe("RGP-11 — Calendrier de la fermeture d'un espace (lot 35c)", () => {
  it("fermée le 10 novembre à 15 h, l'organisation est supprimée le 10 décembre à minuit (Paris), préavis le 3 décembre", () => {
    const schedule = closureSchedule(new Date("2026-11-10T14:00:00Z"));
    expect(schedule.deletionDueAt.toISOString()).toBe("2026-12-09T23:00:00.000Z");
    expect(schedule.noticeAt.toISOString()).toBe("2026-12-02T23:00:00.000Z");
  });

  it("une fermeture à 0 h 30 compte le jour même ; à 23 h 59, aussi (jour de Paris, pas d'UTC)", () => {
    expect(closureSchedule(new Date("2026-11-09T23:30:00Z")).deletionDueAt.toISOString()).toBe("2026-12-09T23:00:00.000Z");
    expect(closureSchedule(new Date("2026-11-10T22:59:00Z")).deletionDueAt.toISOString()).toBe("2026-12-09T23:00:00.000Z");
  });

  it("passage à l'heure d'été : fermée le 15 mars, supprimée le 14 avril à minuit d'été (22 h UTC)", () => {
    const schedule = closureSchedule(new Date("2027-03-15T10:00:00Z"));
    expect(schedule.deletionDueAt.toISOString()).toBe("2027-04-13T22:00:00.000Z");
    expect(schedule.noticeAt.toISOString()).toBe("2027-04-06T22:00:00.000Z");
  });

  it("passage à l'heure d'hiver : fermée le 10 octobre, supprimée le 9 novembre à minuit d'hiver (23 h UTC)", () => {
    expect(closureSchedule(new Date("2027-10-10T10:00:00Z")).deletionDueAt.toISOString()).toBe("2027-11-08T23:00:00.000Z");
  });

  it("minuit de Paris les nuits de changement d'heure", () => {
    expect(parisMidnight("2027-03-28").toISOString()).toBe("2027-03-27T23:00:00.000Z");
    expect(parisMidnight("2027-03-29").toISOString()).toBe("2027-03-28T22:00:00.000Z");
    expect(parisMidnight("2027-10-31").toISOString()).toBe("2027-10-30T22:00:00.000Z");
    expect(parisMidnight("2027-11-01").toISOString()).toBe("2027-10-31T23:00:00.000Z");
  });

  it("jours restants : 29 le lendemain de la fermeture, 0 la veille de la suppression (dernier jour d'export)", () => {
    const { deletionDueAt } = closureSchedule(new Date("2026-11-10T14:00:00Z"));
    expect(daysBeforeDeletion(deletionDueAt, new Date("2026-11-10T14:00:00Z"))).toBe(29);
    expect(daysBeforeDeletion(deletionDueAt, new Date("2026-12-09T22:59:59Z"))).toBe(0);
  });
});
