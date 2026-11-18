import { describe, expect, it } from "vitest";
import { ContactMergeRefusedError, findDuplicatePairs, mergeContactValues, normalizeEmail, normalizePhone, type MergeableValues } from "./contact-duplicate-rules";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

function contact(overrides: Partial<MergeableValues> = {}): MergeableValues {
  return {
    kind: "person",
    isDemo: false,
    firstName: "Léa",
    lastName: "Martin",
    name: null,
    email: null,
    phone: null,
    addressLine: null,
    postalCode: null,
    city: null,
    country: null,
    billingAddress: null,
    companyIdNumber: null,
    vatNumber: null,
    ...overrides,
  };
}

describe("CRM-07 — Détection des doublons sur e-mail et téléphone normalisés", () => {
  it("l'e-mail ignore la casse et les espaces", () => {
    expect(normalizeEmail("  Lea.Martin@Example.TEST ")).toBe("lea.martin@example.test");
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("le téléphone est ramené au format international", () => {
    for (const written of ["06 12 34 56 78", "06.12.34.56.78", "+33 6 12 34 56 78", "0033 6 12 34 56 78", "+33 (0)6 12 34 56 78"]) {
      expect(normalizePhone(written), written).toBe("+33612345678");
    }
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("les paires se trouvent par e-mail ou par téléphone, une seule fois, dans l'ordre des identifiants", () => {
    const pairs = findDuplicatePairs([
      { id: B, email: "lea@example.test", phone: "06 12 34 56 78", isDemo: false },
      { id: A, email: "LEA@example.test", phone: "+33612345678", isDemo: false },
      { id: C, email: null, phone: "0612345678", isDemo: false },
    ]);
    expect(pairs).toEqual([
      { firstContactId: A, secondContactId: B, reason: "email" },
      { firstContactId: A, secondContactId: C, reason: "phone" },
      { firstContactId: B, secondContactId: C, reason: "phone" },
    ]);
  });

  it("à la saisie, seules les paires de la fiche saisie sont cherchées", () => {
    const pairs = findDuplicatePairs(
      [
        { id: A, email: null, phone: "0612345678", isDemo: false },
        { id: B, email: null, phone: "0612345678", isDemo: false },
        { id: C, email: null, phone: "0612345678", isDemo: false },
      ],
      C,
    );
    expect(pairs.map((pair) => [pair.firstContactId, pair.secondContactId])).toEqual([
      [A, C],
      [B, C],
    ]);
  });

  it("une fiche fictive (essai guidé) n'est jamais appariée", () => {
    expect(findDuplicatePairs([
      { id: A, email: "lea@example.test", phone: null, isDemo: true },
      { id: B, email: "lea@example.test", phone: null, isDemo: false },
    ])).toEqual([]);
  });
});

describe("CRM-07 — Fusion choisie champ par champ (D4)", () => {
  it("par défaut, la fiche gardée garde ses valeurs et prend celles de l'autre où elle n'en a pas", () => {
    const kept = contact({ email: "lea@example.test", phone: null, city: "Lyon" });
    const absorbed = contact({ email: "lea.martin@example.test", phone: "0612345678", city: "Paris" });
    const result = mergeContactValues(kept, absorbed, {});
    expect(result.values).toMatchObject({ email: "lea@example.test", phone: "0612345678", city: "Lyon" });
    expect(result.fromAbsorbed).toEqual(["phone"]);
  });

  it("la planner choisit la valeur à garder, champ par champ", () => {
    const kept = contact({ email: "lea@example.test", city: "Lyon" });
    const absorbed = contact({ email: "lea.martin@example.test", city: "Paris", lastName: "Martin-Dupont" });
    const result = mergeContactValues(kept, absorbed, { city: "absorbed", lastName: "absorbed", email: "kept" });
    expect(result.values).toMatchObject({ email: "lea@example.test", city: "Paris", lastName: "Martin-Dupont" });
    expect(result.fromAbsorbed).toEqual(["lastName", "city"]);
  });

  it("une valeur vide de la fiche absorbée ne remplace jamais une valeur", () => {
    const result = mergeContactValues(contact({ city: "Lyon" }), contact({ city: null }), { city: "absorbed" });
    expect(result.values.city).toBe("Lyon");
    expect(result.fromAbsorbed).toEqual([]);
  });

  it("jamais de fusion avec une fiche fictive, ni entre une personne et un foyer", () => {
    expect(() => mergeContactValues(contact(), contact({ isDemo: true }), {})).toThrow(ContactMergeRefusedError);
    expect(() => mergeContactValues(contact({ kind: "household", name: "Famille Martin", firstName: null }), contact(), {})).toThrow(/kind/);
  });
});
