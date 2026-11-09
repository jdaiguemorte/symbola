import { describe, expect, it } from "vitest";
import {
  cleanDocumentSettings,
  documentSnapshot,
  EMPTY_DOCUMENT_SETTINGS,
  formatIban,
  InvalidDocumentSettingsError,
  isValidBic,
  isValidIban,
} from "./document-settings";

// IBAN d'exemple publiés par les normes (aucun compte réel).
const SAMPLE_IBAN = "FR76 3000 6000 0112 3456 7890 189";

function fieldOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof InvalidDocumentSettingsError ? error.field : "autre";
  }
}

describe("DEV-11 — Paiement : IBAN, échéance, échéancier", () => {
  it("un IBAN et un BIC valides sont enregistrés, sans espaces, en majuscules", () => {
    const clean = cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, iban: SAMPLE_IBAN.toLowerCase(), bic: "bnpa frpp xxx" });
    expect(clean.iban).toBe("FR7630006000011234567890189");
    expect(clean.bic).toBe("BNPAFRPPXXX");
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidBic("BNPAFRPP")).toBe(true);
  });

  it("l'IBAN s'affiche par groupes de quatre caractères", () => {
    expect(formatIban("FR7630006000011234567890189")).toBe("FR76 3000 6000 0112 3456 7890 189");
  });

  it("un IBAN dont la clé de contrôle est fausse est refusé", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, iban: "FR7630006000011234567890188" }))).toBe("iban");
  });

  it("un BIC qui n'a pas 8 ou 11 caractères est refusé", () => {
    expect(isValidBic("BNPAFR")).toBe(false);
    expect(isValidBic("BNPAFRPPXX")).toBe(false);
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, bic: "BNPAFRPPXX" }))).toBe("bic");
  });

  it("sans IBAN, rien n'est enregistré à sa place", () => {
    expect(cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, iban: "  ", bic: "" })).toMatchObject({ iban: null, bic: null });
  });
});

describe("DEV-09 — Apparence des documents", () => {
  it("une couleur #RRGGBB est enregistrée en minuscules", () => {
    expect(cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, color: "#4F6B5A" }).color).toBe("#4f6b5a");
  });

  it("une couleur qui n'est pas au format #RRGGBB est refusée", () => {
    for (const color of ["4f6b5a", "#4f6b5", "#4f6b5g", "rouge"]) {
      expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, color }))).toBe("color");
    }
  });

  it("seules les polices Moderne et Classique sont acceptées", () => {
    expect(cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, font: "classic" }).font).toBe("classic");
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, font: "comic" as never }))).toBe("font");
  });
});

describe("DEV-10 — Textes des devis et des factures", () => {
  it("chaque texte est limité : 600 caractères pour les introductions et le pied de page, 2 000 pour les conditions", () => {
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, quoteIntro: "a".repeat(601) }))).toBe("quoteIntro");
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, footer: "a".repeat(601) }))).toBe("footer");
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, quoteTerms: "a".repeat(2000) }))).toBeNull();
    expect(fieldOf(() => cleanDocumentSettings({ ...EMPTY_DOCUMENT_SETTINGS, invoiceTerms: "a".repeat(2001) }))).toBe("invoiceTerms");
  });

  it("le devis fige son introduction et ses conditions ; la facture, son introduction seule", () => {
    const settings = cleanDocumentSettings({
      ...EMPTY_DOCUMENT_SETTINGS,
      quoteIntro: "Voici notre proposition.",
      quoteTerms: "Bon pour accord.",
      invoiceIntro: "Merci pour votre confiance.",
      invoiceTerms: "À réception.",
      footer: "Membre d'un réseau",
    });
    expect(documentSnapshot(settings, "quote")).toMatchObject({ intro: "Voici notre proposition.", terms: "Bon pour accord.", footer: "Membre d'un réseau" });
    expect(documentSnapshot(settings, "invoice")).toMatchObject({ intro: "Merci pour votre confiance.", terms: null, footer: "Membre d'un réseau" });
  });
});
