import { describe, expect, it } from "vitest";
import { cleanBankDetails, InvalidBankDetailsError, isValidBic, isValidIban, maskIban } from "./bank-details";

describe("PRE-10 / SEC-27 — IBAN structuré et masqué", () => {
  it("reconnaît un IBAN valide par sa clé (ISO 13616), espaces et minuscules acceptés", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("fr7630006000011234567890189")).toBe(true);
    expect(isValidIban("FR7630006000011234567890188")).toBe(false);
    expect(isValidIban("FR76")).toBe(false);
  });

  it("reconnaît un BIC de 8 ou 11 caractères", () => {
    expect(isValidBic("AGRIFRPP")).toBe(true);
    expect(isValidBic("agrifrpp882")).toBe(true);
    expect(isValidBic("AGRI")).toBe(false);
  });

  it("masque l'IBAN : pays et clé, puis les quatre derniers chiffres", () => {
    expect(maskIban("FR7630006000011234567890189")).toBe("FR76 •••• •••• 0189");
    expect(maskIban("DE89 3704 0044 0532 0130 00")).toBe("DE89 •••• •••• 3000");
  });

  it("refuse un IBAN invalide ou un BIC sans IBAN, sans jamais reprendre la valeur dans l'erreur", () => {
    expect(() => cleanBankDetails({ iban: "FR7630006000011234567890188", bic: null })).toThrow(InvalidBankDetailsError);
    try {
      cleanBankDetails({ iban: "FR7630006000011234567890188", bic: null });
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("7630006");
    }
    expect(() => cleanBankDetails({ iban: null, bic: "AGRIFRPP" })).toThrow(InvalidBankDetailsError);
    expect(cleanBankDetails({ iban: " fr76 3000 6000 0112 3456 7890 189 ", bic: "agrifrpp" })).toEqual({ iban: "FR7630006000011234567890189", bic: "AGRIFRPP" });
    expect(cleanBankDetails({ iban: "", bic: "" })).toEqual({ iban: null, bic: null });
  });
});
