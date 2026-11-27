// Lot 71b (HUB-14, PAR-01, UX-02 ; spécification du lot 71, § 5.2) — la page « Reprendre un mariage en
// cours » contre un vrai PostgreSQL : créer une reprise par sa première action, régler une ligne, la
// couvrir par le budget, saisir le mariage, retrouver un import laissé en plan, la fin et la deuxième
// reprise. Tests d'abus : la reprise d'une autre organisation répond comme une reprise inexistante, et
// ne reçoit aucun fichier ; une Planner restreinte ne voit pas celle d'un mariage hors de son équipe.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventStatusHistory, events as eventsTable } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { createProspect, createProspectSource, listEventTasks, startExampleEvent } from "@/modules/events/service";
import { getImportColumns, getTakeover, listImports, saveImportMapping, settleTakeoverStep, startImport } from "@/modules/hub/service";
import { confirmImport } from "@/lib/import/apply";
import { decideMatches, getImportMatchesView } from "@/lib/import/matching";
import {
  abandonTakeoverImport,
  enterTakeoverEvent,
  loadNewTakeoverPage,
  loadTakeoverPage,
  startTakeoverStep,
  takeoverForUpload,
  type TakeoverActor,
} from "./flow";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner(role: "owner" | "member" = "owner", organizationId?: string): Promise<TakeoverActor> {
  const orgId = organizationId ?? (await createOrganization(db, `Org ${randomUUID()}`)).id;
  const user = await createUser(db, { organizationId: orgId, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role });
  return { organizationId: orgId, userId: user.id, viewer: { userId: user.id, role, allPlannersSeeAll: true } };
}

const corpus = (name: string) => readImportCorpusFile(`tableur-planner/${name}`);

// Un fichier déposé depuis une ligne de la page : l'import part, rattaché à sa ligne (la route d'envoi).
async function dropFile(actor: TakeoverActor, takeoverId: string, kind: "vendor_book" | "budget" | "tasks", file: string) {
  const target = await takeoverForUpload(actor, takeoverId, kind);
  if (!target) throw new Error("reprise introuvable");
  const started = await startImport(db, { organizationId: actor.organizationId, userId: actor.userId, entityType: target.entityType, fileName: file, bytes: corpus(file), targetEventId: target.targetEventId });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  await target.attach(started.importId);
  return started.importId;
}

// Colonnes proposées (ou celles données), colonnes libres écartées, rapprochements acceptés.
async function saveProposedColumns(actor: TakeoverActor, importId: string, columns: Record<string, string | null> = {}) {
  const view = await getImportColumns(db, actor.organizationId, importId);
  const saved = await saveImportMapping(db, {
    organizationId: actor.organizationId,
    importId,
    choices: view!.columns.map((column) => {
      const forced = columns[column.header];
      return { columnIndex: column.columnIndex, target: forced === undefined ? (column.proposedFieldKey ?? "ignore") : (forced ?? "ignore"), confirmed: true };
    }),
  });
  if (saved.status !== "saved") throw new Error(JSON.stringify(saved));
  const matches = await getImportMatchesView(actor.organizationId, importId);
  const proposed = matches?.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const })) ?? [];
  if (proposed.length > 0) await decideMatches(actor.organizationId, importId, proposed);
}

const TASK_COLUMNS = { "Fait ?": "done", Quoi: "label", "Pour quand": "dueDate", Qui: null };

