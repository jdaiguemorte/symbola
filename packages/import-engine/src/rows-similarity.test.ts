import { IMPORT_FIELDS } from "@symbola/contracts";
import { starterImportSynonyms } from "@symbola/starter-templates";
import { describe, expect, it } from "vitest";
import { parseImportRows } from "./rows";
import { bestMatch, clientsSimilarity, eventSimilarity, labelSimilarity, textSimilarity } from "./similarity";

const synonyms = starterImportSynonyms();

describe("IMP-03 — Lecture des lignes selon les colonnes validées", () => {
  it("chaque valeur prend le type de son champ ; les colonnes sans équivalent deviennent des champs libres", () => {
    const [row] = parseImportRows({
      headers: ["Tâche", "Échéance", "Qui", "Faite", "Remarque", "Ignorée"],
      rows: [["Réserver le traiteur", "15/01/2027", "Mariés", "oui", "appeler avant midi", "x"]],
      sourceLineNumbers: [4],
      assignments: [
        { columnIndex: 0, fieldKey: "label", target: "field" },
        { columnIndex: 1, fieldKey: "dueDate", target: "field" },
        { columnIndex: 2, fieldKey: "responsible", target: "field" },
        { columnIndex: 3, fieldKey: "done", target: "field" },
        { columnIndex: 4, fieldKey: null, target: "none" },
        { columnIndex: 5, fieldKey: null, target: "ignore" },
      ],
      fields: IMPORT_FIELDS.tasks,
      synonyms,
    });
    expect(row).toEqual({
      rowIndex: 0,
      lineNumber: 4,
      values: { label: "Réserver le traiteur", dueDate: "2027-01-15", responsible: "clients", done: true },
      extra: { Remarque: "appeler avant midi" },
      errors: [],
    });
  });

  it("montants en centimes, taux en points de base, statut reconnu par ses synonymes", () => {
    const rows = parseImportRows({
      headers: ["Article", "Unité", "Prix", "TVA"],
      rows: [
        ["Coordination", "forfait", "1 500,00", "20 %"],
        ["Heure", "heure", "75,5", "5,5"],
      ],
      sourceLineNumbers: [2, 3],
      assignments: [
        { columnIndex: 0, fieldKey: "label", target: "field" },
        { columnIndex: 1, fieldKey: "unit", target: "field" },
        { columnIndex: 2, fieldKey: "unitPrice", target: "field" },
        { columnIndex: 3, fieldKey: "vatRate", target: "field" },
      ],
      fields: IMPORT_FIELDS.catalog_items,
      synonyms,
    });
    expect(rows.map((row) => row.values)).toEqual([
      { label: "Coordination", unit: "forfait", unitPrice: 150000, vatRate: 2000 },
      { label: "Heure", unit: "heure", unitPrice: 7550, vatRate: 550 },
    ]);

    const [event] = parseImportRows({
      headers: ["Prénom", "Statut"],
      rows: [["Élodie", "Signé"]],
      sourceLineNumbers: [2],
      assignments: [
        { columnIndex: 0, fieldKey: "client1FirstName", target: "field" },
        { columnIndex: 1, fieldKey: "status", target: "field" },
      ],
      fields: IMPORT_FIELDS.events,
      synonyms,
    });
    expect(event?.values.status).toBe("confirmed");
  });

  it("une valeur invalide ou un champ obligatoire vide donne un motif de rejet", () => {
    const rows = parseImportRows({
      headers: ["Tâche", "Échéance", "Faite"],
      rows: [
        ["", "31/02/2027", "peut-être"],
        ["Fleurs", "", ""],
      ],
      sourceLineNumbers: [2, 3],
      assignments: [
        { columnIndex: 0, fieldKey: "label", target: "field" },
        { columnIndex: 1, fieldKey: "dueDate", target: "field" },
        { columnIndex: 2, fieldKey: "done", target: "field" },
      ],
      fields: IMPORT_FIELDS.tasks,
      synonyms,
    });
    expect(rows[0]?.errors).toEqual([
      { fieldKey: "dueDate", code: "invalid_date", value: "31/02/2027" },
      { fieldKey: "done", code: "invalid_boolean", value: "peut-être" },
      { fieldKey: "label", code: "required_missing", value: "" },
    ]);
    expect(rows[1]?.errors).toEqual([{ fieldKey: "dueDate", code: "required_missing", value: "" }]);
  });

  it("le format jour/mois d'une colonne de dates s'applique à toutes ses lignes", () => {
    const rows = parseImportRows({
      headers: ["Date", "Prénom"],
      rows: [
        ["05/06/2027", "A"],
        ["12/25/2027", "B"],
      ],
      sourceLineNumbers: [2, 3],
      assignments: [
        { columnIndex: 0, fieldKey: "eventDate", target: "field" },
        { columnIndex: 1, fieldKey: "client1FirstName", target: "field" },
      ],
      fields: IMPORT_FIELDS.events,
      synonyms,
    });
    expect(rows.map((row) => row.values.eventDate)).toEqual(["2027-05-06", "2027-12-25"]);
  });
});

describe("IMP-03 — Niveau de ressemblance", () => {
  it("textes identiques une fois normalisés, fautes de frappe tolérées", () => {
    expect(textSimilarity("Élodie DURAND", "elodie durand")).toBe(1);
    expect(textSimilarity("Elodie Durand", "Elodie Durant")).toBeGreaterThan(0.8);
    expect(textSimilarity("Traiteur", "Photographe")).toBeLessThan(0.3);
    expect(textSimilarity("", "Traiteur")).toBe(0);
  });

  it("clients comparés sans tenir compte de leur ordre", () => {
    const row = [
      { firstName: "Mathéo", lastName: "Lefèvre" },
      { firstName: "Élodie", lastName: "Durand" },
    ];
    const candidate = [
      { firstName: "Elodie", lastName: "Durand" },
      { firstName: "Matheo", lastName: "Lefevre" },
    ];
    expect(clientsSimilarity(row, candidate)).toBe(1);
    // Nom absent d'un côté : le prénom suffit.
    expect(clientsSimilarity([{ firstName: "Élodie", lastName: null }], [{ firstName: "Elodie", lastName: "Durand" }])).toBe(1);
  });

  it("Étant donné mêmes clients et même date, alors la ressemblance est maximale ; une autre date l'écarte", () => {
    const clients = [{ firstName: "Élodie", lastName: "Durand" }];
    expect(eventSimilarity({ eventDate: "2027-06-12", clients }, { eventDate: "2027-06-12", clients })).toBe(100);
    expect(eventSimilarity({ eventDate: null, clients }, { eventDate: "2027-06-12", clients })).toBe(80);
    expect(eventSimilarity({ eventDate: "2027-06-13", clients }, { eventDate: "2027-06-12", clients })).toBeLessThan(60);
    expect(
      eventSimilarity({ eventDate: "2027-06-12", clients }, { eventDate: "2027-06-12", clients: [{ firstName: "Inès", lastName: "Moreau" }] }),
    ).toBeLessThan(60);
  });

  it("meilleur élément au-dessus du seuil, sinon aucun", () => {
    const candidates = [
      { id: "a", value: "Traiteur" },
      { id: "b", value: "Photographe" },
    ];
    expect(bestMatch("traiteur", candidates, labelSimilarity)).toEqual({ id: "a", score: 100 });
    expect(bestMatch("Fleuriste", candidates, labelSimilarity)).toBeNull();
  });
});
