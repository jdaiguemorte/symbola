// Lot 50 — règles pures de la synthèse pour le traiteur (INV-06 ; D5 à D8) : totaux par type de
// repas, régimes et allergènes, par table ; présents seulement dans les couverts ; « en attente » et
// repas prestataires à part ; version nominative ou agrégée exacte ; tableur CSV sans retouche.
import { toCsv } from "@symbola/privacy";
import { describe, expect, it } from "vitest";
import { buildCatererSummary, catererCsvTable, type CatererCsvLabels, type CatererSummaryInput } from "./caterer-summary";

const mealTypes = [
  { id: "adult", label: "Adulte", hidden: false },
  { id: "child", label: "Enfant", hidden: false },
  { id: "baby", label: "Bébé (sans repas)", hidden: false },
  { id: "vendor", label: "Prestataire", hidden: false },
  { id: "old", label: "Ancien menu", hidden: true },
];
const dietOptions = [
  { id: "veg", label: "Végétarien", kind: "diet" as const },
  { id: "gluten", label: "Sans gluten", kind: "diet" as const },
  { id: "nuts", label: "Fruits à coque", kind: "allergen" as const },
  { id: "eggs", label: "Œufs", kind: "allergen" as const },
];

function input(overrides: Partial<CatererSummaryInput> = {}): CatererSummaryInput {
  return {
    version: "aggregate",
    eventId: "e1",
    keyMoment: { id: "m1", name: "Dîner", date: "2027-06-12", startTime: "19:30" },
    generatedAt: new Date("2027-06-03T16:00:00Z"),
    dietsPurged: false,
    tables: [
      { id: "t1", name: "Table 1", shape: "round", capacity: 10 },
      { id: "t2", name: "Honneur", shape: "head", capacity: 8 },
    ],
    people: [
      { id: "p1", name: "Jeanne Morel", status: "present", tableId: "t1", mealTypeId: "adult", dietOptionIds: ["gluten"] },
      { id: "p2", name: "Pierre Morel", status: "present", tableId: "t1", mealTypeId: "adult", dietOptionIds: [] },
      { id: "p3", name: "Léo", status: "present", tableId: "t1", mealTypeId: "child", dietOptionIds: ["nuts", "veg"] },
      { id: "p4", name: "Mila", status: "present", tableId: "t1", mealTypeId: "baby", dietOptionIds: [] },
      { id: "p5", name: "Léa Martin", status: "present", tableId: "t2", mealTypeId: "adult", dietOptionIds: ["veg"] },
      { id: "p6", name: "=Maxime", status: "present", tableId: "t2", mealTypeId: "old", dietOptionIds: [] },
      { id: "p7", name: "Antoine Leroy", status: "present", tableId: null, mealTypeId: "adult", dietOptionIds: ["veg"] },
      { id: "p8", name: "Zoé", status: "pending", tableId: "t2", mealTypeId: "adult", dietOptionIds: ["eggs"] },
    ],
    mealTypes,
    dietOptions,
    vendorMeals: 3,
    vendorMealTypeId: "vendor",
    ...overrides,
  };
}

const labels: CatererCsvLabels = {
  table: "Table",
  name: "Nom",
  mealType: "Type de repas",
  diets: "Régimes et allergies",
  count: "Nombre",
  response: "Réponse",
  covers: "Couverts",
  unplaced: "Sans table",
  total: "Total",
  vendorMeals: "Repas prestataires",
  pending: "En attente de réponse",
  present: "Présent",
};

