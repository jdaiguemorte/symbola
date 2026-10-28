import { IMPORT_FIELDS, type ImportEntityType } from "@symbola/contracts";
import { starterImportSynonyms } from "@symbola/starter-templates";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { describe, expect, it } from "vitest";
import { LOW_CONFIDENCE_THRESHOLD, normalizeLabel, proposeMapping } from "./mapping";
import { readImportFile } from "./read";

const synonyms = starterImportSynonyms().columns;

function propose(file: string, entityType: ImportEntityType) {
  const result = readImportFile(readImportCorpusFile(file), { maxBytes: 10 * 1024 * 1024, maxRows: 5000 });
  if (!result.ok) throw new Error(`lecture refusée : ${result.reason}`);
  const proposals = proposeMapping({
    headers: result.table.headers,
    rows: result.table.rows,
    fields: IMPORT_FIELDS[entityType],
    synonyms,
  });
  return Object.fromEntries(proposals.map((proposal) => [result.table.headers[proposal.columnIndex] || `#${proposal.columnIndex}`, proposal]));
}

function fields(file: string, entityType: ImportEntityType) {
  return Object.fromEntries(Object.entries(propose(file, entityType)).map(([header, proposal]) => [header, proposal.fieldKey]));
}

describe("IMP-02 — Reconnaissance des colonnes", () => {
  describe("Quand le fichier est lu, alors l'app propose une correspondance pour chaque colonne, avec un indice de confiance", () => {
    it("export Excel français : mariée → client 1, marié → client 2", () => {
      expect(fields("excel-fr-windows1252.csv", "events")).toEqual({
        "Prénom mariée": "client1FirstName",
        "Nom mariée": "client1LastName",
        "Prénom marié": "client2FirstName",
        "Nom marié": "client2LastName",
        "Date du mariage": "eventDate",
        Lieu: "venueName",
        Ville: "venueCity",
        // Budget (module Budget) et e-mail : sans équivalent sur un événement.
        Budget: null,
        "E-mail": null,
      });
      expect(propose("excel-fr-windows1252.csv", "events")["Prénom mariée"]?.confidence).toBe(100);
    });

    it("en-têtes anglais de Google Sheets", () => {
      expect(fields("google-sheets-en.csv", "events")).toMatchObject({
        "Bride first name": "client1FirstName",
        "Groom first name": "client2FirstName",
        "Wedding date": "eventDate",
        Venue: "venueName",
        Notes: null,
      });
    });

    it("colonnes dans le désordre", () => {
      expect(fields("desordre-lignes-inegales.csv", "events")).toMatchObject({
        Ville: "venueCity",
        Date: "eventDate",
        "Nom client 1": "client1LastName",
        "Prénom client 1": "client1FirstName",
        Source: "prospectSource",
      });
    });

    it("JSON aplati (clients.1.firstName)", () => {
      expect(fields("export.json", "events")).toMatchObject({
        date: "eventDate",
        "venue.name": "venueName",
        "venue.city": "venueCity",
        "clients.1.firstName": "client1FirstName",
        "clients.2.firstName": "client2FirstName",
      });
    });

    it("tâches d'un tableau maison", () => {
      expect(fields("maison-titre-bom.csv", "tasks")).toEqual({
        Tâche: "label",
        Échéance: "dueDate",
        Responsable: "responsible",
        Faite: "done",
      });
    });

    it("lignes de budget d'un classeur LibreOffice", () => {
      expect(fields("libreoffice.xlsx", "budget_lines")).toEqual({
        Poste: "slotLabel",
        Prestataire: "vendorName",
        Prévu: "plannedAmount",
        Réel: "actualAmount",
      });
    });

    it("catalogue en texte Unicode d'Excel", () => {
      expect(fields("excel-unicode-text.txt", "catalog_items")).toEqual({
        Intitulé: "label",
        Unité: "unit",
        "Prix HT": "unitPrice",
        TVA: "vatRate",
      });
    });

    it("chaque champ n'est proposé qu'une fois", () => {
      const proposals = Object.values(propose("excel-fr-windows1252.csv", "events"));
      const keys = proposals.map((proposal) => proposal.fieldKey).filter((key) => key !== null);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe("Une colonne à faible confiance n'est jamais proposée comme sûre", () => {
    it("un intitulé seulement proche (« Montant » pour le prix HT) reste sous le seuil", () => {
      const proposal = propose("formules.csv", "catalog_items").Montant;
      expect(proposal?.fieldKey).toBe("unitPrice");
      expect(proposal?.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    });

    it("sans intitulé, une colonne de dates est suggérée par son contenu, sous le seuil", () => {
      const [dateColumn, other] = proposeMapping({
        headers: ["", ""],
        rows: [
          ["12/06/2027", "Élodie"],
          ["03/09/2027", "Inès"],
        ],
        fields: IMPORT_FIELDS.events,
        synonyms,
      });
      expect(dateColumn).toMatchObject({ fieldKey: "eventDate" });
      expect(dateColumn?.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
      expect(other?.fieldKey).toBeNull();
    });

    it("un contenu contraire affaiblit la proposition (« Date » pleine de texte)", () => {
      const [column] = proposeMapping({
        headers: ["Date"],
        rows: [["à définir"], ["bientôt"], ["printemps"]],
        fields: IMPORT_FIELDS.events,
        synonyms,
      });
      expect(column?.confidence ?? 0).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    });

    it("une colonne d'e-mails n'est jamais proposée comme un nom", () => {
      const [column] = proposeMapping({
        headers: ["Nom"],
        rows: [["a@example.org"], ["b@example.org"]],
        fields: IMPORT_FIELDS.events,
        synonyms,
      });
      expect(column?.confidence ?? 0).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    });
  });

  it("les intitulés se comparent sans accents, casse ni ponctuation", () => {
    expect(normalizeLabel("Prénom_Mariée")).toEqual(["prenom", "mariee"]);
    expect(normalizeLabel("clients.1.firstName")).toEqual(["client", "1", "first", "name"]);
    expect(normalizeLabel("  DATE DU MARIAGE ")).toEqual(["date", "du", "mariage"]);
  });

  it("chaque champ importable a des synonymes en français et en anglais", () => {
    for (const fieldsOfType of Object.values(IMPORT_FIELDS)) {
      for (const field of fieldsOfType) expect(synonyms[field.key]?.length ?? 0).toBeGreaterThan(1);
    }
  });

  it("chaque valeur d'un champ à choix a des synonymes", () => {
    const { choices } = starterImportSynonyms();
    for (const fieldsOfType of Object.values(IMPORT_FIELDS)) {
      for (const field of fieldsOfType) {
        for (const choice of field.choices ?? []) expect(choices[field.key]?.[choice]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
