// IMP-05 — aperçu, confirmation et annulation d'un import contre de vrais
// modules (PostgreSQL réel) : créations et mises à jour, tout ou rien,
// journal, annulation (créés supprimés, mis à jour restaurés), élément
// modifié à la main signalé et gardé sans confirmation ; isolation.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { events } from "@symbola/db/schema/events";
import { importItems } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { and, eq } from "drizzle-orm";
import { listBudgetLines, updateBudgetLine } from "@/modules/budget/service";
import {
  addEventVendorSlot,
  createProspect,
  createProspectSource,
  getEvent,
  importTaskRows,
  listEvents,
  listEventTasks,
  listEventVendorSlots,
  listProspectSources,
  updateEventTask,
  listVendorCandidates,
} from "@/modules/events/service";
import {
  getAppliedImport,
  getImportColumns,
  getImportDraft,
  getPlatformSettings,
  listImports,
  saveImportMapping,
  saveOnboardingStep,
  setPlatformSettings,
  startImport,
  type ImportEntityType,
} from "@/modules/hub/service";
import { createCatalogItem, listCatalogItems } from "@/modules/quotes/service";
import { confirmImport, getImportPreview, getUndoPreview, undoImport } from "./apply";
import { decideMatches, getImportMatchesView } from "./matching";

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

async function createEvent(planner: Planner, eventDate: string, clients: { firstName: string; lastName: string }[]) {
  const { id } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: planner.sourceId,
    clients,
    eventDate,
    venueName: "Salle des fêtes",
  });
  return id;
}

// Import jusqu'à l'aperçu : colonnes proposées acceptées, colonnes sans
// équivalent gardées en champ libre, rapprochements proposés acceptés.
async function preparedImport(planner: Planner, entityType: ImportEntityType, csv: string) {
  const started = await startImport(db, {
    organizationId: planner.organizationId,
    userId: planner.userId,
    entityType,
    fileName: "import.csv",
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
  const { decideFreeColumns } = await import("@/modules/hub/service");
  await decideFreeColumns(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    decisions: view!.columns.filter((column) => !column.proposedFieldKey).map((column) => ({ columnIndex: column.columnIndex, keep: true })),
  });
  return started.importId;
}

async function acceptAllMatches(planner: Planner, importId: string) {
  const matches = await getImportMatchesView(planner.organizationId, importId);
  const proposed = matches!.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const }));
  if (proposed.length > 0) await decideMatches(planner.organizationId, importId, proposed);
}

