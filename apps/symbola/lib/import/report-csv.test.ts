import { describe, expect, it } from "vitest";
import { rejectedRowsCsv, rejectedRowsFileName } from "./report-csv";

describe("IMP-04 — CSV des lignes rejetées", () => {
  it("motif en première colonne, colonnes d'origine, point-virgule et BOM", () => {
    const csv = rejectedRowsCsv({
      headers: ["Tâche", "Échéance"],
      reasonHeader: "Motif",
      rows: [{ cells: ["Fleurs", "31/02/2027"], reason: "Échéance : date invalide (31/02/2027)" }],
    });
    expect(csv).toBe("﻿Motif;Tâche;Échéance\r\nÉchéance : date invalide (31/02/2027);Fleurs;31/02/2027\r\n");
  });

  it("guillemets, séparateurs et retours à la ligne protégés ; formules neutralisées", () => {
    const csv = rejectedRowsCsv({
      headers: ["Note"],
      reasonHeader: "Motif",
      rows: [
        { cells: ['dit "oui"; puis\nnon'], reason: "x" },
        { cells: ["=1+1"], reason: "@motif" },
      ],
    });
    expect(csv.split("\r\n").slice(1, 3)).toEqual(['x;"dit ""oui""; puis\nnon"', "'@motif;'=1+1"]);
  });

  it("nom du fichier dérivé du nom d'origine, sans caractère dangereux", () => {
    expect(rejectedRowsFileName("Mariages 2027.xlsx", "lignes-rejetees")).toBe("Mariages 2027-lignes-rejetees.csv");
    expect(rejectedRowsFileName('a"b\r\n.csv', "rejected")).toBe("a_b__-rejected.csv");
  });
});
