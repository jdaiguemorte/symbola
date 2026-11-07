// Lot 14c (IMP-08) — import d'événements depuis des fiches PDF d'un logiciel
// de planification tiers, contre de vrais modules (PostgreSQL réel) : dépôt de
// plusieurs fiches, fiche refusée sans bloquer les autres, valeurs reprises
// (mariés et coordonnées, date, lieux et programme, budget souhaité, champs
// importés), statut proposé et modifiable, rapprochements et doublons,
// confirmation, annulation ; isolation A/B. Fiches entièrement fictives.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { createProspect, createProspectSource, getEvent, getEventProgram, listEventPlaces, listEvents } from "@/modules/events/service";
import { getImportColumns, getPlatformSettings, setPlatformSettings, startEventSheetsImport } from "@/modules/hub/service";
import { confirmImport, getImportPreview, undoImport } from "./apply";
import { getImportGapsView } from "./gaps";
import { decideMatches, getImportMatchesView, setEventSheetStatuses } from "./matching";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

// Date fixée : les fiches du corpus sont en 2027 et 2028.
const NOW = new Date("2026-11-07T10:00:00Z");

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Outil actuel");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

const sheet = (name: string) => ({ fileName: name, bytes: readImportCorpusFile(`logiciel-tiers/${name}`) });

async function startSheets(planner: Planner, files: { fileName: string; bytes: Uint8Array }[], now = NOW) {
  const started = await startEventSheetsImport(db, { organizationId: planner.organizationId, userId: planner.userId, files, now });
  if (started.status !== "started") throw new Error(`import refusé : ${JSON.stringify(started)}`);
  return started.importId;
}

const ALL = ["fiche-evenement-complete.pdf", "fiche-evenement-minimale.pdf", "fiche-evenement-trois-lieux.pdf"];

