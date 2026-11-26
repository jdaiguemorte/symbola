// Lot 70a (CHR-02 ; A1) — le nom d'un collègue : prénom sur une ligne, prénom et nom dans un menu,
// initiales des deux ; le début de l'adresse tant que le prénom est vide.
import { describe, expect, it } from "vitest";
import { personFullName, personInitials, personNamesSchema, personShortName } from "./person-names";

const bastien = { email: "bastien.leroy@example.test", firstName: "Bastien", lastName: "Leroy" };
const sansNom = { email: "bastien@example.test", firstName: null, lastName: null };

describe("CHR-02 — Le nom d'un collègue (A1)", () => {
  it("prénom sur une ligne, prénom et nom dans un menu, initiales des deux", () => {
    expect(personShortName(bastien)).toBe("Bastien");
    expect(personFullName(bastien)).toBe("Bastien Leroy");
    expect(personInitials(bastien)).toBe("BL");
    expect(personInitials({ ...bastien, firstName: "émile", lastName: null })).toBe("É");
  });

  it("sans prénom, le début de l'adresse", () => {
    expect(personShortName(sansNom)).toBe("bastien");
    expect(personFullName(sansNom)).toBe("bastien");
    expect(personInitials(sansNom)).toBe("B");
  });

  it("nettoie la saisie, vide efface ; trop long ou avec un caractère de contrôle, refusé", () => {
    expect(personNamesSchema.parse({ firstName: "  Jean   Paul ", lastName: "" })).toEqual({ firstName: "Jean Paul", lastName: null });
    expect(personNamesSchema.safeParse({ firstName: "x".repeat(81), lastName: null as unknown as string }).success).toBe(false);
    expect(personNamesSchema.safeParse({ firstName: "Bas\u0000tien", lastName: "Leroy" }).success).toBe(false);
  });
});