describe("IMP-05 — Aperçu et annulation", () => {
  it("Avant confirmation, elle voit le résultat : X créations, Y mises à jour, Z lignes rejetées, avec un échantillon", async () => {
    const planner = await createPlanner();
    const existing = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const importId = await preparedImport(
      planner,
      "events",
      "Prénom mariée;Nom mariée;Date du mariage;Lieu;Source\n" +
        "Élodie;Durand;12/06/2027;Château de Vaux;\n" +
        "Inès;Moreau;03/09/2027;Domaine des Œillets;Mariages.net\n" +
        "Chloé;Petit;20/08/2027;;Instagram\n" +
        "Léa;Martin;31/02/2027;;\n",
    );

    // Un rapprochement proposé et pas encore décidé bloque la confirmation.
    const blocked = await getImportPreview(planner.organizationId, importId);
    expect(blocked?.blockers).toEqual(["matches_undecided"]);
    expect(await confirmImport({ ...planner, importId, defaultProspectSourceId: planner.sourceId })).toEqual({
      status: "blocked",
      blockers: ["matches_undecided"],
    });

    await acceptAllMatches(planner, importId);
    const preview = await getImportPreview(planner.organizationId, importId);
    expect(preview).toMatchObject({ counts: { creations: 2, updates: 1 }, rejectedCount: 1, blockers: [] });
    expect(preview?.updates[0]?.match?.candidateId).toBe(existing);
    expect(preview?.creations.map((row) => row.values.client1FirstName)).toEqual(["Inès", "Chloé"]);
    expect(preview?.prospectSources.map((source) => source.label)).toEqual(["Instagram"]);
  });

  it("La confirmation écrit les créations et les mises à jour, et journalise l'import (fichier, auteur, date, résultat)", async () => {
    const planner = await createPlanner();
    const existing = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const other = await createProspectSource(planner.organizationId, "Salon du mariage");
    const importId = await preparedImport(
      planner,
      "events",
      "Prénom mariée;Nom mariée;Date du mariage;Lieu;Source;Statut;E-mail\n" +
        "Élodie;Durand;12/06/2027;Château de Vaux;;;elodie@example.org\n" +
        "Inès;Moreau;03/09/2027;;Mariages.net;Signé;\n" +
        "Chloé;Petit;20/08/2027;;;Perdu;\n",
    );
    await acceptAllMatches(planner, importId);

    expect(await confirmImport({ ...planner, importId, defaultProspectSourceId: randomUUID() })).toEqual({ status: "invalid_default_source" });
    const confirmed = await confirmImport({ ...planner, importId, defaultProspectSourceId: other.id });
    expect(confirmed).toEqual({ status: "applied", result: { created: 2, updated: 1, unchanged: 0, rejected: 0 } });

    // Mise à jour : seules les cellules remplies remplacent, le champ libre s'ajoute.
    const updated = await getEvent(planner.organizationId, existing);
    expect(updated).toMatchObject({ eventDate: "2027-06-12", venueName: "Château de Vaux", prospectSourceId: planner.sourceId });
    const all = await listEvents({ organizationId: planner.organizationId });
    const ines = all.find((event) => event.clients[0]?.firstName === "Inès");
    const chloe = all.find((event) => event.clients[0]?.firstName === "Chloé");
    expect(ines?.status).toBe("confirmed");
    // « Perdu » accepté sans motif (décision de Julien, lot 5).
    expect(chloe?.status).toBe("lost");
    // Source inconnue créée ; ligne sans source : source par défaut.
    const sources = await listProspectSources(planner.organizationId);
    const created = sources.find((source) => source.label === "Mariages.net");
    expect(created).toBeTruthy();
    expect((await getEvent(planner.organizationId, ines!.id))?.prospectSourceId).toBe(created!.id);
    expect((await getEvent(planner.organizationId, chloe!.id))?.prospectSourceId).toBe(other.id);
    // PRD-EVT-03 : postes par défaut copiés comme pour une création à la main.
    const [eventRow] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(events).where(eq(events.id, existing)));
    expect(eventRow?.importedFields).toEqual({ "E-mail": "elodie@example.org" });

    const journal = await listImports(db, planner.organizationId);
    expect(journal[0]).toMatchObject({ id: importId, status: "applied", fileName: "import.csv", createdByUserId: planner.userId, result: { created: 2, updated: 1 } });
    expect(journal[0]?.appliedAt).toBeInstanceOf(Date);
    // Les lignes du fichier ne sont plus gardées ; l'import n'est plus en cours.
    expect(await getImportDraft(db, planner.organizationId, importId)).toBeNull();
    expect(await confirmImport({ ...planner, importId, defaultProspectSourceId: other.id })).toEqual({ status: "not_found" });
  });

  it("La confirmation écrit tout ou rien : un échec n'écrit aucune ligne", async () => {
    const planner = await createPlanner();
    const eventId = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const row = (rowIndex: number, label: string, rowEventId: string) => ({
      rowIndex,
      values: { label, dueDate: "2027-01-15", responsible: null, done: null },
      importedFields: {},
      matchId: null,
      eventId: rowEventId,
    });
    // La seconde ligne vise un événement qui n'existe pas (supprimé entre
    // l'aperçu et la confirmation) : la première n'est pas écrite non plus.
    await expect(
      importTaskRows({ organizationId: planner.organizationId, rows: [row(0, "Réserver le traiteur", eventId), row(1, "Fleurs", randomUUID())] }),
    ).rejects.toThrow();
    expect(await listEventTasks(planner.organizationId, eventId)).toEqual([]);
  });

  it("une ligne dont l'événement a disparu avant la confirmation est rejetée, les autres sont importées", async () => {
    const planner = await createPlanner();
    const first = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const second = await createEvent(planner, "2027-09-03", [{ firstName: "Inès", lastName: "Moreau" }]);
    const importId = await preparedImport(
      planner,
      "tasks",
      "Date du mariage;Prénom client 1;Nom client 1;Tâche;Échéance\n" +
        "12/06/2027;Élodie;Durand;Réserver le traiteur;15/01/2027\n" +
        "03/09/2027;Inès;Moreau;Envoyer les faire-part;01/03/2027\n",
    );
    await getImportMatchesView(planner.organizationId, importId);
    await withOrganization(db, planner.organizationId, (tx) => tx.update(events).set({ isDemo: true }).where(eq(events.id, second)));

    expect(await confirmImport({ ...planner, importId })).toEqual({ status: "applied", result: { created: 1, updated: 0, unchanged: 0, rejected: 1 } });
    expect((await listEventTasks(planner.organizationId, first)).map((task) => task.label)).toEqual(["Réserver le traiteur"]);
  });

  it("Quand elle annule un import confirmé, alors les éléments créés sont supprimés et les éléments mis à jour retrouvent leurs valeurs précédentes", async () => {
    const planner = await createPlanner();
    const existing = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const importId = await preparedImport(
      planner,
      "events",
      "Prénom mariée;Nom mariée;Date du mariage;Lieu;Source\nÉlodie;Durand;12/06/2027;Château de Vaux;\nInès;Moreau;03/09/2027;;Mariages.net\n",
    );
    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId, defaultProspectSourceId: planner.sourceId });
    expect(await listEvents({ organizationId: planner.organizationId })).toHaveLength(2);

    const preview = await getUndoPreview(planner.organizationId, importId);
    expect(preview?.undoable).toBe(true);
    expect(preview?.pendingItems.some((item) => item.modified)).toBe(false);

    expect(await undoImport({ ...planner, importId })).toEqual({ status: "done", outcomes: { undone: 3, kept_modified: 0, kept_in_use: 0, missing: 0 } });
    const remaining = await listEvents({ organizationId: planner.organizationId });
    expect(remaining.map((event) => event.id)).toEqual([existing]);
    expect((await getEvent(planner.organizationId, existing))?.venueName).toBe("Salle des fêtes");
    // La source créée par l'import, inutilisée, part avec lui.
    expect((await listProspectSources(planner.organizationId)).map((source) => source.label)).toEqual(["Instagram"]);
    expect((await listImports(db, planner.organizationId))[0]).toMatchObject({ status: "undone" });
    expect(await undoImport({ ...planner, importId })).toEqual({ status: "expired" });
  });

  it("Étant donné un élément modifié à la main depuis l'import, alors l'app le signale et ne l'écrase pas sans confirmation", async () => {
    const planner = await createPlanner();
    const eventId = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const importId = await preparedImport(
      planner,
      "tasks",
      "Date du mariage;Prénom client 1;Nom client 1;Tâche;Échéance\n" +
        "12/06/2027;Élodie;Durand;Réserver le traiteur;15/01/2027\n" +
        "12/06/2027;Élodie;Durand;Envoyer les faire-part;01/03/2027\n",
    );
    await getImportMatchesView(planner.organizationId, importId);
    await confirmImport({ ...planner, importId });
    const tasks = await listEventTasks(planner.organizationId, eventId);
    const caterer = tasks.find((task) => task.label === "Réserver le traiteur")!;
    await updateEventTask({ organizationId: planner.organizationId, taskId: caterer.id, done: true });

    const preview = await getUndoPreview(planner.organizationId, importId);
    const modified = preview!.pendingItems.filter((item) => item.modified);
    expect(modified.map((item) => item.elementId)).toEqual([caterer.id]);

    // Sans confirmation : la tâche modifiée reste, l'autre est supprimée.
    expect(await undoImport({ ...planner, importId })).toEqual({ status: "done", outcomes: { undone: 1, kept_modified: 1, kept_in_use: 0, missing: 0 } });
    expect((await listEventTasks(planner.organizationId, eventId)).map((task) => task.label)).toEqual(["Réserver le traiteur"]);
    expect((await listImports(db, planner.organizationId))[0]?.status).toBe("applied");

    // Avec confirmation : elle part aussi, l'import est annulé.
    const again = await getUndoPreview(planner.organizationId, importId);
    expect(again?.pendingItems).toHaveLength(1);
    expect(await undoImport({ ...planner, importId, forceItemIds: [again!.pendingItems[0]!.id] })).toEqual({
      status: "done",
      outcomes: { undone: 1, kept_modified: 0, kept_in_use: 0, missing: 0 },
    });
    expect(await listEventTasks(planner.organizationId, eventId)).toEqual([]);
    expect((await listImports(db, planner.organizationId))[0]?.status).toBe("undone");
  });

  it("lignes de budget : poste créé et montant écrit, puis annulation complète (historique compris)", async () => {
    const planner = await createPlanner();
    const eventId = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const caterer = await addEventVendorSlot(planner.organizationId, eventId, "Traiteur");
    await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: caterer.id, field: "estimated", amountCents: 800000, changedByUserId: planner.userId });
    const importId = await preparedImport(
      planner,
      "budget_lines",
      "Date du mariage;Prénom client 1;Nom client 1;Poste;Prestataire;Prévu;Réel\n" +
        "12/06/2027;Élodie;Durand;Traiteur;Saveurs & Co;8 500;8 720,40\n" +
        "12/06/2027;Élodie;Durand;Fleuriste;Pétales;1 200;\n",
    );
    await acceptAllMatches(planner, importId);
    // Lot 28b : la ligne du traiteur rattache « Saveurs & Co » au poste : elle compte comme une création.
    expect(await confirmImport({ ...planner, importId })).toMatchObject({ status: "applied", result: { created: 2, updated: 0 } });

    const lines = await listBudgetLines(planner.organizationId, eventId);
    expect(lines.lines.map((line) => [line.label, line.estimatedAmountCents, line.committedAmountCents])).toEqual(
      expect.arrayContaining([
        ["Traiteur", 850000, 872040],
        ["Fleuriste", 120000, null],
      ]),
    );
    // Lot 28b : le prestataire importé est rattaché au poste (retenu : la ligne a un réel) et lié à la ligne.
    // (« Pétales », sans montant réel, est seulement pressenti.)
    expect((await listVendorCandidates(planner.organizationId, eventId)).map((candidate) => [candidate.vendorName, candidate.status]).sort()).toEqual([
      ["Pétales", "shortlisted"],
      ["Saveurs & Co", "retained"],
    ]);
    expect((await listVendorCandidates(planner.organizationId, eventId)).find((candidate) => candidate.vendorName === "Saveurs & Co")?.vendorSlotId).toBe(caterer.id);
    expect(lines.lines.find((line) => line.label === "Traiteur")?.vendorName).toBe("Saveurs & Co");

    await undoImport({ ...planner, importId });
    const after = await listBudgetLines(planner.organizationId, eventId);
    expect(after.lines.map((line) => [line.label, line.estimatedAmountCents, line.committedAmountCents])).toEqual([["Traiteur", 800000, null]]);
    const slots = await listEventVendorSlots(planner.organizationId, eventId);
    expect(slots.some((slot) => slot.label === "Fleuriste")).toBe(false);
    expect(await listVendorCandidates(planner.organizationId, eventId)).toEqual([]);
  });

  it("lot 28a (BUD-01) — un import du budget fait avant le lot (prévu, réel) s'annule encore : ses montants deviennent l'estimé et l'engagé", async () => {
    const planner = await createPlanner();
    const eventId = await createEvent(planner, "2027-06-12", [{ firstName: "Élodie", lastName: "Durand" }]);
    const caterer = await addEventVendorSlot(planner.organizationId, eventId, "Traiteur");
    await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: caterer.id, field: "estimated", amountCents: 800000, changedByUserId: planner.userId });
    const importId = await preparedImport(
      planner,
      "budget_lines",
      "Date du mariage;Prénom client 1;Nom client 1;Poste;Prestataire;Prévu;Réel\n" + "12/06/2027;Élodie;Durand;Traiteur;Saveurs & Co;8 500;8 720,40\n",
    );
    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId });
    // La trace d'un import d'avant le lot porte les anciens noms.
    const OLD: Record<string, string> = { estimatedAmountCents: "plannedAmountCents", committedAmountCents: "actualAmountCents" };
    const legacy = (values: Record<string, unknown> | null) =>
      values === null ? null : Object.fromEntries(Object.entries(values).map(([key, value]) => [OLD[key] ?? key, value]));
    const renamed = await withOrganization(db, planner.organizationId, async (tx) => {
      const items = await tx.select().from(importItems).where(and(eq(importItems.importId, importId), eq(importItems.kind, "budget_line")));
      for (const item of items) {
        await tx.update(importItems).set({ previous: legacy(item.previous), written: legacy(item.written) }).where(eq(importItems.id, item.id));
      }
      return tx.select().from(importItems).where(and(eq(importItems.importId, importId), eq(importItems.kind, "budget_line")));
    });
    expect(renamed.map((item) => Object.keys(item.written ?? {}).sort())).toEqual([["actualAmountCents", "plannedAmountCents", "vendorCandidateId"]]);

    await undoImport({ ...planner, importId });
    const after = await listBudgetLines(planner.organizationId, eventId);
    expect(after.lines.map((line) => [line.label, line.estimatedAmountCents, line.committedAmountCents])).toEqual([["Traiteur", 800000, null]]);
  });

  it("catalogue : taux de TVA par défaut de l'organisation (franchise : 0), article mis à jour puis restauré", async () => {
    const planner = await createPlanner();
    await saveOnboardingStep(db, planner.organizationId, { vatRegime: "franchise" });
    const item = await createCatalogItem(planner.organizationId, { label: "Fleurs", unit: "bouquet", unitPriceCents: 8000, vatRateBasisPoints: 0 });
    const importId = await preparedImport(planner, "catalog_items", "Intitulé;Unité;Prix HT\nFleurs;bouquet;85\nAnimation DJ;soirée;950\n");
    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId });
    const catalog = await listCatalogItems(planner.organizationId);
    expect(catalog.map((entry) => [entry.label, entry.unitPriceCents, entry.vatRateBasisPoints])).toEqual(
      expect.arrayContaining([
        ["Fleurs", 8500, 0],
        ["Animation DJ", 95000, 0],
      ]),
    );
    await undoImport({ ...planner, importId });
    expect((await listCatalogItems(planner.organizationId)).map((entry) => [entry.id, entry.unitPriceCents])).toEqual([[item.id, 8000]]);
  });

  it("passé le délai réglé par l'Admin, un import confirmé n'est plus annulable", async () => {
    const planner = await createPlanner();
    const importId = await preparedImport(planner, "prospect_sources", "Source\nMariages.net\n");
    await confirmImport({ ...planner, importId });
    const before = await getPlatformSettings(db);
    const admin = await createUser(db, { organizationId: null, email: `admin-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "admin" });
    await setPlatformSettings(db, { ...before, adminUserId: admin.id, importUndoRetentionDays: 1 });
    try {
      const view = await getAppliedImport(db, planner.organizationId, importId, new Date(Date.now() + 2 * 86_400_000));
      expect(view).toMatchObject({ status: "applied", undoable: false });
    } finally {
      await setPlatformSettings(db, { ...before, adminUserId: admin.id });
    }
  });
});

describe("IMP-05 — Isolation", () => {
  it("organisation A ne prévisualise, ne confirme ni n'annule l'import de B", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const importId = await preparedImport(plannerB, "prospect_sources", "Source\nMariages.net\n");
    expect(await getImportPreview(plannerA.organizationId, importId)).toBeNull();
    expect(await confirmImport({ ...plannerA, importId })).toEqual({ status: "not_found" });
    expect(await confirmImport({ ...plannerB, importId })).toMatchObject({ status: "applied" });
    expect(await getUndoPreview(plannerA.organizationId, importId)).toBeNull();
    expect(await undoImport({ ...plannerA, importId })).toEqual({ status: "not_found" });
    expect((await listProspectSources(plannerB.organizationId)).map((source) => source.label)).toContain("Mariages.net");
  });
});
