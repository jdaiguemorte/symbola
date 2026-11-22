// Lot 66b (JRJ-01, HUB-28 ; D2, D3 ; ADR 0112) : le jour et l'heure du rappel du jour J, horloge simulée
// (la veille, le jour même, le passage à l'heure d'été, un évènement à l'étranger).
import { describe, expect, it } from "vitest";
import type { DayReminderSetting } from "@symbola/contracts";
import { dayReminderDue, dayReminderSendDate, effectiveDayReminder } from "./day-reminder-rules";

const eve: DayReminderSetting = { target: "planner", enabled: true, moment: "eve", sendTime: "18:00" };
const morning: DayReminderSetting = { target: "team", enabled: true, moment: "morning", sendTime: "07:00" };
const due = (setting: DayReminderSetting, iso: string, eventDate = "2027-06-12", timeZone = "Europe/Paris") => dayReminderDue({ setting, eventDate, timeZone, now: new Date(iso), catchUpHours: 6 });

describe("JRJ-01 — Le jour et l'heure du rappel du jour J (66b, D3)", () => {
  it("la veille à 18 h : rien avant, à l'heure il part, plus rien le lendemain", () => {
    expect(dayReminderSendDate("2027-06-12", "eve")).toBe("2027-06-11");
    expect(due(eve, "2027-06-11T15:59:00Z")).toBe(false); // 17 h 59 à Paris (été)
    expect(due(eve, "2027-06-11T16:00:00Z")).toBe(true); // 18 h 00
    expect(due(eve, "2027-06-11T21:59:00Z")).toBe(true); // 23 h 59 : rattrapage, le jour même
    expect(due(eve, "2027-06-11T22:00:00Z")).toBe(false); // minuit : jour J, trop tard
    expect(due(eve, "2027-06-12T16:00:00Z")).toBe(false); // le jour même à 18 h : non
  });

  it("le matin même à 7 h, dans le fuseau de l'évènement ; au passage à l'heure d'été", () => {
    expect(due(morning, "2027-03-28T04:59:00Z", "2027-03-28")).toBe(false); // 6 h 59, heure d'été
    expect(due(morning, "2027-03-28T05:00:00Z", "2027-03-28")).toBe(true); // 7 h 00
    expect(due(morning, "2027-06-12T03:00:00Z", "2027-06-12", "Indian/Reunion")).toBe(true); // 7 h à La Réunion
    expect(due(morning, "2027-06-12T03:00:00Z", "2027-06-12")).toBe(false); // 5 h à Paris
  });

  it("une cible décochée ne part pas ; le réglage de l'évènement remplace celui de l'organisation", () => {
    expect(due({ ...eve, enabled: false }, "2027-06-11T16:00:00Z")).toBe(false);
    const merged = effectiveDayReminder([eve, morning], [{ ...eve, enabled: false }]);
    expect(merged).toEqual([{ ...eve, enabled: false }, morning]);
  });
});
