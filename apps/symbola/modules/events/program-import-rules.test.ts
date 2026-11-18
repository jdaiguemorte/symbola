// Lot 51 (CHR-08 ; ADR 0091) — un chrono existant s'importe depuis un tableur : colonnes reconnues,
// heures lues sous leurs formes courantes, temps forts trouvés ou à créer, écarts expliqués avant
// d'écrire. Règles pures (le fichier est lu par le moteur d'import, formules neutralisées).
import { describe, expect, it } from "vitest";
import { starterProgramImportColumns } from "@symbola/starter-templates";
import { mapProgramColumns, parseClock, readProgramRows } from "./program-import-rules";

const columns = starterProgramImportColumns();

describe("CHR-08 — Modèles de chrono et import", () => {
  it("reconnaît les intitulés en français et en anglais, sans accents ni casse ; signale les autres", () => {
    const mapped = mapProgramColumns(["Jour", "Début", "FIN", "Séquence", "Lieu", "Responsable", "Remarque", "Couleur"], columns);
    expect(mapped.mapping).toEqual({ moment: 0, start: 1, end: 2, label: 3, location: 4, responsible: 5, note: 6 });
    expect(mapped.unknown).toEqual([7]);
    expect(mapProgramColumns(["Key moment", "Date", "Start", "End", "Activity"], columns).mapping).toEqual({ moment: 0, date: 1, start: 2, end: 3, label: 4 });
  });

  it("lit les heures sous leurs formes courantes, et la fraction de jour d'un tableur", () => {
    expect(parseClock("16:00")).toBe("16:00");
    expect(parseClock("9h")).toBe("09:00");
    expect(parseClock("16h30")).toBe("16:30");
    expect(parseClock("16 h 30")).toBe("16:30");
    expect(parseClock("4:05 PM")).toBe("16:05");
    expect(parseClock("12:00 am")).toBe("00:00");
    expect(parseClock("0.6875")).toBe("16:30");
    expect(parseClock("16:00:00")).toBe("16:00");
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("bientôt")).toBeNull();
    expect(parseClock("")).toBeNull();
  });

  it("un temps fort existant garde son jour ; un temps fort nouveau prend la date de sa colonne, sinon le jour de l'évènement ; une date seule nomme le jour", () => {
    const mapped = mapProgramColumns(["Temps fort", "Date", "Début", "Fin", "Séquence", "Note"], columns).mapping;
    const result = readProgramRows(
      [
        ["Cocktail de bienvenue", "11/06/2027", "18:00", "20:00", "Accueil des invités", "'=HYPERLIEN(\"x\")"],
        ["Cérémonie", "", "16:00", "", "Cérémonie laïque", ""],
        ["Brunch", "13/06/2027", "11h", "14h", "Brunch", ""],
        ["", "", "17h", "", "Vin d'honneur", ""],
      ],
      [2, 3, 4, 5],
      mapped,
      { eventDate: "2027-06-12", moments: [{ name: "cérémonie", date: "2027-06-12" }] },
    );
    expect(result.problems).toEqual([]);
    expect(result.rows.map((row) => [row.moment, row.momentDate, row.startTime, row.endTime, row.label])).toEqual([
      ["Cocktail de bienvenue", "2027-06-11", "18:00", "20:00", "Accueil des invités"],
      ["cérémonie", "2027-06-12", "16:00", null, "Cérémonie laïque"],
      ["Brunch", "2027-06-13", "11:00", "14:00", "Brunch"],
      [null, "2027-06-12", "17:00", null, "Vin d'honneur"],
    ]);
    // La formule neutralisée par le moteur reste du texte.
    expect(result.rows[0]!.note).toBe("'=HYPERLIEN(\"x\")");
    expect(result.newMoments).toEqual([
      { name: "Cocktail de bienvenue", date: "2027-06-11" },
      { name: "Brunch", date: "2027-06-13" },
    ]);
  });

  it("une colonne « jour » qui porte des dates range les séquences par jour", () => {
    const mapped = mapProgramColumns(["Jour", "Début", "Séquence"], columns).mapping;
    const result = readProgramRows([["2027-06-11", "18:00", "Accueil"]], [2], mapped, { eventDate: "2027-06-12", moments: [] });
    expect(result.rows[0]).toMatchObject({ moment: null, momentDate: "2027-06-11" });
    expect(result.newMoments).toEqual([]);
  });

  it("les écarts sont expliqués ligne par ligne : début illisible, fin illisible, séquence vide, temps fort sans date, texte trop long", () => {
    const mapped = mapProgramColumns(["Temps fort", "Début", "Fin", "Séquence", "Lieu"], columns).mapping;
    const result = readProgramRows(
      [
        ["", "midi", "", "Déjeuner", ""],
        ["", "12:00", "plus tard", "Déjeuner", ""],
        ["", "12:00", "", "", ""],
        ["Brunch", "11:00", "", "Brunch", ""],
        ["", "12:00", "", "Déjeuner", "x".repeat(201)],
      ],
      [2, 3, 4, 5, 6],
      mapped,
      { eventDate: null, moments: [] },
    );
    expect(result.problems).toEqual([
      { line: 2, problem: "start" },
      { line: 3, problem: "end" },
      { line: 4, problem: "label" },
      { line: 5, problem: "moment_date" },
      { line: 6, problem: "too_long" },
    ]);
    expect(result.rows).toEqual([]);
  });
});