describe("INV-06 — Synthèse pour le traiteur : totaux, par table, présents seulement", () => {
  it("totaux : couverts, repas par type et régimes des présents ; « en attente » et prestataires à part", () => {
    const summary = buildCatererSummary(input());
    expect(summary.totals.covers).toBe(7);
    expect(summary.totals.meals).toEqual([
      { id: "adult", label: "Adulte", count: 4 },
      { id: "child", label: "Enfant", count: 1 },
      { id: "baby", label: "Bébé (sans repas)", count: 1 },
      { id: "old", label: "Ancien menu", count: 1 },
    ]);
    expect(summary.totals.diets).toEqual([
      { id: "veg", label: "Végétarien", count: 3 },
      { id: "gluten", label: "Sans gluten", count: 1 },
      { id: "nuts", label: "Fruits à coque", count: 1 },
    ]);
    expect(summary.pending).toMatchObject({ covers: 1, meals: [{ id: "adult", label: "Adulte", count: 1 }], diets: [{ id: "eggs", label: "Œufs", count: 1 }] });
    expect(summary.vendorMeals).toEqual({ count: 3, label: "Prestataire", mealTypeId: "vendor" });
    expect(summary.generatedAt).toBe("2027-06-03T16:00:00.000Z");
  });

  it("par table, dans l'ordre du plan, puis les présents sans table ; la personne en attente n'est dans aucun couvert", () => {
    const summary = buildCatererSummary(input());
    expect(summary.tables.map((table) => [table.id, table.covers])).toEqual([
      ["t1", 4],
      ["t2", 2],
      [null, 1],
    ]);
    expect(summary.tables[0]!.diets).toEqual([
      { id: "veg", label: "Végétarien", count: 1 },
      { id: "gluten", label: "Sans gluten", count: 1 },
      { id: "nuts", label: "Fruits à coque", count: 1 },
    ]);
    // Les colonnes : types utilisés ou visibles (le prestataire en est un), régimes présents seulement.
    expect(summary.mealTypes.map((type) => type.id)).toEqual(["adult", "child", "baby", "vendor", "old"]);
    expect(summary.dietOptions.map((option) => option.id)).toEqual(["veg", "gluten", "nuts", "eggs"]);
  });

  it("D6 : la version agrégée ne nomme personne, avec des nombres exacts (pas de « moins de 3 »)", () => {
    const summary = buildCatererSummary(input());
    expect(summary.tables.every((table) => table.people === null)).toBe(true);
    expect(summary.pending.people).toBeNull();
    expect(JSON.stringify(summary)).not.toMatch(/Jeanne|Morel|Léa|Antoine|Zoé|Mila/);
    expect(summary.tables[1]!.diets).toEqual([{ id: "veg", label: "Végétarien", count: 1 }]);
  });

  it("D6 : la version nominative nomme chaque personne avec son type de repas et ses régimes", () => {
    const summary = buildCatererSummary(input({ version: "nominative" }));
    expect(summary.tables[0]!.people).toEqual([
      { name: "Jeanne Morel", mealType: "Adulte", diets: ["Sans gluten"] },
      { name: "Pierre Morel", mealType: "Adulte", diets: [] },
      { name: "Léo", mealType: "Enfant", diets: ["Végétarien", "Fruits à coque"] },
      { name: "Mila", mealType: "Bébé (sans repas)", diets: [] },
    ]);
    expect(summary.pending.people).toEqual([{ name: "Zoé", mealType: "Adulte", diets: ["Œufs"] }]);
  });

  it("sans plan : les totaux seulement, avec la mention « plan de table non composé »", () => {
    const summary = buildCatererSummary(input({ tables: null }));
    expect(summary.planComposed).toBe(false);
    expect(summary.tables).toEqual([]);
    expect(summary.totals.covers).toBe(7);
  });

  it("régimes purgés (J+7) : plus aucun régime, la mention le dit", () => {
    const summary = buildCatererSummary(input({ dietsPurged: true, people: input().people.map((person) => ({ ...person, dietOptionIds: [] })) }));
    expect(summary.dietsPurged).toBe(true);
    expect(summary.totals.diets).toEqual([]);
    expect(summary.dietOptions).toEqual([]);
  });
});

describe("INV-06 — Tableur CSV utilisable sans retouche (D7)", () => {
  it("agrégé : une ligne par table, colonnes nommées, nombres en nombres, totaux, prestataires et attente à part", () => {
    const rows = catererCsvTable(buildCatererSummary(input()), labels);
    expect(rows[0]).toEqual(["Table", "Couverts", "Adulte", "Enfant", "Bébé (sans repas)", "Prestataire", "Ancien menu", "Végétarien", "Sans gluten", "Fruits à coque", "Œufs"]);
    expect(rows[1]).toEqual(["Table 1", "4", "2", "1", "1", "0", "0", "1", "1", "1", "0"]);
    expect(rows[2]).toEqual(["Honneur", "2", "1", "0", "0", "0", "1", "1", "0", "0", "0"]);
    expect(rows[3]).toEqual(["Sans table", "1", "1", "0", "0", "0", "0", "1", "0", "0", "0"]);
    expect(rows[4]).toEqual(["Total", "7", "4", "1", "1", "0", "1", "3", "1", "1", "0"]);
    expect(rows[5]).toEqual(["Repas prestataires", "3", "0", "0", "0", "3", "0", "0", "0", "0", "0"]);
    expect(rows[6]).toEqual(["En attente de réponse", "1", "1", "0", "0", "0", "0", "0", "0", "0", "1"]);
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.length === rows[0]!.length)).toBe(true);
  });

  it("nominatif : une ligne par personne, puis les repas prestataires et les personnes en attente", () => {
    const rows = catererCsvTable(buildCatererSummary(input({ version: "nominative" })), labels);
    expect(rows[0]).toEqual(["Table", "Nom", "Type de repas", "Régimes et allergies", "Nombre", "Réponse"]);
    expect(rows[1]).toEqual(["Table 1", "Jeanne Morel", "Adulte", "Sans gluten", "1", "Présent"]);
    expect(rows[3]).toEqual(["Table 1", "Léo", "Enfant", "Végétarien, Fruits à coque", "1", "Présent"]);
    expect(rows.find((row) => row[1] === "Antoine Leroy")).toEqual(["Sans table", "Antoine Leroy", "Adulte", "Végétarien", "1", "Présent"]);
    expect(rows.find((row) => row[0] === "Repas prestataires")).toEqual(["Repas prestataires", "", "Prestataire", "", "3", ""]);
    expect(rows.at(-1)).toEqual(["", "Zoé", "Adulte", "Œufs", "1", "En attente de réponse"]);
    expect(rows.filter((row) => row[5] === "Présent")).toHaveLength(7);
  });

  it("le fichier : marque d'ordre des octets, séparateur « ; », accents intacts, cellules = + - @ neutralisées", () => {
    const csv = toCsv(catererCsvTable(buildCatererSummary(input({ version: "nominative" })), labels));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Table;Nom;Type de repas;Régimes et allergies;Nombre;Réponse");
    expect(lines.find((line) => line.includes("Maxime"))).toBe("Honneur;'=Maxime;Ancien menu;;1;Présent");
    for (const name of ["+33 Paul", "-Clara", "@Inès"]) {
      const cell = toCsv(catererCsvTable(buildCatererSummary(input({ version: "nominative", people: [{ id: "x", name, status: "present", tableId: "t1", mealTypeId: "adult", dietOptionIds: [] }] })), labels));
      expect(cell).toContain(`;'${name};`);
    }
  });
});