describe("IMP-08 — Importer ses événements depuis les fiches PDF", () => {
  it("quand elle dépose plusieurs fiches, chaque fiche devient une ligne et les colonnes sont déjà reconnues", async () => {
    const planner = await createPlanner();
    const importId = await startSheets(planner, ALL.map(sheet));
    const columns = await getImportColumns(db, planner.organizationId, importId);
    expect(columns!.columns.every((column) => column.saved !== null)).toBe(true);
    const matches = await getImportMatchesView(planner.organizationId, importId);
    expect(matches!.rows.map((row) => row.values.client1FirstName)).toEqual(["Léa", "Inès", expect.any(String)]);
    expect(matches!.rows.every((row) => row.errors.length === 0)).toBe(true);
  });

  it("au-delà du nombre de fiches réglé par l'Admin, le dépôt est refusé", async () => {
    const planner = await createPlanner();
    const settings = await getPlatformSettings(db);
    await setPlatformSettings(db, { adminUserId: planner.userId, ...settings, importMaxSheets: 2 });
    try {
      expect(await startEventSheetsImport(db, { ...planner, files: ALL.map(sheet), now: NOW })).toEqual({ status: "rejected", reason: "too_many_files" });
    } finally {
      await setPlatformSettings(db, { adminUserId: planner.userId, ...settings });
    }
  });

  it("étant donné une fiche illisible ou qui n'est pas une fiche événement, elle est rejetée avec un motif sans bloquer les autres", async () => {
    const planner = await createPlanner();
    const importId = await startSheets(planner, [
      sheet("fiche-evenement-complete.pdf"),
      { fileName: "notes.pdf", bytes: new TextEncoder().encode("Nom;Ville\nA;B") },
      { fileName: "facture.pdf", bytes: readImportCorpusFile("logiciel-tiers/prestataires.xlsx") },
    ]);
    const gaps = await getImportGapsView(planner.organizationId, importId);
    expect(gaps!.rejected.map((row) => ({ line: row.lineNumber, reasons: row.reasons.map((reason) => `${reason.code}:${reason.value}`) }))).toEqual([
      { line: 2, reasons: ["sheet_rejected:not_pdf"] },
      { line: 3, reasons: ["sheet_rejected:not_pdf"] },
    ]);
    const preview = await getImportPreview(planner.organizationId, importId);
    expect(preview).toMatchObject({ counts: { creations: 1, updates: 0 }, rejectedCount: 2 });
  });

  it("à la confirmation : mariés et coordonnées, date, lieux (le premier en lieu de réception) et programme avec leurs heures, budget souhaité ; payé, solde et note en champs importés", async () => {
    const planner = await createPlanner();
    const importId = await startSheets(planner, [sheet("fiche-evenement-complete.pdf")]);
    const result = await confirmImport({ ...planner, importId, defaultProspectSourceId: planner.sourceId });
    expect(result).toEqual({ status: "applied", result: { created: 1, updated: 0, unchanged: 0, rejected: 0 } });

    const [summary] = await listEvents({ organizationId: planner.organizationId });
    const event = (await getEvent(planner.organizationId, summary!.id))!;
    expect(event).toMatchObject({ eventDate: "2027-06-12", venueName: "Domaine des Tilleuls", status: "confirmed", wantedBudgetCents: 2_500_000, prospectSourceId: planner.sourceId });
    expect(event.clients).toMatchObject([
      { firstName: "Léa", lastName: "MARTIN", email: "lea.martin@example.org", phone: "06 39 98 01 01", addressLine: "12 rue des Lilas", postalCode: "86000", city: "POITIERS" },
      { firstName: "Hugo", lastName: "BERNARD", email: "hugo.bernard@example.org", phone: null, city: "POITIERS" },
    ]);
    expect((await listEventPlaces(planner.organizationId, event.id)).map((place) => place.label)).toEqual(["Domaine des Tilleuls", "Église Saint-Exemple de Villefictive"]);
    expect((await getEventProgram(planner.organizationId, event.id)).items.map((item) => `${item.startTime.slice(0, 5)} ${item.label}`)).toEqual([
      "14:30 Domaine des Tilleuls",
      "16:00 Église Saint-Exemple de Villefictive",
    ]);
    expect(event.importedFields).toMatchObject({ Note: "Cérémonie laïque", "Total Payé": "3200,00 €", Solde: "18450,50 €", Total: "21650,50 €" });
  });

  it("décision J : confirmé (date à venir et lieu), réalisé (date passée) ; la planner change le statut d'une ligne dans l'aperçu", async () => {
    const planner = await createPlanner();
    // Le 1er juillet 2027, la fiche du 12 juin 2027 est passée.
    const importId = await startSheets(planner, ALL.map(sheet), new Date("2027-07-01T08:00:00Z"));
    let preview = await getImportPreview(planner.organizationId, importId);
    expect(preview!.creations.map((row) => row.values.status)).toEqual(["done", "confirmed", "confirmed"]);

    const third = preview!.creations[2]!;
    expect(await setEventSheetStatuses(planner.organizationId, importId, [{ rowIndex: third.rowIndex, status: "prospect" }])).toBe(true);
    expect(await setEventSheetStatuses(planner.organizationId, importId, [{ rowIndex: third.rowIndex, status: "inconnu" }])).toBe(false);
    preview = await getImportPreview(planner.organizationId, importId);
    expect(preview!.creations.map((row) => row.values.status)).toEqual(["done", "confirmed", "prospect"]);

    await confirmImport({ ...planner, importId, defaultProspectSourceId: planner.sourceId });
    const statuses = (await listEvents({ organizationId: planner.organizationId })).map((event) => `${event.eventDate} ${event.status}`).sort();
    expect(statuses).toEqual(["2027-06-12 done", "2027-09-03 confirmed", "2028-12-09 prospect"]);
  });

  it("rapprochements : un événement déjà présent (mêmes mariés, même date) est proposé en mise à jour ; deux fiches du même lot pour le même événement sont signalées", async () => {
    const planner = await createPlanner();
    const { id: existing } = await createProspect({
      organizationId: planner.organizationId,
      createdByUserId: planner.userId,
      prospectSourceId: planner.sourceId,
      clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }],
      eventDate: "2027-06-12",
    });
    const importId = await startSheets(planner, [sheet("fiche-evenement-complete.pdf"), sheet("fiche-evenement-minimale.pdf"), { ...sheet("fiche-evenement-complete.pdf"), fileName: "copie.pdf" }]);
    const matches = await getImportMatchesView(planner.organizationId, importId);
    expect(matches!.rows[0]!.match).toMatchObject({ candidateId: existing, status: "proposed" });
    expect(matches!.rows[2]!.sameAsLine).toBe(1);
    expect(matches!.rows[1]!.sameAsLine).toBeUndefined();

    await decideMatches(planner.organizationId, importId, [{ rowIndex: 0, decision: "accept" }, { rowIndex: 2, decision: "accept" }]);
    await confirmImport({ ...planner, importId, defaultProspectSourceId: planner.sourceId });
    const event = (await getEvent(planner.organizationId, existing))!;
    expect(event.clients[0]).toMatchObject({ firstName: "Léa", email: "lea.martin@example.org" });
    expect(event.wantedBudgetCents).toBe(2_500_000);
    expect((await listEventPlaces(planner.organizationId, existing)).map((place) => place.label)).toEqual(["Domaine des Tilleuls", "Église Saint-Exemple de Villefictive"]);
    expect(await listEvents({ organizationId: planner.organizationId })).toHaveLength(2);
  });

  it("l'import est annulable : événements créés supprimés avec leurs lieux et leur programme, événement mis à jour remis à ses valeurs", async () => {
    const planner = await createPlanner();
    const { id: existing } = await createProspect({
      organizationId: planner.organizationId,
      createdByUserId: planner.userId,
      prospectSourceId: planner.sourceId,
      clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }],
      eventDate: "2027-06-12",
    });
    const importId = await startSheets(planner, ALL.map(sheet));
    // Les rapprochements sont calculés à l'ouverture de l'étape.
    expect((await getImportMatchesView(planner.organizationId, importId))!.rows[0]!.match?.candidateId).toBe(existing);
    await decideMatches(planner.organizationId, importId, [{ rowIndex: 0, decision: "accept" }]);
    expect(await confirmImport({ ...planner, importId, defaultProspectSourceId: planner.sourceId })).toEqual({ status: "applied", result: expect.anything() });
    expect(await listEvents({ organizationId: planner.organizationId })).toHaveLength(3);

    const undo = await undoImport({ ...planner, importId });
    expect(undo).toMatchObject({ status: "done", outcomes: { undone: 3, kept_modified: 0 } });
    expect((await listEvents({ organizationId: planner.organizationId })).map((event) => event.id)).toEqual([existing]);
    const event = (await getEvent(planner.organizationId, existing))!;
    expect(event).toMatchObject({ wantedBudgetCents: null, venueName: null });
    expect(event.clients[0]).toMatchObject({ lastName: "Martin", email: null });
    expect(await listEventPlaces(planner.organizationId, existing)).toEqual([]);
    expect((await getEventProgram(planner.organizationId, existing)).items).toEqual([]);
  });

  it("isolation : aucun rapprochement avec un événement d'une autre organisation ; l'import de A est invisible pour B", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    await createProspect({
      organizationId: b.organizationId,
      createdByUserId: b.userId,
      prospectSourceId: b.sourceId,
      clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }],
      eventDate: "2027-06-12",
    });
    const importId = await startSheets(a, [sheet("fiche-evenement-complete.pdf")]);
    const matches = await getImportMatchesView(a.organizationId, importId);
    expect(matches!.rows[0]!.match).toBeNull();
    expect(await getImportMatchesView(b.organizationId, importId)).toBeNull();
    expect(await setEventSheetStatuses(b.organizationId, importId, [{ rowIndex: 0, status: "prospect" }])).toBe(false);
    await confirmImport({ ...a, importId, defaultProspectSourceId: a.sourceId });
    expect(await listEvents({ organizationId: b.organizationId })).toHaveLength(1);
  });
});
