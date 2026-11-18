// Lot 46 (RDV-02 ; D4, D6) — calcul des créneaux libres, sans base, avec une horloge simulée.
import { describe, expect, it } from "vitest";
import { computeSlots, isFreeSlot, nearestSlots, overlaps, paddedRange, type SlotInput } from "./slots";

const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "18:00" }));

function base(overrides: Partial<SlotInput> = {}): SlotInput {
  return {
    now: new Date("2027-03-01T07:00:00Z"), // lundi 1er mars 2027, 8 h à Paris
    timeZone: "Europe/Paris",
    rules: WEEK,
    closures: [],
    blockedDays: [],
    busy: [],
    durationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minNoticeMinutes: 0,
    horizonDays: 7,
    ...overrides,
  };
}

const paris = (instant: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(instant);

describe("RDV-02 — Créneaux calculés sur les disponibilités réelles", () => {
  it("propose les créneaux des plages hebdomadaires, au pas de 30 minutes, sans dépasser la fin de la plage", () => {
    const slots = computeSlots(base({ horizonDays: 0 }));
    expect(slots.map(paris)).toEqual(
      ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"].map((time) => `01/03/2027 ${time}`),
    );
  });

  it("aucun créneau ne chevauche une plage occupée, marges comprises", () => {
    const busy = [{ start: new Date("2027-03-01T10:00:00Z"), end: new Date("2027-03-01T11:00:00Z") }]; // 11 h - 12 h à Paris
    const slots = computeSlots(base({ horizonDays: 0, busy, bufferBeforeMinutes: 15, bufferAfterMinutes: 30 }));
    for (const slot of slots) expect(overlaps(paddedRange(slot, 60, 15, 30), busy[0]!)).toBe(false);
    expect(slots.map(paris)).not.toContain("01/03/2027 10:30");
    expect(slots.map(paris)).toContain("01/03/2027 09:30"); // fin 10 h 30 + 30 min de marge = 11 h
    expect(slots.map(paris)).not.toContain("01/03/2027 10:00");
    expect(slots.map(paris)).toContain("01/03/2027 12:30"); // 12 h 30 - 15 min = 12 h 15, après la fin
  });

  it("par propriété : sur des plages occupées tirées au hasard, aucun créneau proposé n'en chevauche une", () => {
    let seed = 46;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 200; round++) {
      const busy = Array.from({ length: 1 + Math.floor(random() * 8) }, () => {
        const start = new Date("2027-03-01T05:00:00Z").getTime() + Math.floor(random() * 5 * 24 * 60) * 60_000;
        return { start: new Date(start), end: new Date(start + (5 + Math.floor(random() * 300)) * 60_000) };
      });
      const duration = [15, 30, 45, 60, 90, 120][Math.floor(random() * 6)]!;
      const before = Math.floor(random() * 4) * 15;
      const after = Math.floor(random() * 4) * 15;
      const slots = computeSlots(base({ busy, durationMinutes: duration, bufferBeforeMinutes: before, bufferAfterMinutes: after, horizonDays: 5 }));
      for (const slot of slots) for (const range of busy) expect(overlaps(paddedRange(slot, duration, before, after), range)).toBe(false);
    }
  });

  it("respecte le délai de prévenance et l'horizon de réservation", () => {
    const slots = computeSlots(base({ minNoticeMinutes: 24 * 60, horizonDays: 2 }));
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.getTime() >= new Date("2027-03-02T07:00:00Z").getTime())).toBe(true);
    expect(paris(slots.at(-1)!)).toBe("03/03/2027 17:00");
  });

  it("le jour même, rien avant l'instant présent", () => {
    const slots = computeSlots(base({ now: new Date("2027-03-01T12:10:00Z"), horizonDays: 0 })); // 13 h 10 à Paris
    expect(paris(slots[0]!)).toBe("01/03/2027 13:30");
  });

  it("les jours fermés et les jours bloqués (jours d'évènement, D6) n'ont aucun créneau", () => {
    const slots = computeSlots(base({ horizonDays: 4, closures: [{ startsOn: "2027-03-02", endsOn: "2027-03-03" }], blockedDays: ["2027-03-05"] }));
    const days = new Set(slots.map((slot) => paris(slot).slice(0, 10)));
    expect([...days]).toEqual(["01/03/2027", "04/03/2027"]);
  });

  it("une journée entière occupée (agenda extérieur) ne laisse aucun créneau ce jour-là", () => {
    const busy = [{ start: new Date("2027-03-01T23:00:00Z"), end: new Date("2027-03-02T23:00:00Z") }]; // mardi 2 mars, journée entière à Paris
    const days = new Set(computeSlots(base({ horizonDays: 2, busy })).map((slot) => paris(slot).slice(0, 10)));
    expect([...days]).toEqual(["01/03/2027", "03/03/2027"]);
  });

  it("au passage à l'heure d'été, les plages restent à l'heure murale de Paris", () => {
    // Dimanche 28 mars 2027 : on passe de 2 h à 3 h. Le lundi 29, 9 h à Paris = 7 h UTC.
    const slots = computeSlots(base({ now: new Date("2027-03-26T07:00:00Z"), horizonDays: 3 }));
    const monday = slots.filter((slot) => paris(slot).startsWith("29/03/2027"));
    expect(monday[0]!.toISOString()).toBe("2027-03-29T07:00:00.000Z");
    const friday = slots.filter((slot) => paris(slot).startsWith("26/03/2027"));
    expect(friday[0]!.toISOString()).toBe("2027-03-26T08:00:00.000Z");
  });

  it("au passage à l'heure d'hiver, idem", () => {
    // Dimanche 31 octobre 2027 : on passe de 3 h à 2 h. Le lundi 1er novembre, 9 h à Paris = 8 h UTC.
    const slots = computeSlots(base({ now: new Date("2027-10-29T06:00:00Z"), horizonDays: 3 }));
    expect(slots.find((slot) => paris(slot).startsWith("01/11/2027"))!.toISOString()).toBe("2027-11-01T08:00:00.000Z");
    expect(slots.find((slot) => paris(slot).startsWith("29/10/2027"))!.toISOString()).toBe("2027-10-29T07:00:00.000Z");
  });

  it("une plage qui ne peut contenir la durée ne propose rien ; un type de 15 minutes se pose au quart d'heure", () => {
    expect(computeSlots(base({ horizonDays: 0, rules: [{ weekday: 1, startTime: "09:00", endTime: "09:45" }] }))).toHaveLength(0);
    const quarter = computeSlots(base({ horizonDays: 0, durationMinutes: 15, rules: [{ weekday: 1, startTime: "09:00", endTime: "10:00" }] }));
    expect(quarter.map(paris)).toEqual(["01/03/2027 09:00", "01/03/2027 09:15", "01/03/2027 09:30", "01/03/2027 09:45"]);
  });

  it("deux plages le même jour (matin et après-midi) se suivent sans doublon", () => {
    const rules = [
      { weekday: 1, startTime: "14:00", endTime: "16:00" },
      { weekday: 1, startTime: "09:00", endTime: "11:00" },
    ];
    expect(computeSlots(base({ horizonDays: 0, rules })).map(paris)).toEqual(["09:00", "09:30", "10:00", "14:00", "14:30", "15:00"].map((time) => `01/03/2027 ${time}`));
  });

  it("un instant venu d'un formulaire n'est accepté que s'il est l'un des créneaux libres ; les voisins sont les plus proches", () => {
    const input = base({ horizonDays: 0 });
    expect(isFreeSlot(input, new Date("2027-03-01T09:00:00Z"))).toBe(true);
    expect(isFreeSlot(input, new Date("2027-03-01T09:10:00Z"))).toBe(false);
    const slots = computeSlots(input);
    expect(nearestSlots(slots, new Date("2027-03-01T10:10:00Z")).map(paris)).toEqual(["01/03/2027 10:30", "01/03/2027 11:00", "01/03/2027 11:30"]);
    expect(nearestSlots([], new Date())).toEqual([]);
  });
});
