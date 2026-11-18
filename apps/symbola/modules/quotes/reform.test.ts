// Lot 41 (JUR-02, JUR-13 ; D6, D8, D9) — règles pures des mentions de la réforme.
import { describe, expect, it } from "vitest";
import { cleanPostalAddress, cleanReference, companyBuyerOf, countryCodeOf, formatPostalAddress, InvalidPostalAddressError, InvalidReferenceError, operationCategory, sirenOf } from "./reform";

const novalea = {
  kind: "company" as const,
  name: "Novaléa SAS",
  anonymized: false,
  companyIdNumber: "55210055400013",
  vatNumber: "FR83552100554",
  addressLine: "8 avenue des Champs",
  postalCode: "75008",
  city: "Paris",
  country: "France",
};

describe("JUR-02 — Mentions de la réforme : SIREN du client, adresse de livraison, nature de l'opération, option sur les débits", () => {
  it("un SIRET saisi donne son SIREN (neuf premiers chiffres) ; un SIREN reste tel quel ; autre chose : aucun", () => {
    expect(sirenOf("552 100 554 00013")).toBe("552100554");
    expect(sirenOf("552100554")).toBe("552100554");
    expect(sirenOf("12345")).toBeNull();
    expect(sirenOf(null)).toBeNull();
  });

  it("l'acheteur entreprise est figé avec sa raison sociale, son SIREN, son numéro de TVA et son adresse structurée", () => {
    expect(companyBuyerOf(novalea)).toEqual({
      buyer: { name: "Novaléa SAS", siren: "552100554", vatNumber: "FR83552100554", address: { line: "8 avenue des Champs", postalCode: "75008", city: "Paris", countryCode: "FR" } },
      missing: [],
    });
  });

  it("sans acheteur, avec une personne, sans SIREN ou sans adresse structurée : chaque champ manquant est nommé", () => {
    expect(companyBuyerOf(null).missing).toEqual(["buyerCompany"]);
    expect(companyBuyerOf({ ...novalea, kind: "person" }).missing).toEqual(["buyerCompany"]);
    expect(companyBuyerOf({ ...novalea, anonymized: true }).missing).toEqual(["buyerCompany"]);
    expect(companyBuyerOf({ ...novalea, companyIdNumber: null }).missing).toEqual(["buyerSiren"]);
    expect(companyBuyerOf({ ...novalea, postalCode: null }).missing).toEqual(["buyerAddress"]);
    expect(companyBuyerOf({ ...novalea, companyIdNumber: null, city: "" }).missing).toEqual(["buyerSiren", "buyerAddress"]);
    expect(companyBuyerOf({ ...novalea, country: "Pays imaginaire" }).missing).toEqual(["buyerAddress"]);
  });

  it("catégorie de l'opération déduite des lignes : services, biens ou opération mixte ; service par défaut", () => {
    expect(operationCategory([])).toBe("services");
    expect(operationCategory(["service", "service"])).toBe("services");
    expect(operationCategory(["goods"])).toBe("goods");
    expect(operationCategory(["service", "goods"])).toBe("mixed");
  });

  it("adresse de livraison : vide (aucune) ou complète ; pays en code ISO (France par défaut)", () => {
    expect(cleanPostalAddress(null)).toBeNull();
    expect(cleanPostalAddress({ line: " ", postalCode: "", city: "" })).toBeNull();
    expect(cleanPostalAddress({ line: "Château des Essais", postalCode: "74000", city: "Annecy" })).toEqual({ line: "Château des Essais", postalCode: "74000", city: "Annecy", countryCode: "FR" });
    expect(cleanPostalAddress({ line: "Rue du Lac", postalCode: "1204", city: "Genève", countryCode: "ch" })?.countryCode).toBe("CH");
    expect(() => cleanPostalAddress({ line: "Château", postalCode: "", city: "Annecy" })).toThrow(InvalidPostalAddressError);
    expect(() => cleanPostalAddress({ line: "", postalCode: "74000", city: "Annecy" })).toThrow(InvalidPostalAddressError);
    expect(() => cleanPostalAddress({ line: "Château", postalCode: "74<000", city: "Annecy" })).toThrow(InvalidPostalAddressError);
    expect(() => cleanPostalAddress({ line: "Château", postalCode: "74000", city: "Annecy", countryCode: "Ailleurs" })).toThrow(InvalidPostalAddressError);
    expect(formatPostalAddress({ line: "Rue du Lac", postalCode: "1204", city: "Genève", countryCode: "CH" })).toBe("Rue du Lac, 1204 Genève, CH");
    expect(countryCodeOf("France")).toBe("FR");
  });
});

describe("JUR-13 — Bon de commande et références d'achat du client sur le devis et la facture", () => {
  it("le numéro est une ligne de texte bornée à 60 caractères ; « < », « & » et guillemets permis (échappés dans le XML)", () => {
    expect(cleanReference("  BC-2027-0142  ", "orderReference")).toBe("BC-2027-0142");
    expect(cleanReference('BC <"42"> & \'A\'', "orderReference")).toBe('BC <"42"> & \'A\'');
    expect(cleanReference("", "orderReference")).toBeNull();
    expect(cleanReference("x".repeat(60), "buyerReference")).toHaveLength(60);
    expect(() => cleanReference("x".repeat(61), "orderReference")).toThrow(InvalidReferenceError);
  });

  it("les caractères de contrôle et les retours à la ligne sont refusés", () => {
    expect(() => cleanReference("BC\n2027", "orderReference")).toThrow(InvalidReferenceError);
    expect(() => cleanReference("BC\u0000", "orderReference")).toThrow(InvalidReferenceError);
    expect(() => cleanReference(`BC${String.fromCharCode(0x2028)}`, "buyerReference")).toThrow(InvalidReferenceError);
  });
});
