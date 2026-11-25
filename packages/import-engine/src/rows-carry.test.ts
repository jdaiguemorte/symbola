// Lot 67a (HUB-14, BUD-01 ; recette du 24/11/2026, R03) — un budget tenu au tableur écrit le poste une
// seule fois, les lignes du dessous le laissent vide (ou la cellule est fusionnée) : la valeur du
// dessus se reporte, pour les seuls champs déclarés « à reporter ».
import { IMPORT_FIELDS } from "@symbola/contracts";
import { starterImportSynonyms } from "@symbola/starter-templates";
import { describe, expect, it } from "vitest";
import { parseImportRows, type ColumnAssignment } from "./rows";

const synonyms = starterImportSynonyms();
const headers = ["Poste", "Libellé", "Prévu"];
const assignments: ColumnAssignment[] = [
  { columnIndex: 0, fieldKey: "slotLabel", target: "field" },
  { columnIndex: 1, fieldKey: "lineLabel", target: "field" },
  { columnIndex: 2, fieldKey: "plannedAmount", target: "field" },
];

function parse(rows: string[][], fields = IMPORT_FIELDS.budget_lines) {
  return parseImportRows({ headers, rows, sourceLineNumbers: rows.map((_, index) => index + 2), assignments, fields, synonyms });
}

describe("HUB-14, BUD-01 — Le poste se reporte sur les lignes du dessous (lot 67a)", () => {
  it("une ligne sans poste mais avec un montant reprend le poste de la ligne précédente", () => {
    const rows = parse([
      ["Traiteur", "Repas", "5000"],
      ["", "Vin d'honneur", "1200"],
      ["", "Boissons", "405"],
      ["Musique", "", "1500"],
    ]);
    expect(rows.map((row) => row.values.slotLabel)).toEqual(["Traiteur", "Traiteur", "Traiteur", "Musique"]);
    expect(rows.every((row) => row.errors.length === 0)).toBe(true);
  });

  it("dit de quelle ligne du fichier vient le poste repris", () => {
    const rows = parse([
      ["Traiteur", "Repas", "5000"],
      ["", "Vin d'honneur", "1200"],
      ["", "Boissons", "405"],
    ]);
    expect(rows[0]?.carried).toBeUndefined();
    expect(rows[1]?.carried).toEqual({ slotLabel: 2 });
    expect(rows[2]?.carried).toEqual({ slotLabel: 2 });
  });

  it("la première ligne sans poste reste rejetée", () => {
    const rows = parse([
      ["", "Repas", "5000"],
      ["Musique", "", "1500"],
    ]);
    expect(rows[0]?.errors).toEqual([{ fieldKey: "slotLabel", code: "required_missing", value: "" }]);
    expect(rows[1]?.errors).toEqual([]);
  });

  it("une ligne sans aucune autre valeur reconnue ne reprend rien", () => {
    const rows = parse([
      ["Traiteur", "Repas", "5000"],
      ["", "", ""],
    ]);
    expect(rows[1]?.values.slotLabel).toBeNull();
    expect(rows[1]?.carried).toBeUndefined();
  });

  it("ne reporte que les champs déclarés à reporter : un montant vide reste vide", () => {
    const rows = parse([
      ["Traiteur", "Repas", "5000"],
      ["", "Boissons", ""],
    ]);
    expect(rows[1]?.values.slotLabel).toBe("Traiteur");
    expect(rows[1]?.values.plannedAmount).toBeNull();
    expect(rows[1]?.errors).toEqual([{ fieldKey: "plannedAmount", code: "required_missing", value: "" }]);
  });

  it("sans champ à reporter, rien ne change (les autres types d'import)", () => {
    const fields = IMPORT_FIELDS.budget_lines.map(({ carryDown: _carryDown, ...field }) => field);
    const rows = parse(
      [
        ["Traiteur", "Repas", "5000"],
        ["", "Boissons", "405"],
      ],
      fields,
    );
    expect(rows[1]?.errors).toEqual([{ fieldKey: "slotLabel", code: "required_missing", value: "" }]);
  });

  it("seul le budget déclare un champ à reporter", () => {
    const declared = Object.entries(IMPORT_FIELDS).flatMap(([type, fields]) => fields.filter((field) => field.carryDown).map((field) => `${type}.${field.key}`));
    expect(declared).toEqual(["budget_lines.slotLabel"]);
  });
});
