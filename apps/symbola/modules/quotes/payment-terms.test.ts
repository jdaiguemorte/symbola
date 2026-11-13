// Lot 31c (FAC-07, JUR-01 ; décision D18, réponse 1 de l'expert-comptable) — conditions de
// paiement selon la catégorie du client, et phrase des pénalités au taux choisi par la planner.
import { describe, expect, it } from "vitest";
import { starterLatePenalty } from "@symbola/starter-templates";
import { latePenaltySentence, paymentTermsFor, professionalTermsText } from "./payment-terms";

const settings = { individual: "Texte particuliers.", professional: "Texte professionnels.", latePenaltyRate: "ecb_plus_10" as const };

describe("JUR-01 — Conditions de paiement selon le client (lot 31c, D18)", () => {
  it("particulier et non-professionnel : leur texte, ni texte professionnel ni taux", () => {
    expect(paymentTermsFor(settings, "individual")).toEqual({ text: "Texte particuliers.", latePenaltyRate: null });
    expect(paymentTermsFor(settings, "non_professional")).toEqual({ text: "Texte particuliers.", latePenaltyRate: null });
  });

  it("professionnel : son texte et le taux choisi ; sans choix, aucun taux", () => {
    expect(paymentTermsFor(settings, "professional")).toEqual({ text: "Texte professionnels.", latePenaltyRate: "ecb_plus_10" });
    expect(paymentTermsFor({ ...settings, latePenaltyRate: null }, "professional").latePenaltyRate).toBeNull();
  });

  it("la phrase des pénalités reprend le taux choisi et l'indemnité forfaitaire de 40 €, en français et en anglais", () => {
    const data = starterLatePenalty();
    expect(latePenaltySentence("ecb_plus_10", data, "fr")).toContain("Banque centrale européenne majoré de 10 points");
    expect(latePenaltySentence("three_times_legal", data, "fr")).toContain("trois fois le taux d'intérêt légal");
    expect(latePenaltySentence("ecb_plus_10", data, "fr")).toMatch(/40,00\s€/);
    expect(latePenaltySentence("three_times_legal", data, "en")).toContain("€40.00");
    expect(latePenaltySentence("ecb_plus_10", data, "fr")).not.toMatch(/[{}]/);
  });

  it("texte imprimé pour un professionnel : son texte, puis la phrase ; sans taux, rien n'est inventé", () => {
    const data = starterLatePenalty();
    const sentence = latePenaltySentence("three_times_legal", data, "fr");
    expect(professionalTermsText("Texte professionnels.", "three_times_legal", data, "fr")).toBe(`Texte professionnels.\n${sentence}`);
    expect(professionalTermsText(null, "three_times_legal", data, "fr")).toBe(sentence);
    expect(professionalTermsText("Texte professionnels.", null, data, "fr")).toBe("Texte professionnels.");
    expect(professionalTermsText(" ", null, data, "fr")).toBeNull();
  });
});
