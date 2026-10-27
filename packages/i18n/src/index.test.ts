import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatCalendarDate,
  formatDate,
  formatMonth,
  localeFromAcceptLanguage,
  parseAmountToCents,
} from "./index";

describe("@symbola/i18n — formatAmount", () => {
  it("formate en français : 1 234,56 €", () => {
    expect(formatAmount(123456, "fr").replace(/ | /g, " ")).toBe("1 234,56 €");
  });

  it("formate en anglais : €1,234.56", () => {
    expect(formatAmount(123456, "en")).toBe("€1,234.56");
  });
});

describe("@symbola/i18n — dates sans heure", () => {
  it("formate un « AAAA-MM-JJ » sans décalage de fuseau, même le 1er du mois", () => {
    expect(formatCalendarDate("2027-03-01", "fr")).toBe("1 mars 2027");
    expect(formatCalendarDate("2027-03-01", "en")).toBe("March 1, 2027");
  });

  it("formate le mois d'un « AAAA-MM-JJ »", () => {
    expect(formatMonth("2027-10-31", "fr")).toBe("octobre 2027");
    expect(formatMonth("2027-10-31", "en")).toBe("October 2027");
  });
});

describe("@symbola/i18n — formatDate", () => {
  it("formate une date en français", () => {
    expect(formatDate(new Date("2026-03-05T00:00:00Z"), "fr")).toContain("mars");
  });

  it("formate une date en anglais", () => {
    expect(formatDate(new Date("2026-03-05T00:00:00Z"), "en")).toContain("March");
  });
});

describe("@symbola/i18n — localeFromAcceptLanguage (HUB-04)", () => {
  it("détecte l'anglais depuis l'en-tête du navigateur", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("retombe sur le français pour toute autre langue", () => {
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("fr");
    expect(localeFromAcceptLanguage("es-ES")).toBe("fr");
  });

  it("retombe sur le français quand l'en-tête est absent", () => {
    expect(localeFromAcceptLanguage(null)).toBe("fr");
  });

  it("détecte le français explicitement", () => {
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
  });
});

describe("@symbola/i18n — parseAmountToCents (saisie en euros, CLAUDE.md §5)", () => {
  it.each([
    ["2500", 250000],
    ["2 500", 250000],
    ["2 500,50", 250050],
    ["1234.5", 123450],
    ["1,234.56", 123456],
    ["0,07", 7],
    ["12 €", 1200],
  ])("convertit « %s » en %i centimes sans calcul à virgule flottante", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it("renvoie null pour une saisie vide (montant facultatif)", () => {
    expect(parseAmountToCents("  ")).toBeNull();
  });

  it.each(["abc", "-50", "12,345,67", "1.2.3", "9999999999", "1,005"])("refuse « %s » (invalide, trop grand ou ambigu)", (input) => {
    expect(parseAmountToCents(input)).toBeUndefined();
  });
});
