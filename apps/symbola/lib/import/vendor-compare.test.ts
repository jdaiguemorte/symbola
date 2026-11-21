import { describe, expect, it } from "vitest";
import { compareVendorRecords, onlyOneNameInCommon, vendorMatchNeedsCheck } from "./vendor-compare";

const benjaminFile = { name: "Benjamin", type: "DJ", city: "Villeurbanne", email: "bnj.mix@example.org", phone: null };
const benjaminBook = { name: "Benjamin Dupuy", type: "Photographe", city: "Annecy", email: "contact@dupuy-photo.example.org", phone: "06 39 98 00 44" };

describe("HUB-14 — Rapprochements vérifiables (lot 63b)", () => {
  it("la ligne du fichier et la fiche existante sont comparées champ par champ ; une valeur absente d'un côté n'est pas une différence", () => {
    expect(compareVendorRecords(benjaminFile, benjaminBook)).toEqual([
      { key: "name", file: "Benjamin", existing: "Benjamin Dupuy", different: true },
      { key: "type", file: "DJ", existing: "Photographe", different: true },
      { key: "city", file: "Villeurbanne", existing: "Annecy", different: true },
      { key: "email", file: "bnj.mix@example.org", existing: "contact@dupuy-photo.example.org", different: true },
      { key: "phone", file: null, existing: "06 39 98 00 44", different: false },
    ]);
    // Casse, accents, espaces et indicatif ne font pas une différence.
    const same = compareVendorRecords(
      { name: "Studio LUMIERE", type: "photographe", city: "Tours", email: "Lea@Studio.example.org", phone: "+33 6 39 98 00 05" },
      { name: "Studio Lumière", type: "Photographe", city: "TOURS", email: "lea@studio.example.org", phone: "06.39.98.00.05" },
    );
    expect(same.every((line) => !line.different)).toBe(true);
  });

  it("étant donné deux fiches qui n'ont en commun que le prénom, la proposition porte « À vérifier »", () => {
    expect(onlyOneNameInCommon("Benjamin", "Benjamin Dupuy")).toBe(true);
    expect(vendorMatchNeedsCheck(compareVendorRecords(benjaminFile, benjaminBook))).toBe(true);
    expect(onlyOneNameInCommon("Studio Lumière", "Studio Lumière")).toBe(false);
    expect(onlyOneNameInCommon("Maison Verdier Traiteur", "Maison Verdier")).toBe(false);
    // Même nom, même métier, même ville : rien à vérifier.
    expect(vendorMatchNeedsCheck(compareVendorRecords({ ...benjaminBook, email: null }, benjaminBook))).toBe(false);
    // Métier et ville différents, même nom complet : à vérifier aussi.
    expect(vendorMatchNeedsCheck(compareVendorRecords({ ...benjaminBook, type: "DJ", city: "Lyon" }, benjaminBook))).toBe(true);
  });
});
