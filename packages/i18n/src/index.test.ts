import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatCalendarDate,
  formatDate,
  parisToday,
  formatDateTime,
  formatFileSize,
  formatMonth,
  localeFromAcceptLanguage,
  formatAmountInput,
  parseAmountToCents,
  parisDaysSince,
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

describe("@symbola/i18n — formatDateTime", () => {
  it("affiche l'heure de Paris, heure d'été comprise, sans espace insécable", () => {
    const summer = formatDateTime(new Date("2027-06-12T13:05:00Z"), "fr");
    expect(summer).toContain("12 juin 2027");
    expect(summer).toContain("15:05");
    expect(summer).not.toMatch(/[\u00a0\u202f]/);
    expect(formatDateTime(new Date("2027-01-12T13:05:00Z"), "fr")).toContain("14:05");
    expect(formatDateTime(new Date("2027-06-12T13:05:00Z"), "en")).toContain("June 12, 2027");
  });
});

describe("@symbola/i18n — formatFileSize", () => {
  it("affiche des Ko ou des Mo selon la taille et la langue", () => {
    expect(formatFileSize(1536, "fr")).toBe("1,5 Ko");
    expect(formatFileSize(5 * 1024 * 1024, "fr")).toBe("5 Mo");
    expect(formatFileSize(1536, "en")).toBe("1.5 KB");
    expect(formatFileSize(12, "en")).toBe("0.1 KB");
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

describe("HUB-02 — Date du jour à Paris", () => {
  it("suit l'heure de Paris, pas celle du serveur (UTC), y compris au passage à l'heure d'été", () => {
    expect(parisToday(new Date("2026-11-03T22:59:00Z"))).toBe("2026-11-03");
    expect(parisToday(new Date("2026-11-03T23:00:00Z"))).toBe("2026-11-04"); // minuit à Paris (UTC+1)
    expect(parisToday(new Date("2027-03-27T22:30:00Z"))).toBe("2027-03-27"); // veille du passage à l'heure d'été
    expect(parisToday(new Date("2027-03-28T22:00:00Z"))).toBe("2027-03-29"); // minuit à Paris (UTC+2)
  });
});

describe("HUB-15 — jours écoulés à Paris", () => {
  it("compte en jours de calendrier parisiens : la veille à 23 h 30 = 1 jour", () => {
    expect(parisDaysSince(new Date("2026-11-05T22:30:00Z"), new Date("2026-11-06T08:00:00Z"))).toBe(1);
  });
  it("le jour même = 0", () => {
    expect(parisDaysSince(new Date("2026-11-06T06:00:00Z"), new Date("2026-11-06T21:00:00Z"))).toBe(0);
  });
  it("traverse le passage à l'heure d'hiver sans décalage", () => {
    expect(parisDaysSince(new Date("2026-10-24T22:30:00Z"), new Date("2026-10-31T23:30:00Z"))).toBe(7);
  });
});

describe("@symbola/i18n — formatAmountInput (montant pré-rempli dans un champ)", () => {
  it("écrit la virgule décimale de la langue, sans symbole ni séparateur de milliers", () => {
    expect(formatAmountInput(292950, "fr")).toBe("2929,50");
    expect(formatAmountInput(292950, "en")).toBe("2929.50");
    expect(formatAmountInput(292905, "fr")).toBe("2929,05");
  });

  it("n'écrit les centimes que s'il y en a ; un montant absent laisse le champ vide", () => {
    expect(formatAmountInput(293000, "fr")).toBe("2930");
    expect(formatAmountInput(0, "en")).toBe("0");
    expect(formatAmountInput(null, "fr")).toBe("");
  });

  it("parseAmountToCents relit exactement ce qu'il écrit, dans les deux langues", () => {
    for (const cents of [0, 1, 99, 100, 150050, 292950, 100500, 2_147_483_647]) {
      for (const locale of ["fr", "en"] as const) expect(parseAmountToCents(formatAmountInput(cents, locale))).toBe(cents);
    }
  });
});
