// Lot 72a (EVT-05, IMP-03 ; J1, ADR 0121) — « En préparation » n'est plus un statut : un fichier qui le
// dit crée un évènement « Confirmé » (signé, en préparation à l'écran).
import { describe, expect, it } from "vitest";
import { EVENT_STATUS_CHOICES, IMPORT_FIELDS } from "@symbola/contracts";
import { parseImportRows } from "@symbola/import-engine";
import { starterImportSynonyms } from "@symbola/starter-templates";

function statusOf(cell: string): unknown {
  const [row] = parseImportRows({
    headers: ["Prénom", "Statut"],
    rows: [["Élodie", cell]],
    sourceLineNumbers: [2],
    assignments: [
      { columnIndex: 0, fieldKey: "client1FirstName", target: "field" },
      { columnIndex: 1, fieldKey: "status", target: "field" },
    ],
    fields: IMPORT_FIELDS.events,
    synonyms: starterImportSynonyms(),
  });
  return row?.values.status;
}

describe("EVT-05 — Un import qui lit « En préparation » crée un évènement « Confirmé » (lot 72a, critère 8)", () => {
  it.each(["En préparation", "en préparation active", "In preparation", "Preparing"])("« %s » donne « confirmed »", (cell) => {
    expect(statusOf(cell)).toBe("confirmed");
  });

  it("les synonymes ne connaissent que les statuts de la liste", () => {
    expect(Object.keys(starterImportSynonyms().choices.status ?? {}).sort()).toEqual([...EVENT_STATUS_CHOICES].sort());
  });
});
