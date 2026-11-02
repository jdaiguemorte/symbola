import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, isDueSoon, parisDate, requestDueDate } from "./deadlines";

describe("RGPD-04 — Échéances légales d'une demande", () => {
  it("échéance un mois après la réception ; trois mois au total une fois prolongée", () => {
    expect(requestDueDate("2026-11-02", false)).toBe("2026-12-02");
    expect(requestDueDate("2026-11-02", true)).toBe("2027-02-02");
  });

  it("fin de mois : le jour manquant est ramené au dernier jour du mois", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-31");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2027-03-31", -1)).toBe("2027-02-28");
  });

  it("jours restants, y compris à travers le passage à l'heure d'été", () => {
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween("2027-03-29", "2027-03-27")).toBe(-2);
  });

  it("Étant donné une échéance à moins de 7 jours, alors la demande est en alerte ; la veille du seuil, non", () => {
    expect(isDueSoon("2026-11-25", "2026-12-02", 7)).toBe(false);
    expect(isDueSoon("2026-11-26", "2026-12-02", 7)).toBe(true);
    expect(isDueSoon("2026-12-02", "2026-12-02", 7)).toBe(true);
    expect(isDueSoon("2026-12-05", "2026-12-02", 7)).toBe(true);
  });

  it("la date de Paris d'un instant, de part et d'autre de minuit UTC", () => {
    expect(parisDate(new Date("2026-11-02T23:30:00Z"))).toBe("2026-11-03");
    expect(parisDate(new Date("2027-07-01T21:59:00Z"))).toBe("2027-07-01");
    expect(parisDate(new Date("2027-07-01T22:00:00Z"))).toBe("2027-07-02");
  });
});