describe("HUB-14 — La page de reprise et ses portes (lot 71b)", () => {
  it("critère 1 — la page vide n'écrit rien : six lignes, la première action crée la reprise", async () => {
    const planner = await createPlanner();
    const page = await loadNewTakeoverPage(planner, null);
    expect(page.kind).toBe("page");
    if (page.kind !== "page") return;
    expect(page.model.id).toBeNull();
    expect(page.model.rows.map((row) => row.kind)).toEqual(["vendor_book", "event", "budget", "event_vendors", "tasks", "program"]);
    expect(page.model.rows.filter((row) => row.primary).map((row) => row.kind)).toEqual(["vendor_book"]);
    expect(page.model.progress).toEqual({ settled: 0, total: 6 });

    const started = await startTakeoverStep(planner, { takeoverId: null, eventId: null, kind: "vendor_book", intent: "drop" });
    expect(started.href).toBe(`/import?type=vendors&reprise=${started.takeoverId}#import-form`);
    expect((await getTakeover(db, planner.organizationId, started.takeoverId))?.progress).toEqual({ settled: 0, total: 6 });
  });

  it("critère 2 — « Je n'ai pas ce fichier » règle la ligne, la fait compter, et se défait par « Déposer un fichier »", async () => {
    const planner = await createPlanner();
    const { takeoverId, href } = await startTakeoverStep(planner, { takeoverId: null, eventId: null, kind: "vendor_book", intent: "noFile" });
    expect(href).toBe(`/reprise/${takeoverId}`);
    let model = (await loadTakeoverPage(planner, takeoverId))!;
    expect(model.rows[0]).toMatchObject({ state: "no_file", actions: ["dropAgain"] });
    expect(model.rows[0]!.decidedAt).not.toBeNull();
    expect(model.progress.settled).toBe(1);

    const again = await startTakeoverStep(planner, { takeoverId, eventId: null, kind: "vendor_book", intent: "dropAgain" });
    expect(again.href).toBe(`/import?type=vendors&reprise=${takeoverId}#import-form`);
    model = (await loadTakeoverPage(planner, takeoverId))!;
    expect(model.rows[0]).toMatchObject({ state: "todo", decidedAt: null });
    expect(model.progress.settled).toBe(0);
  });

  it("critère 3 — « Juliette & Romain », 20/03/2027 : un évènement Confirmé, d'origine « reprise », sans tâche ; la ligne 2 cochée", async () => {
    const planner = await createPlanner();
    const { takeoverId, eventId } = await enterTakeoverEvent(planner, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    const [row] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventsTable).where(eq(eventsTable.id, eventId)));
    expect(row).toMatchObject({ status: "confirmed", origin: "takeover", name: "Juliette & Romain", eventDate: "2027-03-20" });
    expect(await listEventTasks(planner.organizationId, eventId)).toEqual([]);
    const history = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventStatusHistory).where(eq(eventStatusHistory.eventId, eventId)));
    expect(history.map((entry) => [entry.toStatus, entry.dateKnown])).toEqual([["confirmed", false]]);

    const model = (await loadTakeoverPage(planner, takeoverId))!;
    expect(model).toMatchObject({ eventId, eventName: "Juliette & Romain", eventDate: "2027-03-20" });
    expect(model.rows[1]).toMatchObject({ state: "done", actions: ["openEvent"] });
    expect(model.rows.slice(2).every((row) => !row.waiting)).toBe(true);
    // Un mariage saisi ne reçoit le modèle d'aucun rétroplanning, même s'il en existe un pour son type.
    expect(model.rows.find((row) => row.kind === "tasks")).toMatchObject({ state: "todo" });
  });

  it("critère 4 — un budget qui nomme ses prestataires coche la ligne 4 « Avec le budget » dès qu'il est en cours", async () => {
    const planner = await createPlanner();
    const { takeoverId } = await enterTakeoverEvent(planner, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    const importId = await dropFile(planner, takeoverId, "budget", "budget.csv");
    // Dès le dépôt, avant le choix des colonnes (la colonne « Prestataire » est proposée).
    const dropped = (await loadTakeoverPage(planner, takeoverId))!;
    expect(dropped.rows.find((row) => row.kind === "event_vendors")).toMatchObject({ state: "covered", coveredVendorCount: 7 });
    await saveProposedColumns(planner, importId);
    const model = (await loadTakeoverPage(planner, takeoverId))!;
    expect(model.rows.find((row) => row.kind === "budget")).toMatchObject({ state: "in_progress", importId });
    expect(model.rows.find((row) => row.kind === "event_vendors")).toMatchObject({ state: "covered", actions: ["dropAnyway"], coveredVendorCount: 7 });
    // « 3 fichiers sur 6 » : la ligne couverte compte, le budget en cours non (R4).
    expect(model.progress).toEqual({ settled: 2, total: 6 });
  });

  it("critère 5 — un import laissé en plan se retrouve à sa ligne et en tête de « Reprendre et importer » ; « Abandonner cet import… » rend la ligne", async () => {
    const planner = await createPlanner();
    const { takeoverId } = await enterTakeoverEvent(planner, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    await settleTakeoverStep(db, { organizationId: planner.organizationId, userId: planner.userId, takeoverId, kind: "vendor_book", state: "no_file" });
    const importId = await dropFile(planner, takeoverId, "budget", "budget.csv");
    const model = (await loadTakeoverPage(planner, takeoverId))!;
    const budget = model.rows.find((row) => row.kind === "budget")!;
    expect(budget).toMatchObject({ state: "in_progress", next: true, primary: "continue", actions: ["continue", "abandon"], fileName: "budget.csv" });
    expect(budget.stoppedAt).toBe("columns");

    const journal = await listImports(db, planner.organizationId);
    expect(journal.find((entry) => entry.id === importId)).toMatchObject({ status: "draft", takeoverId, targetEventId: model.eventId });

    await abandonTakeoverImport(planner, takeoverId, importId);
    const after = (await loadTakeoverPage(planner, takeoverId))!;
    expect(after.rows.find((row) => row.kind === "budget")).toMatchObject({ state: "todo", importId: null, actions: ["drop", "noFile"] });
  });

  it("une ligne faite redit le fichier, l'heure et le nombre de son bilan ; la confirmation ramène à la page", async () => {
    const planner = await createPlanner();
    const { takeoverId } = await enterTakeoverEvent(planner, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    const importId = await dropFile(planner, takeoverId, "tasks", "a-faire.csv");
    await saveProposedColumns(planner, importId, TASK_COLUMNS);
    const done = await confirmImport({ organizationId: planner.organizationId, userId: planner.userId, importId, defaultProspectSourceId: null, locale: "fr" });
    expect(done.status).toBe("applied");
    const model = (await loadTakeoverPage(planner, takeoverId))!;
    const tasks = model.rows.find((row) => row.kind === "tasks")!;
    expect(tasks).toMatchObject({ state: "done", fileName: "a-faire.csv", figure: { key: "tasks" }, actions: ["seeSummary"] });
    expect(tasks.figure!.count).toBeGreaterThan(0);
    expect(tasks.at).toBeInstanceOf(Date);
    expect(model.withdrawUntil).toBeInstanceOf(Date);
  });

  it("critères 6 et 7 — la page terminée compte ce qui reste ; au deuxième mariage, la ligne 1 est déjà faite", async () => {
    const planner = await createPlanner();
    const first = await enterTakeoverEvent(planner, { takeoverId: null, name: "Léa & Hugo", eventDate: "2027-06-12", clients: [] });
    const vendorImport = await dropFile(planner, first.takeoverId, "vendor_book", "prestataires.csv");
    await saveProposedColumns(planner, vendorImport);
    expect((await confirmImport({ organizationId: planner.organizationId, userId: planner.userId, importId: vendorImport, defaultProspectSourceId: null, locale: "fr" })).status).toBe("applied");
    for (const kind of ["budget", "event_vendors", "tasks", "program"] as const) {
      await settleTakeoverStep(db, { organizationId: planner.organizationId, userId: planner.userId, takeoverId: first.takeoverId, kind, state: "no_file" });
    }
    const done = (await loadTakeoverPage(planner, first.takeoverId))!;
    expect(done.state).toBe("done");
    expect(done.progress).toEqual({ settled: 6, total: 6 });
    expect(done.toComplete.map((point) => point.key)).toEqual(["tasks", "clientLink", "guests"]);

    const second = await loadNewTakeoverPage(planner, null);
    if (second.kind !== "page") throw new Error("page attendue");
    expect(second.model.rows[0]).toMatchObject({ state: "done", importId: vendorImport });
    expect(second.model.rows.filter((row) => row.primary).map((row) => row.kind)).toEqual(["event"]);
  });

  it("la porte de « Tâches » : un mariage repris sans reprise en reçoit une à l'ouverture de sa ligne 5 ; avec une reprise, elle y mène", async () => {
    const planner = await createPlanner();
    const source = await createProspectSource(planner.organizationId, "Salon");
    const { id: eventId } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: source.id, clients: [{ firstName: "Juliette", lastName: "Exemple" }], eventDate: "2027-03-20" });
    const fresh = await loadNewTakeoverPage(planner, eventId);
    if (fresh.kind !== "page") throw new Error("page attendue");
    expect(fresh.model).toMatchObject({ id: null, eventId });
    expect(fresh.model.rows[1]).toMatchObject({ state: "done" });
    const { takeoverId, href } = await startTakeoverStep(planner, { takeoverId: null, eventId, kind: "tasks", intent: "drop" });
    expect(href).toBe(`/import?type=tasks&reprise=${takeoverId}#import-form`);
    expect(await loadNewTakeoverPage(planner, eventId)).toEqual({ kind: "redirect", href: `/reprise/${takeoverId}` });
  });
});

