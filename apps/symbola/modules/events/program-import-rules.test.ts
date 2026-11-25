// Lot 51 (CHR-08 ; ADR 0091) — un chrono existant s'importe depuis un tableur : colonnes reconnues,
// heures lues sous leurs formes courantes, temps forts trouvés ou à créer, écarts expliqués avant
// d'écrire. Règles pures (le fichier est lu par le moteur d'import, formules neutralisées).
import { describe, expect, it } from "vitest";
import { starterProgramImportColumns } from "@symbola/starter-templates";
import { mapProgramColumns, parseClock, programRowsFromExport, proposeSpeakerSlot, readProgramRows, speakerKind, dayMomentName } from "./program-import-rules";

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

describe("CHR-08 — Programme du jour J depuis le PDF de l'ancien logiciel (rattachement, lot 63b)", () => {
  const slots = [
    { id: "slot-dj", label: "DJ", vendorNames: ["Ondes Sonores"] },
    { id: "slot-traiteur-1", label: "Traiteur", vendorNames: ["Les Saveurs d'Antan"] },
    { id: "slot-traiteur-2", label: "Traiteur", vendorNames: ["La Barque Fictive"] },
    { id: "slot-coiffure", label: "Coiffure", vendorNames: [] },
  ];
  const synonyms = [["Coiffeur(se)", "Coiffure", "Coiffeur(se) - Maquilleur(se)"]];

  it("propose le poste dont un prestataire porte le nom de l'intervenant, sinon le seul poste de son métier", () => {
    expect(proposeSpeakerSlot({ role: "DJ", company: "Ondes Sonores", contact: "Félix ROUSSEL" }, slots)).toBe("slot-dj");
    expect(proposeSpeakerSlot({ role: "Traiteur", company: "La Barque Fictive", contact: null }, slots)).toBe("slot-traiteur-2");
    // Deux postes du même métier, aucun nom reconnu : rien n'est proposé (la planner choisit).
    expect(proposeSpeakerSlot({ role: "Traiteur", company: "Inconnu", contact: null }, slots)).toBeNull();
    expect(proposeSpeakerSlot({ role: "Coiffeur(se) - Maquilleur(se)", company: "Iris Beauté", contact: null }, slots, synonyms)).toBe("slot-coiffure");
    expect(proposeSpeakerSlot({ role: "Photographe", company: "Studio", contact: null }, slots)).toBeNull();
  });

  it("la planner et les mariés ne sont jamais des intervenants à rattacher", () => {
    const profile = { plannerRoles: ["Wedding Planner", "WeddingPlanner"], clientRoles: ["Marié", "Client"] };
    expect(speakerKind({ role: "Wedding-Planner" }, profile)).toBe("planner");
    expect(speakerKind({ role: "Marié" }, profile)).toBe("client");
    expect(speakerKind({ role: "DJ" }, profile)).toBe("vendor");
  });

  const program = {
    title: null,
    eventDate: "2027-06-12",
    speakers: [
      { role: "DJ", company: "Ondes Sonores", contact: "Félix ROUSSEL", phone: null },
      { role: "WeddingPlanner", company: "Atelier", contact: "Julie EXEMPLE", phone: null },
    ],
    rows: [
      { line: 1, date: "2027-06-11", startTime: "19:00", endTime: "02:00", endsNextDay: true, title: "Soirée", description: "x".repeat(2100), contacts: [{ text: "DJ - Félix", role: "DJ", name: "Félix", kind: "vendor" as const }, { text: "WeddingPlanner - Julie", role: "WeddingPlanner", name: "Julie", kind: "planner" as const }, { text: "Gaspard", role: null, name: "Gaspard", kind: "free" as const }], hiddenFromClients: false, marker: false },
      { line: 2, date: null, startTime: "21:18", endTime: null, endsNextDay: false, title: "Coucher du soleil", description: null, contacts: [], hiddenFromClients: false, marker: true },
      { line: 3, date: "2027-06-12", startTime: null, endTime: null, endsNextDay: false, title: "Sans heure", description: null, contacts: [], hiddenFromClients: false, marker: true },
      { line: 4, date: "2027-06-12", startTime: "21:30", endTime: null, endsNextDay: false, title: "Animation surprise", description: null, contacts: [{ text: "DJ - ROUSSEL", role: "DJ", name: "ROUSSEL", kind: "vendor" as const }], hiddenFromClients: true, marker: false },
    ],
  };

  it("chaque séquence garde son jour, ses heures et sa description en note ; l'interlocuteur va au poste choisi, la planner est ignorée, un témoin reste en texte", () => {
    const { rows, problems } = programRowsFromExport(program, { eventDate: "2027-06-12" }, new Map([[0, "slot-dj"]]), new Map([["slot-dj", "DJ"]]));
    expect(rows[0]).toMatchObject({ momentDate: "2027-06-11", startTime: "19:00", endTime: "02:00", endsNextDay: true, label: "Soirée" });
    expect(rows[0]!.participants).toEqual([{ vendorSlotId: "slot-dj", label: "DJ" }, { vendorSlotId: null, label: "Gaspard" }]);
    // Une description trop longue est coupée, jamais refusée.
    expect(rows[0]!.note!.length).toBe(2000);
    expect(rows[1]).toMatchObject({ momentDate: "2027-06-12", marker: true, participants: [] });
    expect(rows[2]).toMatchObject({ hiddenFromClients: true, participants: [{ vendorSlotId: "slot-dj", label: "DJ" }] });
    expect(problems).toEqual([{ line: 3, problem: "untimed" }]);
  });

  it("sans poste choisi pour son intervenant, l'interlocuteur reste en texte", () => {
    const { rows } = programRowsFromExport(program, { eventDate: "2027-06-12" }, new Map([[0, null]]), new Map());
    expect(rows[0]!.participants).toEqual([{ vendorSlotId: null, label: "DJ - Félix" }, { vendorSlotId: null, label: "Gaspard" }]);
  });
});

describe("EVT-04 — Le nom du jour créé par un import (lot 67d)", () => {
  const names = { main: "Jour J", eve: "Veille", nextDay: "Lendemain" };

  it("seul le jour de l'évènement est le « Jour J » ; la veille et le lendemain portent leur nom", () => {
    expect(dayMomentName("2026-12-05", "2026-12-05", names)).toBe("Jour J");
    expect(dayMomentName("2026-12-04", "2026-12-05", names)).toBe("Veille");
    expect(dayMomentName("2026-12-06", "2026-12-05", names)).toBe("Lendemain");
  });

  it("un autre jour porte sa date ; la veille d'un 1er janvier est bien le 31 décembre", () => {
    expect(dayMomentName("2026-12-02", "2026-12-05", names)).toBe("02/12/2026");
    expect(dayMomentName("2026-12-31", "2027-01-01", names)).toBe("Veille");
  });

  it("sans date d'évènement, le jour porte sa date", () => {
    expect(dayMomentName("2026-12-04", null, names)).toBe("04/12/2026");
  });
});
