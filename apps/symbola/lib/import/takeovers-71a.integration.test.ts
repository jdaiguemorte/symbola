// Lot 71a (HUB-14, PAR-01, UX-02, BUD-01, EVT-05, CHR-02, RGP-03 ; spécification du lot 71, § 5.1) — le
// socle de la reprise d'un mariage et les règles de fond, contre un vrai PostgreSQL : un import ne crée ni
// retard ni relance, ce que le fichier ne dit pas reste « non renseigné », rien n'est fondu, les noms sont
// à la casse de l'app ; l'effacement définitif d'un mariage efface les valeurs du journal de ses imports.
// Tests d'abus : une organisation ne vise ni ne lit la reprise d'une autre ; un essai ne se reprend pas ;
// une Planner restreinte ne voit pas la reprise d'un évènement hors de son équipe.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventStatusHistory, eventTasks, eventVendorCandidates, events as eventsTable } from "@symbola/db/schema/events";
import { importItems, imports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { getUnallocatedTotals, listBudgetLines } from "@/modules/budget/service";
import { paymentStatus } from "@/modules/budget/payments";
import {
  addEventVendorSlot,
  addVendorCandidate,
  createEventType,
  createProspect,
  createProspectSource,
  getEvent,
  listUncontractedVendors,
  restoreEvent,
  startExampleEvent,
  trashEvent,
  updateVendorCandidate,
  setEventTeamMember,
} from "@/modules/events/service";
import {
  attachImportToTakeoverStep,
  attachTakeoverEvent,
  coverTakeoverStep,
  createTakeover,
  decideFreeColumns,
  getEventTakeover,
  getImportColumns,
  getTakeover,
  hubPrivacy,
  purgeExpiredImportLeftovers,
  saveImportAnswers,
  saveImportMapping,
  settleTakeoverStep,
  startEventSheetsImport,
  startImport,
  TakeoverDemoEventError,
  TakeoverImportMismatchError,
  TakeoverNotFoundError,
} from "@/modules/hub/service";
import { runImportJobsUntilIdle } from "../import-jobs";
import { purgeOrganizationTrash } from "../trash";
import { decideMatches, getImportMatchesView } from "./matching";
import { confirmWithAnswers } from "@/lib/test-fixtures/import-answers";

const { sql, db } = createAppConnection();
const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = "2026-11-24";

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}
type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function createWedding(planner: Planner, clients = [{ firstName: "Juliette", lastName: "Exemple" }]) {
  const source = await createProspectSource(planner.organizationId, `Salon ${randomUUID().slice(0, 6)}`);
  const { id } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: source.id, clients, eventDate: "2027-03-20" });
  return id;
}

const owner = (planner: Planner) => ({ userId: planner.userId, role: "owner" as const, allPlannersSeeAll: true });

// Un fichier jusqu'à « Vérifier » : colonnes proposées (ou celles données), rapprochements acceptés.
async function prepare(planner: Planner, input: { entityType: "budget_lines" | "tasks" | "events"; file: string; bytes: Uint8Array; targetEventId?: string; columns?: Record<string, string | null> }) {
  const started = await startImport(db, { ...planner, entityType: input.entityType, fileName: input.file, bytes: input.bytes, ...(input.targetEventId ? { targetEventId: input.targetEventId } : {}) });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  const view = await getImportColumns(db, planner.organizationId, started.importId);
  const saved = await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    choices: view!.columns.map((column) => {
      const forced = input.columns?.[column.header];
      const target = forced === undefined ? (column.proposedFieldKey ?? "none") : (forced ?? "ignore");
      return { columnIndex: column.columnIndex, target, confirmed: true };
    }),
  });
  if (saved.status !== "saved") throw new Error(JSON.stringify(saved));
  await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: view!.columns.filter((column) => !column.proposedFieldKey && input.columns?.[column.header] === undefined).map((column) => ({ columnIndex: column.columnIndex, keep: false })) });
  const matches = await getImportMatchesView(planner.organizationId, started.importId);
  const proposed = matches!.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const }));
  if (proposed.length > 0) await decideMatches(planner.organizationId, started.importId, proposed);
  return started.importId;
}

const corpus = (name: string) => readImportCorpusFile(`tableur-planner/${name}`);

async function budgetPayments(planner: Planner, eventId: string) {
  const { lines } = await listBudgetLines(planner.organizationId, eventId);
  return lines.flatMap((line) => line.payments);
}

