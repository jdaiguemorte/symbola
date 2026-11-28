// Lot 73d — la fenêtre unique de création d'un prestataire (spécification du lot 73, § 5.4, critères 1 à 4).
import { describe, expect, it } from "vitest";
import { fieldErrors } from "@/lib/forms/field-validation";
import { chosenTypeIds, UNCLASSIFIED_TRADE, vendorCreateFieldsSchema } from "@/lib/forms/vendor-create-fields";
import { LEGACY_RUBRIC_FIELDS, tradeGroups, VENDOR_CREATE_FIELDS, VENDOR_DETAIL_FIELDS } from "./vendor-create-model";
import { similarVendor } from "./vendor-create-similar";

const TRAITEUR = "11111111-1111-4111-8111-111111111111";
const CALECHE = "22222222-2222-4222-8222-222222222222";

describe("PRE-01 — Un seul formulaire de création (lot 73d, critère 1)", () => {
  it("les six champs viennent dans l'ordre de l'usage : nom, métier, contact, téléphone, e-mail, ville", () => {
    expect(VENDOR_CREATE_FIELDS).toEqual(["name", "typeId", "contactName", "phone", "email", "city"]);
  });

  it("le métier est obligatoire ; « À classer », choisi exprès, est accepté", () => {
    const schema = vendorCreateFieldsSchema();
    expect(fieldErrors(schema, { name: "Douceurs Montées", typeId: "" })).toEqual([{ field: "typeId", key: "tradeRequired" }]);
    expect(fieldErrors(schema, { name: "Douceurs Montées", typeId: UNCLASSIFIED_TRADE })).toEqual([]);
    expect(fieldErrors(schema, { name: "Douceurs Montées", typeId: TRAITEUR })).toEqual([]);
    expect(chosenTypeIds(UNCLASSIFIED_TRADE)).toEqual([]);
    expect(chosenTypeIds(TRAITEUR)).toEqual([TRAITEUR]);
  });

  it("depuis un poste, « Comment l'ajouter ? » doit avoir une réponse, sans rien de coché d'avance", () => {
    const schema = vendorCreateFieldsSchema({ fromSlot: true });
    expect(fieldErrors(schema, { name: "Les Calèches du Lac", typeId: CALECHE })).toEqual([{ field: "mode", key: "modeRequired" }]);
    expect(fieldErrors(schema, { name: "Les Calèches du Lac", typeId: CALECHE, mode: "compare" })).toEqual([]);
    expect(fieldErrors(schema, { name: "Les Calèches du Lac", typeId: CALECHE, mode: "retain" })).toEqual([]);
    expect(fieldErrors(schema, { name: "Les Calèches du Lac", typeId: CALECHE, mode: "replace" })).toEqual([{ field: "mode", key: "modeRequired" }]);
  });

  it("la liste des métiers est rangée par famille, et « À classer » en est le dernier choix", () => {
    const groups = tradeGroups(
      [
        { id: TRAITEUR, label: "Traiteur", familyId: "f-table" },
        { id: CALECHE, label: "Calèche et attelage", familyId: "f-transport" },
        { id: "solo", label: "Feux d'artifice", familyId: null },
      ],
      [
        { id: "f-table", label: "Traiteurs" },
        { id: "f-transport", label: "Transport" },
        { id: "f-vide", label: "Musique" },
      ],
      "À classer",
    );
    expect(groups.map((group) => [group.label, group.options.map((option) => option.label)])).toEqual([
      ["Traiteurs", ["Traiteur"]],
      ["Transport", ["Calèche et attelage"]],
      [null, ["Feux d'artifice"]],
      [null, ["À classer"]],
    ]);
    expect(groups.at(-1)?.options).toEqual([{ value: UNCLASSIFIED_TRADE, label: "À classer" }]);
  });
});

describe("PRE-01 — « Plus de détails » garde tout (lot 73d, critère 2)", () => {
  it("tous les champs des quatre rubriques d'avant sont dans les six champs ou derrière « Plus de détails »", () => {
    const offered = new Set<string>([...VENDOR_CREATE_FIELDS, ...VENDOR_DETAIL_FIELDS, "typeIds"]);
    expect(LEGACY_RUBRIC_FIELDS.filter((field) => !offered.has(field))).toEqual([]);
  });

  it("« Plus de détails » ne répète aucun des six champs", () => {
    expect(VENDOR_DETAIL_FIELDS.filter((field) => (VENDOR_CREATE_FIELDS as readonly string[]).includes(field))).toEqual([]);
  });
});

describe("UX-10 — Les erreurs écrites par Symbola (lot 73d, critère 3)", () => {
  it("envoyée vide, la fenêtre dit ce qui manque, champ par champ : le nom, puis le métier", () => {
    expect(fieldErrors(vendorCreateFieldsSchema(), {})).toEqual([
      { field: "name", key: "nameRequired" },
      { field: "typeId", key: "tradeRequired" },
    ]);
  });

  it("un e-mail illisible est signalé sous son champ ; un e-mail vide ne l'est pas", () => {
    const schema = vendorCreateFieldsSchema();
    expect(fieldErrors(schema, { name: "Atelier", typeId: TRAITEUR, email: "atelier@" })).toEqual([{ field: "email", key: "emailInvalid" }]);
    expect(fieldErrors(schema, { name: "Atelier", typeId: TRAITEUR, email: "" })).toEqual([]);
  });

  it("à la modification, les métiers se cochent : le choix unique n'est pas demandé", () => {
    expect(fieldErrors(vendorCreateFieldsSchema({ edit: true }), { name: "Atelier" })).toEqual([]);
  });
});

describe("PRE-01 — Un nom proche d'une fiche du carnet (lot 73d, critère 4)", () => {
  const book = [
    { id: "a", name: "Calèches du Marais", city: "Niort" },
    { id: "b", name: "Maison Haddad", city: "Poitiers" },
    { id: "c", name: "Atelier Papier", city: "Poitiers" },
  ];

  it("« Les Calèches du Lac » rappelle « Calèches du Marais » à Niort", () => {
    expect(similarVendor("Les Calèches du Lac", book)).toEqual({ id: "a", name: "Calèches du Marais", city: "Niort" });
  });

  it("le même nom, aux accents et à la casse près, est signalé", () => {
    expect(similarVendor("maison HADDAD", book)?.id).toBe("b");
  });

  it("un nom sans ressemblance, trop court, ou la fiche modifiée elle-même ne sont pas signalés", () => {
    expect(similarVendor("Douceurs Montées", book)).toBeNull();
    expect(similarVendor("Atelier Roussel", book)).toBeNull();
    expect(similarVendor("Ma", book)).toBeNull();
    expect(similarVendor("Maison Haddad", book, { exceptId: "b" })).toBeNull();
  });
});