describe("SEC-12, SEC-13 — La reprise d'une autre organisation n'existe pas (lot 71b)", () => {
  it("la page d'une reprise de B répond comme une page inexistante, et B n'y dépose ni ne règle rien", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const { takeoverId } = await enterTakeoverEvent(a, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    expect(await loadTakeoverPage(b, takeoverId)).toBeNull();
    expect(await loadTakeoverPage(b, randomUUID())).toBeNull();
    expect(await takeoverForUpload(b, takeoverId, "budget")).toBeNull();
    await expect(startTakeoverStep(b, { takeoverId, eventId: null, kind: "budget", intent: "noFile" })).rejects.toThrow();
    await expect(enterTakeoverEvent(b, { takeoverId, name: "Autre", eventDate: null, clients: [] })).rejects.toThrow();
    const aEvent = (await loadTakeoverPage(a, takeoverId))!.eventId!;
    // Un évènement de A ouvert par B : même réponse qu'un évènement inexistant.
    const foreign = await loadNewTakeoverPage(b, aEvent);
    expect(foreign).toEqual({ kind: "not_found" });
    expect(await loadNewTakeoverPage(b, randomUUID())).toEqual({ kind: "not_found" });
    // Rien n'a bougé chez A.
    expect((await loadTakeoverPage(a, takeoverId))!.rows.find((row) => row.kind === "budget")).toMatchObject({ state: "todo" });
  });

  it("une Planner restreinte ne voit pas la reprise d'un mariage hors de son équipe ; un essai ne se reprend pas", async () => {
    const owner = await createPlanner();
    const member = await createPlanner("member", owner.organizationId);
    const restricted: TakeoverActor = { ...member, viewer: { ...member.viewer, allPlannersSeeAll: false } };
    const { takeoverId, eventId } = await enterTakeoverEvent(owner, { takeoverId: null, name: "Juliette & Romain", eventDate: "2027-03-20", clients: [] });
    expect(await loadTakeoverPage(restricted, takeoverId)).toBeNull();
    expect(await loadNewTakeoverPage(restricted, eventId)).toEqual({ kind: "not_found" });

    const demo = await startExampleEvent({ organizationId: owner.organizationId, userId: owner.userId, locale: "fr" });
    expect(await loadNewTakeoverPage(owner, demo.eventId)).toEqual({ kind: "not_found" });
  });
});
