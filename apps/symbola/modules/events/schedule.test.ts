// EVT-04 — calcul des échéances du rétroplanning. Dates sans heure
// (CLAUDE.md §5) : le calcul se fait en jours civils, sans dépendre du
// fuseau ni du passage à l'heure d'été (CLAUDE.md §6).
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dueDateFor, monthKey } from "./schedule";

describe("EVT-04 — Calcul des échéances", () => {
  it("J-365 d'un mariage le 12 juin 2027 tombe le 12 juin 2026", () => {
    expect(dueDateFor("2027-06-12", -365)).toBe("2026-06-12");
  });

  it("J-0 est le jour même, J+7 une semaine après", () => {
    expect(dueDateFor("2027-06-12", 0)).toBe("2027-06-12");
    expect(dueDateFor("2027-06-12", 7)).toBe("2027-06-19");
  });

  it("la veille est J-1, y compris en début de mois et d'année", () => {
    expect(dueDateFor("2027-03-01", -1)).toBe("2027-02-28");
    expect(dueDateFor("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("tient compte des années bissextiles", () => {
    expect(dueDateFor("2028-03-01", -1)).toBe("2028-02-29");
    expect(dueDateFor("2029-02-28", -365)).toBe("2028-02-29");
  });

  it("n'est pas décalé par le passage à l'heure d'été ou d'hiver (Europe/Paris)", () => {
    // Heure d'été le dimanche 28 mars 2027, heure d'hiver le 31 octobre 2027.
    expect(addDays("2027-03-27", 1)).toBe("2027-03-28");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
    expect(addDays("2027-10-30", 2)).toBe("2027-11-01");
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween("2027-10-30", "2027-11-01")).toBe(2);
  });

  it("calcule l'écart en jours entre deux dates, dans les deux sens", () => {
    expect(daysBetween("2027-06-12", "2027-06-19")).toBe(7);
    expect(daysBetween("2027-06-19", "2027-06-12")).toBe(-7);
  });

  it("regroupe par mois", () => {
    expect(monthKey("2027-06-12")).toBe("2027-06");
  });

  it("refuse une date mal formée", () => {
    expect(() => addDays("12/06/2027", 1)).toThrow();
    expect(() => addDays("2027-02-30", 1)).toThrow();
  });
});
