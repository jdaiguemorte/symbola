import { describe, expect, it } from "vitest";
import { IMPORT_ENTITY_TYPES, IMPORT_FILE_ENTITY_TYPES, IMPORT_FIELDS, IMPORT_REQUIRED_ONE_OF } from "./fields";

describe("IMP-02 — Contrat des champs importables", () => {
  it("chaque type d'éléments a au moins un champ obligatoire (ou un groupe dont un champ l'est, lot 36b), et des clés uniques", () => {
    // Lot 71a : les PDF des prestataires retenus et du programme se lisent sans colonnes à faire
    // correspondre (aucun champ) ; tous les autres, qui passent par l'envoi d'un fichier, en ont.
    expect(IMPORT_ENTITY_TYPES.filter((type) => IMPORT_FIELDS[type].length === 0)).toEqual(["event_vendors", "program"]);
    for (const type of IMPORT_FILE_ENTITY_TYPES) {
      const fields = IMPORT_FIELDS[type];
      const group = IMPORT_REQUIRED_ONE_OF[type];
      if (group) expect(group.keys.every((key) => fields.some((field) => field.key === key))).toBe(true);
      expect(fields.some((field) => field.required) || group !== undefined).toBe(true);
      expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
    }
  });

  it("un champ « choice » déclare ses valeurs", () => {
    for (const type of IMPORT_ENTITY_TYPES) {
      for (const field of IMPORT_FIELDS[type]) {
        if (field.kind === "choice") expect(field.choices?.length).toBeGreaterThan(0);
      }
    }
  });
});