async function importSheet(planner: Planner, answers: Record<string, unknown>, takeoverId?: string) {
  const started = await startEventSheetsImport(db, { ...planner, files: [{ fileName: "fiche-evenement-complete.pdf", bytes: readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf") }] });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  await runImportJobsUntilIdle([planner.organizationId]);
  await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: [] });
  if (takeoverId) await attachImportToTakeoverStep(db, { ...planner, takeoverId, kind: "event", importId: started.importId });
  expect(await saveImportAnswers(db, { organizationId: planner.organizationId, importId: started.importId, answers })).toBe(true);
  expect(await confirmWithAnswers({ ...planner, importId: started.importId, locale: "fr" })).toMatchObject({ status: "applied" });
  const [item] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(importItems).where(and(eq(importItems.importId, started.importId), eq(importItems.kind, "event"))));
  return { importId: started.importId, eventId: item!.elementId };
}

describe("HUB-14 — La reprise d'un mariage (lot 71a)", () => {
  it("critère 1 : une reprise se crée sans évènement, reçoit son évènement à la ligne 2, et ne peut viser qu'un évènement de son organisation", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const takeover = await createTakeover(db, { ...a, viewer: owner(a) });
    expect(takeover).toMatchObject({ eventId: null, progress: { settled: 0, total: 6 } });
    expect(takeover.steps.map((step) => [step.kind, step.state])).toEqual([
      ["vendor_book", "todo"],
      ["event", "todo"],
      ["budget", "todo"],
      ["event_vendors", "todo"],
      ["tasks", "todo"],
      ["program", "todo"],
    ]);

    // Abus : l'évènement d'une autre organisation répond comme un évènement inexistant (SEC-13).
    const foreign = await createWedding(b);
    await expect(attachTakeoverEvent(db, { ...a, takeoverId: takeover.id, eventId: foreign })).rejects.toBeInstanceOf(TakeoverNotFoundError);
    await expect(createTakeover(db, { ...a, eventId: foreign })).rejects.toBeInstanceOf(TakeoverNotFoundError);
    await expect(attachTakeoverEvent(db, { ...a, takeoverId: takeover.id, eventId: randomUUID() })).rejects.toBeInstanceOf(TakeoverNotFoundError);

    const wedding = await createWedding(a);
    const attached = await attachTakeoverEvent(db, { ...a, takeoverId: takeover.id, eventId: wedding });
    expect(attached.eventId).toBe(wedding);
    expect(attached.steps.find((step) => step.kind === "event")?.state).toBe("done");
    expect((await getEventTakeover(db, a.organizationId, wedding))?.id).toBe(takeover.id);

    // Abus : B ne lit ni ne règle la reprise de A.
    expect(await getTakeover(db, b.organizationId, takeover.id)).toBeNull();
    expect(await getEventTakeover(db, b.organizationId, wedding)).toBeNull();
    await expect(settleTakeoverStep(db, { ...b, takeoverId: takeover.id, kind: "tasks", state: "no_file" })).rejects.toBeInstanceOf(TakeoverNotFoundError);
  });

  it("abus : un essai guidé ne peut pas être repris ; un import de B ne se rattache pas à une ligne de A ; une Planner restreinte ne voit pas la reprise d'un évènement hors de son équipe", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const example = await startExampleEvent({ organizationId: a.organizationId, userId: a.userId, locale: "fr", now: new Date() });
    await expect(createTakeover(db, { ...a, eventId: example.eventId })).rejects.toBeInstanceOf(TakeoverDemoEventError);

    const wedding = await createWedding(a);
    const takeover = await createTakeover(db, { ...a, eventId: wedding });
    const foreignImport = await prepare(b, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: await createWedding(b) });
    await expect(attachImportToTakeoverStep(db, { ...a, takeoverId: takeover.id, kind: "budget", importId: foreignImport })).rejects.toBeInstanceOf(TakeoverNotFoundError);
    // Un import de la bonne organisation mais d'une autre sorte ne remplit pas la ligne.
    const tasksImport = await prepare(a, { entityType: "tasks", file: "a-faire.csv", bytes: corpus("a-faire.csv"), targetEventId: wedding, columns: { "Fait ?": "done", Quoi: "label", "Pour quand": "dueDate", Qui: null } });
    await expect(attachImportToTakeoverStep(db, { ...a, takeoverId: takeover.id, kind: "budget", importId: tasksImport })).rejects.toBeInstanceOf(TakeoverImportMismatchError);

    const member = await createUser(db, { organizationId: a.organizationId, email: `m-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" });
    const restricted = { userId: member.id, role: "member" as const, allPlannersSeeAll: false };
    expect(await getTakeover(db, a.organizationId, takeover.id, restricted)).toBeNull();
    expect(await getEventTakeover(db, a.organizationId, wedding, restricted)).toBeNull();
    await setEventTeamMember({ organizationId: a.organizationId, eventId: wedding, userId: member.id, role: "assistant", byUserId: a.userId });
    expect((await getTakeover(db, a.organizationId, takeover.id, restricted))?.id).toBe(takeover.id);
  });

  it("critère 2 : le compteur compte les lignes faites, sans fichier et couvertes, même par un import encore en cours", async () => {
    const planner = await createPlanner();
    const wedding = await createWedding(planner);
    const takeover = await createTakeover(db, { ...planner, eventId: wedding });
    expect(takeover.progress.settled).toBe(1);
    const budget = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: wedding });
    let view = await attachImportToTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "budget", importId: budget });
    expect(view.steps.find((step) => step.kind === "budget")?.state).toBe("in_progress");
    view = await coverTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "event_vendors", byKind: "budget" });
    view = await settleTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "program", state: "no_file" });
    // Ligne 2 faite, budget en cours (ne compte pas), prestataires couverts, programme sans fichier.
    expect(view.progress).toEqual({ settled: 3, total: 6 });
    view = await settleTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "program", state: "todo" });
    expect(view.progress).toEqual({ settled: 2, total: 6 });
    // Le budget écrit, sa ligne est faite.
    expect(await confirmWithAnswers({ ...planner, importId: budget, locale: "fr" })).toMatchObject({ status: "applied" });
    expect((await getTakeover(db, planner.organizationId, takeover.id))?.progress).toEqual({ settled: 3, total: 6 });

    // R2 : au deuxième mariage, la ligne du carnet est déjà faite dès qu'un carnet a été repris.
    const vendors = await startImport(db, { ...planner, entityType: "vendors", fileName: "carnet.csv", bytes: new TextEncoder().encode("Nom;Ville\nAtelier Pivoine;Poitiers\n") });
    if (vendors.status !== "started") throw new Error("import refusé");
    const columns = await getImportColumns(db, planner.organizationId, vendors.importId);
    await saveImportMapping(db, { organizationId: planner.organizationId, importId: vendors.importId, choices: columns!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: true })) });
    await decideFreeColumns(db, { organizationId: planner.organizationId, importId: vendors.importId, decisions: [] });
    expect(await confirmWithAnswers({ ...planner, importId: vendors.importId, locale: "fr" })).toMatchObject({ status: "applied" });
    const second = await createTakeover(db, { ...planner });
    expect(second.steps.find((step) => step.kind === "vendor_book")).toMatchObject({ state: "done", importId: vendors.importId });
  });

  it("critère 3 : budget.csv répondu « Oui, payés » donne 8 727,00 € réglés, 18 775,00 € à payer, aucune échéance en retard au 24/11/2026 ; répondu « Non », 6 échéances en retard", async () => {
    for (const answer of ["yes", "no"] as const) {
      const planner = await createPlanner();
      const wedding = await createWedding(planner);
      const importId = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: wedding });
      await saveImportAnswers(db, { organizationId: planner.organizationId, importId, answers: { depositsPaid: { answer } } });
      expect(await confirmWithAnswers({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
      const payments = await budgetPayments(planner, wedding);
      const paid = payments.filter((payment) => payment.paidOn !== null).reduce((sum, payment) => sum + payment.amountCents, 0);
      const due = payments.filter((payment) => payment.paidOn === null).reduce((sum, payment) => sum + payment.amountCents, 0);
      const late = payments.filter((payment) => paymentStatus(payment, TODAY) === "overdue");
      if (answer === "yes") {
        expect({ paid, due, late: late.length }).toEqual({ paid: 872700, due: 1877500, late: 0 });
      } else {
        expect({ paid, due, late: late.length }).toEqual({ paid: 0, due: 2750200, late: 6 });
      }
    }
  });

  it("critère 4 : les trois lignes « Traiteur » de budget.csv donnent trois lignes du budget, chacune avec son détail et ses montants ; le prévu total reste 36 450,00 €", async () => {
    const planner = await createPlanner();
    const wedding = await createWedding(planner);
    const importId = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: wedding });
    expect(await confirmWithAnswers({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
    const { lines } = await listBudgetLines(planner.organizationId, wedding);
    expect(lines).toHaveLength(14);
    expect(lines.reduce((sum, line) => sum + (line.estimatedAmountCents ?? 0), 0)).toBe(3645000);
    const caterer = lines.filter((line) => ["Vin d'honneur et dîner, 110 couverts", "Brunch du dimanche, 60 couverts", "Vins et champagne"].includes(line.label));
    expect(caterer.map((line) => [line.label, line.estimatedAmountCents, line.committedAmountCents])).toEqual([
      ["Vin d'honneur et dîner, 110 couverts", 1320000, 1364000],
      ["Brunch du dimanche, 60 couverts", 210000, null],
      ["Vins et champagne", 180000, null],
    ]);
    expect(new Set(caterer.map((line) => line.eventVendorSlotId)).size).toBe(1);
  });

  it("critère 5 : un prestataire retenu par une reprise, signé, non signé ou non renseigné, ne paraît jamais dans « Contrat de … à faire signer » ; un prestataire retenu à la main ensuite y paraît", async () => {
    const planner = await createPlanner();
    const wedding = await createWedding(planner);
    const takeover = await createTakeover(db, { ...planner, eventId: wedding });
    const importId = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: wedding });
    await attachImportToTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "budget", importId });
    // Ligne par ligne : la première signée, les autres non (I1).
    await saveImportAnswers(db, { organizationId: planner.organizationId, importId, answers: { contracts: { answer: "per_line", signedRows: [0] } } });
    expect(await confirmWithAnswers({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
    const candidates = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.eventId, wedding)));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.takeoverContract !== null)).toBe(true);
    expect(candidates.filter((candidate) => candidate.status === "contract_signed").map((candidate) => candidate.takeoverContract)).toEqual(["signed"]);
    expect(candidates.filter((candidate) => candidate.status === "retained").every((candidate) => candidate.takeoverContract === "unsigned")).toBe(true);

    // « Aucun » dans une reprise : contrats non signés, et jamais de relance non plus. Lot 71c (I1) : la
    // question est posée dès qu'un budget nomme ses prestataires ; « non renseigné » reste la règle des
    // retenus sans question (contrat `takeoverContractFor`, testé seul).
    const other = await createWedding(planner, [{ firstName: "Léa", lastName: "Exemple" }]);
    const otherTakeover = await createTakeover(db, { ...planner, eventId: other });
    const unknownImport = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: other });
    await attachImportToTakeoverStep(db, { ...planner, takeoverId: otherTakeover.id, kind: "budget", importId: unknownImport });
    expect(await confirmWithAnswers({ ...planner, importId: unknownImport, locale: "fr", answers: { contracts: { answer: "none" } } })).toMatchObject({ status: "applied" });
    const unknown = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.eventId, other)));
    expect(unknown.every((candidate) => candidate.takeoverContract === "unsigned" && candidate.status === "retained")).toBe(true);

    expect(await listUncontractedVendors(planner.organizationId, TODAY)).toEqual([]);

    // Retenu à la main ensuite : la règle d'avant.
    const slot = await addEventVendorSlot(planner.organizationId, wedding, "Officiant");
    const candidate = await addVendorCandidate({ organizationId: planner.organizationId, eventId: wedding, vendorSlotId: slot.id, vendorName: "Cérémonies Exemple" });
    await updateVendorCandidate({ organizationId: planner.organizationId, candidateId: candidate.id, status: "retained", changedByUserId: planner.userId });
    expect((await listUncontractedVendors(planner.organizationId, TODAY)).map((vendor) => vendor.vendorName)).toEqual(["Cérémonies Exemple"]);
  });

  it("critère 6 : une fiche PDF importée « Signé, en préparation » donne un évènement Confirmé, une ligne d'historique « date non renseignée », aucune source, le type de l'espace, la note dans « Notes », 21 650,50 € et 3 200,00 € à répartir, rien dans « Champs importés »", async () => {
    const planner = await createPlanner();
    const type = await createEventType(planner.organizationId, { label: "Mariage", audience: "couple" });
    const takeover = await createTakeover(db, { ...planner });
    const { eventId } = await importSheet(planner, { eventStage: "signed" }, takeover.id);
    const event = await getEvent(planner.organizationId, eventId);
    expect(event).toMatchObject({ status: "confirmed", prospectSourceId: null, eventTypeId: type.id, notes: "Cérémonie laïque", wantedBudgetCents: 2500000 });
    expect(event?.importedFields ?? null).toBeNull();
    const [row] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventsTable).where(eq(eventsTable.id, eventId)));
    expect(row).toMatchObject({ origin: "takeover", importedFields: null });
    const history = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventStatusHistory).where(eq(eventStatusHistory.eventId, eventId)));
    expect(history.map((entry) => [entry.toStatus, entry.dateKnown])).toEqual([["confirmed", false]]);
    expect(await getUnallocatedTotals(planner.organizationId, eventId)).toMatchObject({ committedCents: 2165050, paidCents: 320000, allocatedCents: 0, remainingCents: 2165050 });
    // La reprise a son mariage : ligne 2 faite.
    expect((await getTakeover(db, planner.organizationId, takeover.id))?.steps.find((step) => step.kind === "event")?.state).toBe("done");
  });

  it("critère 7 : une tâche cochée « x » dans a-faire.csv arrive faite, date de fin non renseignée, sans auteur", async () => {
    const planner = await createPlanner();
    const wedding = await createWedding(planner);
    const importId = await prepare(planner, { entityType: "tasks", file: "a-faire.csv", bytes: corpus("a-faire.csv"), targetEventId: wedding, columns: { "Fait ?": "done", Quoi: "label", "Pour quand": "dueDate", Qui: null } });
    expect(await confirmWithAnswers({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
    const tasks = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, wedding)));
    const done = tasks.filter((task) => task.doneAt !== null);
    expect(done.map((task) => task.label).sort()).toEqual(["Choisir la fleuriste", "Envoyer les faire-part", "Réserver le DJ", "Réserver le traiteur", "Signer le contrat du domaine"]);
    expect(done.every((task) => !task.doneDateKnown && task.doneByKind === null && task.doneByUserId === null)).toBe(true);
    expect(tasks.filter((task) => task.doneAt === null).every((task) => task.doneDateKnown)).toBe(true);
  });

  it("critère 8 : « Léa MARTIN », « POITIERS » deviennent « Léa Martin », « Poitiers » ; « Garder les capitales » les laisse", async () => {
    for (const nameCase of ["app", "keep"] as const) {
      const planner = await createPlanner();
      const importId = await prepare(planner, { entityType: "events", file: "mariages.csv", bytes: new TextEncoder().encode("Prénom mariée;Nom mariée;Date du mariage;Lieu;Ville du lieu\nLéa;MARTIN;20/03/2027;Domaine Exemple;POITIERS\n") });
      await saveImportAnswers(db, { organizationId: planner.organizationId, importId, answers: { nameCase } });
      expect(await confirmWithAnswers({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
      const [item] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(importItems).where(and(eq(importItems.importId, importId), eq(importItems.kind, "event"))));
      const event = await getEvent(planner.organizationId, item!.elementId);
      const name = `${event?.clients[0]?.firstName} ${event?.clients[0]?.lastName}`;
      expect([name, event?.venueCity]).toEqual(nameCase === "app" ? ["Léa Martin", "Poitiers"] : ["Léa MARTIN", "POITIERS"]);
      // Source facultative : aucune source par défaut, « non renseignée ».
      expect(event?.prospectSourceId).toBeNull();
    }
  });

  it("critère 11 : un mariage repris, supprimé puis effacé de la corbeille, ne laisse aucune valeur dans le journal de ses imports ; restauré avant 30 jours, il garde son journal intact", async () => {
    for (const end of ["restore", "purge"] as const) {
      const planner = await createPlanner();
      const takeover = await createTakeover(db, { ...planner });
      const { importId: sheetImport, eventId } = await importSheet(planner, { eventStage: "signed" }, takeover.id);
      const budget = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: eventId });
      await attachImportToTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "budget", importId: budget });
      expect(await confirmWithAnswers({ ...planner, importId: budget, locale: "fr" })).toMatchObject({ status: "applied" });
      await withOrganization(db, planner.organizationId, (tx) =>
        tx.update(imports).set({ leftovers: { directory: [{ role: "Témoin", company: null, contact: "Bastien Exemple", phone: "0639980202" }] } }).where(eq(imports.id, sheetImport)),
      );
      const deletedAt = new Date();
      expect(await trashEvent(planner.organizationId, eventId, deletedAt)).toBe(true);
      const journal = async () =>
        withOrganization(db, planner.organizationId, async (tx) => ({
          imports: await tx.select().from(imports).where(eq(imports.organizationId, planner.organizationId)),
          items: await tx.select().from(importItems),
        }));

      if (end === "restore") {
        // Au 29e jour, rien n'est encore effacé ; restauré, le journal est intact.
        await purgeOrganizationTrash(planner.organizationId, new Date(deletedAt.getTime() + 29 * DAY_MS));
        expect(await restoreEvent(planner.organizationId, eventId)).not.toBeNull();
        const kept = await journal();
        expect(kept.items.every((item) => item.written !== null && (item.fields ?? []).length > 0)).toBe(true);
        expect(kept.imports.find((row) => row.id === sheetImport)?.leftovers).not.toBeNull();
        expect(kept.imports.map((row) => row.fileName).sort()).toEqual(["budget.csv", "fiche-evenement-complete.pdf"]);
        expect(await getEventTakeover(db, planner.organizationId, eventId)).not.toBeNull();
        continue;
      }
      // Au 30e jour, l'évènement est effacé : le journal ne garde qu'une trace sans donnée personnelle.
      await purgeOrganizationTrash(planner.organizationId, new Date(deletedAt.getTime() + 30 * DAY_MS + 60_000));
      expect(await getEvent(planner.organizationId, eventId)).toBeNull();
      const left = await journal();
      expect(left.imports).toHaveLength(2);
      for (const row of left.imports) {
        expect(row).toMatchObject({ status: "applied", leftovers: null, rows: null });
        expect(row.fileName).not.toMatch(/budget|fiche/);
        expect(row.result).not.toBeNull();
      }
      expect(left.items.length).toBeGreaterThan(0);
      expect(left.items.every((item) => item.previous === null && item.written === null && item.fields === null)).toBe(true);
      expect(JSON.stringify(left)).not.toMatch(/Bastien|0639980202|Clémence|MARTIN|Martin/);
      expect(await getTakeover(db, planner.organizationId, takeover.id)).toBeNull();
    }
  });
});

describe("RGP-03, RGP-05 — L'annuaire non repris d'un programme (leftovers, I4, lot 71a)", () => {
  async function importWithLeftovers(planner: Planner) {
    const wedding = await createWedding(planner);
    const importId = await prepare(planner, { entityType: "budget_lines", file: "budget.csv", bytes: corpus("budget.csv"), targetEventId: wedding });
    expect(await confirmWithAnswers({ ...planner, importId, locale: "fr" })).toMatchObject({ status: "applied" });
    await withOrganization(db, planner.organizationId, (tx) =>
      tx.update(imports).set({ leftovers: { directory: [{ role: "Témoin", company: null, contact: "Bastien Exemple", phone: "0639980202" }] } }).where(eq(imports.id, importId)),
    );
    const [row] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(imports).where(eq(imports.id, importId)));
    return { importId, appliedAt: row!.appliedAt! };
  }

  const leftoversOf = async (planner: Planner, importId: string) =>
    (await withOrganization(db, planner.organizationId, (tx) => tx.select({ leftovers: imports.leftovers }).from(imports).where(eq(imports.id, importId))))[0]?.leftovers ?? null;

  it("la purge l'efface passé 90 jours après l'import : gardé au 89e et au 90e jour, effacé au 91e", async () => {
    const planner = await createPlanner();
    const { importId, appliedAt } = await importWithLeftovers(planner);
    for (const [day, kept] of [
      [89, true],
      [90, true],
      [91, false],
    ] as const) {
      await purgeExpiredImportLeftovers(db, [planner.organizationId], new Date(appliedAt.getTime() + day * DAY_MS));
      expect(await leftoversOf(planner, importId), `jour ${day}`).toEqual(kept ? expect.anything() : null);
    }
  });

  it("find le trouve par un nom ou un téléphone qu'il contient ; erase l'efface ; une autre organisation ne le trouve pas", async () => {
    const planner = await createPlanner();
    const other = await createPlanner();
    const { importId } = await importWithLeftovers(planner);
    const records = await hubPrivacy.find({ organizationId: planner.organizationId, terms: { name: "Bastien Exemple" } });
    const record = records.find((entry) => entry.kind === "import_leftovers");
    expect(record).toMatchObject({ recordId: importId });
    expect(Object.values(record!.fields)).toEqual(expect.arrayContaining(["Bastien Exemple", "0639980202"]));
    expect((await hubPrivacy.find({ organizationId: other.organizationId, terms: { name: "Bastien Exemple" } })).some((entry) => entry.kind === "import_leftovers")).toBe(false);
    const plan = await hubPrivacy.erase({ organizationId: planner.organizationId, records: [record!], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2027-06-01" });
    expect(plan).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "import_leftovers", recordId: importId, fate: "deleted" })]));
    expect(await leftoversOf(planner, importId)).toBeNull();
  });
});
