import { describe, expect, it } from "vitest";
import { formatAmount, formatDate, localeFromAcceptLanguage } from "./index";

describe("@symbola/i18n — formatAmount", () => {
  it("formate en français : 1 234,56 €", () => {
    expect(formatAmount(123456, "fr").replace(/ | /g, " ")).toBe("1 234,56 €");
  });

  it("formate en anglais : €1,234.56", () => {
    expect(formatAmount(123456, "en")).toBe("€1,234.56");
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
