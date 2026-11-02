// IMP-04 — rapport des écarts contre un vrai PostgreSQL : colonnes sans
// équivalent gardées en champ libre ou ignorées (sans perdre les
// rapprochements), lignes rejetées avec leur motif, lignes exportables pour
// correction ; isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createProspect, createProspectSource } from "@/modules/events/service";
import {
  decideFreeColumns,
  getImportColumns,
  getImportWorkingSet,
  saveImportMapping,
  startImport,
  type ImportEntityType,
} from "@/modules/hub/service";
import { getImportGapsView, getRejectedRowsForExport } from "./gaps";
import { getImportMatchesView } from "./matching";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, {
    organizationId: organization.id,
    email: `planner-${randomUUID()}@symbola.test`,
    password: "mot-de-passe",
    role: "owner",
  });
  const source = await createProspectSource(organization.id, "Instagram");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function importWithColumns(planner: Planner, entityType: ImportEntityType, csv: string) {
  const started = await startImport(db, {
    organizationId: planner.organizationId,
    userId: planner.userId,
    entityType,
    fileName: "mariages.csv",
    bytes: new TextEncoder().encode(csv),
  });
  if (started.status !== "started") throw new Error(`import refusé : ${JSON.stringify(started)}`);
  const view = await getImportColumns(db, planner.organizationId, started.importId);
  const saved = await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })),
  });
  if (saved.status !== "saved") throw new Error(`colonnes refusées : ${JSON.stringify(saved)}`);
  return started.importId;
}

describe("IMP-04 — Rapport des écarts", () => {
  it("Le rapport liste les colonnes sans équivalent ; pour chacune, elle choisit : garder en champ libre, ou ignorer", async () => {
    const planner = await createPlanner();
    const importId = await importWithColumns(
      planner,
      "events",
      "Prénom mariée;Date du mariage;E-mail;Budget\nÉlodie;12/06/2027;elodie@example.org;25 000\nInès;03/09/2027;ines@example.org;18 500\n",
    );

    const view = await getImportGapsView(planner.organizationId, importId);
    expect(view?.columns).toEqual([
      { columnIndex: 2, header: "E-mail", samples: ["elodie@example.org", "ines@example.org"], decision: "undecided" },
      { columnIndex: 3, header: "Budget", samples: ["25 000", "18 500"], decision: "undecided" },
    ]);
    // Le rapport a calculé les rapprochements ; décider des colonnes les garde.
    expect((await getImportWorkingSet(db, planner.organizationId, importId))?.matching).not.toBeNull();

    expect(
      await decideFreeColumns(db, {
        organizationId: planner.organizationId,
        importId,
        decisions: [
          { columnIndex: 2, keep: true },
          { columnIndex: 3, keep: false },
          // Une colonne associée à un champ n'est pas concernée.
          { columnIndex: 0, keep: false },
        ],
      }),
    ).toBe(true);

    const after = await getImportGapsView(planner.organizationId, importId);
    expect(after?.columns.map((column) => [column.header, column.decision])).toEqual([
      ["E-mail", "keep"],
      ["Budget", "ignore"],
    ]);
    const set = await getImportWorkingSet(db, planner.organizationId, importId);
    expect(set?.mapping[0]).toMatchObject({ target: "field", fieldKey: "client1FirstName" });
    expect(set?.matching).not.toBeNull();

    // Une décision se change tant que l'import n'est pas confirmé.
    await decideFreeColumns(db, { organizationId: planner.organizationId, importId, decisions: [{ columnIndex: 3, keep: true }] });
    expect((await getImportGapsView(planner.organizationId, importId))?.columns[1]?.decision).toBe("keep");

    // Les champs associés restent lus normalement.
    const matches = await getImportMatchesView(planner.organizationId, importId);
    expect(matches?.rows[0]?.values).toMatchObject({ client1FirstName: "Élodie", eventDate: "2027-06-12" });
  });

  it("Il liste les lignes rejetées avec leur motif (date invalide, champ obligatoire manquant, événement introuvable)", async () => {
    const planner = await createPlanner();
    await createProspect({
      organizationId: planner.organizationId,
      createdByUserId: planner.userId,
      prospectSourceId: planner.sourceId,
      clients: [{ firstName: "Élodie", lastName: "Durand" }],
      eventDate: "2027-06-12",
    });
    const importId = await importWithColumns(
      planner,
      "tasks",
      "Date du mariage;Prénom client 1;Nom client 1;Tâche;Échéance\n" +
        "12/06/2027;Élodie;Durand;Réserver le traiteur;15/01/2027\n" +
        "12/06/2027;Élodie;Durand;Fleurs;31/02/2027\n" +
        "12/06/2027;Élodie;Durand;;01/03/2027\n" +
        "01/01/2028;Personne;Inconnue;Salle;01/02/2027\n",
    );

    const view = await getImportGapsView(planner.organizationId, importId);
    expect(view?.rowCount).toBe(4);
    expect(view?.rejected).toEqual([
      { rowIndex: 1, lineNumber: 3, reasons: [{ fieldKey: "dueDate", code: "invalid_date", value: "31/02/2027" }] },
      { rowIndex: 2, lineNumber: 4, reasons: [{ fieldKey: "label", code: "required_missing", value: "" }] },
      { rowIndex: 3, lineNumber: 5, reasons: [{ code: "event_not_found", fieldKey: null, value: "" }] },
    ]);

    // Ce rapport se télécharge en CSV pour corriger et réimporter : les lignes
    // rejetées gardent leurs colonnes d'origine.
    const exported = await getRejectedRowsForExport(planner.organizationId, importId);
    expect(exported?.headers).toEqual(["Date du mariage", "Prénom client 1", "Nom client 1", "Tâche", "Échéance"]);
    expect(exported?.rows.map((row) => row.cells)).toEqual([
      ["12/06/2027", "Élodie", "Durand", "Fleurs", "31/02/2027"],
      ["12/06/2027", "Élodie", "Durand", "", "01/03/2027"],
      ["01/01/2028", "Personne", "Inconnue", "Salle", "01/02/2027"],
    ]);
  });
});

describe("IMP-04 — Isolation du rapport des écarts", () => {
  it("organisation A ne lit pas le rapport de B et ne décide pas de ses colonnes", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const importId = await importWithColumns(plannerB, "events", "Prénom mariée;E-mail\nÉlodie;elodie@example.org\n");

    expect(await getImportGapsView(plannerA.organizationId, importId)).toBeNull();
    expect(await getRejectedRowsForExport(plannerA.organizationId, importId)).toBeNull();
    expect(await decideFreeColumns(db, { organizationId: plannerA.organizationId, importId, decisions: [{ columnIndex: 1, keep: true }] })).toBe(false);
    expect((await getImportGapsView(plannerB.organizationId, importId))?.columns[0]?.decision).toBe("undecided");
  });
});
