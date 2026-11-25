// Lot 69 (UX-10, HUB-14, HUB-19 ; C-56 et C-60 de l'audit UX) — valeurs d'un fichier importé montrées
// à la planner : lisibles, dans sa langue ; le fichier et la base ne changent pas.
import { describe, expect, it } from "vitest";
import { displayImportCell, formatImportedAmountText } from "./display";

const statusLabel = (value: string) => ({ confirmed: "Confirmé", option: "Option" })[value] ?? null;

describe("UX-10, HUB-14, HUB-19 — Valeurs de l'import montrées lisibles (lot 69)", () => {
  it("les entités HTML d'un export web se lisent : Ch&acirc;teau devient Château", () => {
    expect(displayImportCell("Ch&acirc;teau de Verdier", { locale: "fr" })).toBe("Château de Verdier");
  });

  it("une date ISO se lit dans la langue : 12 juin 2027 / June 12, 2027", () => {
    expect(displayImportCell("2027-06-12", { locale: "fr" })).toBe("12 juin 2027");
    expect(displayImportCell("2027-06-12", { locale: "en" })).toBe("June 12, 2027");
  });

  it("une date impossible ou à moitié écrite reste telle quelle", () => {
    expect(displayImportCell("2027-13-45", { locale: "fr" })).toBe("2027-13-45");
    expect(displayImportCell("2027-06", { locale: "fr" })).toBe("2027-06");
  });

  it("un code de statut devient son libellé seulement quand on sait le traduire", () => {
    expect(displayImportCell("confirmed", { locale: "fr", statusLabel })).toBe("Confirmé");
    expect(displayImportCell("confirmed", { locale: "fr" })).toBe("confirmed");
    expect(displayImportCell("autre", { locale: "fr", statusLabel })).toBe("autre");
  });

  it("une valeur vide reste vide", () => {
    expect(displayImportCell("", { locale: "fr", statusLabel })).toBe("");
    expect(displayImportCell("   ", { locale: "fr" })).toBe("   ");
  });

  describe("sommes d'argent (présentation seulement)", () => {
    it("« 21650,50 € » devient « 21 650,50 € » (espace insécable fine)", () => {
      expect(formatImportedAmountText("21650,50 €", "fr")).toBe("21 650,50 €");
    });
    it("un montant à trois chiffres ou déjà espacé n'est pas touché", () => {
      expect(formatImportedAmountText("950,00 €", "fr")).toBe("950,00 €");
      expect(formatImportedAmountText("12 345 €", "fr")).toBe("12 345 €");
    });
    it("numéros, SIRET et téléphones ne sont jamais pris pour des sommes", () => {
      expect(formatImportedAmountText("12345678901234", "fr")).toBe("12345678901234");
      expect(formatImportedAmountText("0612345678", "fr")).toBe("0612345678");
      expect(formatImportedAmountText("Total 21650,50 € TTC", "fr")).toBe("Total 21650,50 € TTC");
    });
    it("en anglais : 21650.50 EUR devient €21,650.50", () => {
      expect(formatImportedAmountText("21650.50 EUR", "en")).toBe("€21,650.50");
    });
    it("displayImportCell l'applique", () => {
      expect(displayImportCell("21650,50 €", { locale: "fr" })).toBe("21 650,50 €");
    });
  });
});
