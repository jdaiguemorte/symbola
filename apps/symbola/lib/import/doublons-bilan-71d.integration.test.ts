// Lot 71d (HUB-14, BUD-01, PRE-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08) — « Doublons »,
// « Vérifier », le bilan et le retrait d'un import, contre un vrai PostgreSQL, sur les fichiers fictifs du
// tableur de la planner. Règles tenues : chaque ligne reste une ligne ; rien n'est écrit avant l'accord ;
// les nombres annoncés sont ceux du bilan (C-58) ; un prestataire du carnet est retrouvé, jamais doublé ;
// retirer un import dit ce qui part et ce qui reste, et ne retire rien d'autre (C-66). Abus : une autre
// organisation ne lit, ne décide ni ne retire rien de l'import ou de la reprise de A (SEC-13).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { listBudgetLines } from "@/modules/budget/service";
import { eq } from "drizzle-orm";
import { budgetLines } from "@symbola/db/schema/budget";
import { eventVendorCandidates } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { addDefaultVendorSlots, createProspect, createProspectSource, getEvent, listEventVendorSlots } from "@/modules/events/service";
import { attachImportToTakeoverStep, createTakeover, decideFreeColumns, getEventTakeover, getImportColumns, getTakeover, saveImportMapping, startEventSheetsImport, startImport } from "@/modules/hub/service";
import { createVendor } from "@/modules/vendors/service";
import { runImportJobsUntilIdle } from "../import-jobs";
import { confirmImport, getBudgetImportPlan, getImportPreview, getUndoPreview, takeoverRemoval, undoImport, undoTakeover } from "./apply";
import { confirmBudgetSplit, decideBudgetDoublons, getBudgetDoublonsView, placeBudgetGroup } from "./budget-doublons";
import { getImportMatchesView } from "./matching";
import { saveQuestionAnswers } from "./questions";

const { sql, db } = createAppConnection();
const NOW = new Date("2026-11-25T09:21:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const listEventVendorCandidates = (organizationId: string, eventId: string) =>
  withOrganization(db, organizationId, (tx) => tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.eventId, eventId)));

afterAll(async () => {
  await sql.end();
});

// Les postes de départ de l'agence (données de départ, français).
const STARTER_SLOTS = [
  "Lieu de réception",
  "Traiteur",
  "Photographe",
  "Vidéaste",
  "DJ / musiciens",
  "Fleuriste",
  "Décoration",
  "Coiffure et maquillage",
  "Papeterie",
  "Transport des invités",
];
// Le carnet, tel que l'a rempli prestataires.csv ; « Élodie Beauté » y est écrite autrement.
const CARNET = ["Domaine de la Roche Fictive", "Maison Bellerive", "Atelier Pivoine", "Studio Clair-Obscur", "Nuit Blanche Sono", "Atelier Papier Plié", "Élodie Perrot · Beauté"];

async function createPlanner(options: { carnet?: boolean } = {}) {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const planner = { organizationId: organization.id, userId: user.id };
  await addDefaultVendorSlots(planner.organizationId, STARTER_SLOTS);
  if (options.carnet !== false) for (const name of CARNET) await createVendor(planner.organizationId, { name });
  return planner;
}
type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function createWedding(planner: Planner) {
  const source = await createProspectSource(planner.organizationId, `Salon ${randomUUID().slice(0, 6)}`);
  const { id } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: source.id, clients: [{ firstName: "Juliette", lastName: "Exemple" }], eventDate: "2027-03-20" });
  return id;
}

async function upload(planner: Planner, input: { entityType: "budget_lines" | "tasks"; file: string; targetEventId: string }) {
  const started = await startImport(db, { ...planner, entityType: input.entityType, fileName: input.file, bytes: readImportCorpusFile(`tableur-planner/${input.file}`), targetEventId: input.targetEventId });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  const view = await getImportColumns(db, planner.organizationId, started.importId);
  await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "ignore", confirmed: true })),
  });
  await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: [] });
  return started.importId;
}

// Un budget de reprise prêt à « Doublons » : le mariage, sa reprise, budget.csv, les questions répondues.
async function budgetTakeover(planner: Planner) {
  const wedding = await createWedding(planner);
  const takeover = await createTakeover(db, { ...planner, eventId: wedding });
  const importId = await upload(planner, { entityType: "budget_lines", file: "budget.csv", targetEventId: wedding });
  await attachImportToTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "budget", importId });
  await getImportMatchesView(planner.organizationId, importId);
  expect(await saveQuestionAnswers(planner.organizationId, importId, { depositsPaid: { answer: "yes" }, contracts: { answer: "all" } })).toBe(true);
  return { wedding, takeoverId: takeover.id, importId };
}

// Les choix de « Doublons » faits comme dans la maquette : « C'est juste », « Le retirer de ce mariage »
// pour « Décoration », les autres postes gardés « à trouver », « C'est la même fiche ».
async function decideAll(planner: Planner, importId: string, options: { removeDecoration?: boolean; elodie?: "same" | "create" } = {}) {
  const view = await getBudgetDoublonsView(planner.organizationId, importId);
  const split = view!.groups.find((group) => group.reason === "split");
  if (split) expect(await confirmBudgetSplit(planner.organizationId, importId, split.rows.map((row) => row.rowIndex))).toBe(true);
  const slots = view!.unusedSlots.map((slot) => ({ slotId: slot.slotId, decision: slot.label === "Décoration" && options.removeDecoration !== false ? ("remove" as const) : ("keep" as const) }));
  const vendors = view!.vendors.doubts.map((doubt) => ({ name: doubt.name, decision: options.elodie ?? ("same" as const) }));
  expect(await decideBudgetDoublons(planner.organizationId, importId, { slots, vendors })).toBe(true);
}

describe("HUB-14, BUD-01 — « Doublons » d'un budget de reprise (lot 71d)", () => {
  it("critère 1 : les 14 lignes de budget.csv restent 14 lignes ; « Lieu » sous « Lieu de réception », « Photo et vidéo » réparti « À vérifier »", async () => {
    const planner = await createPlanner();
    const { wedding, importId } = await budgetTakeover(planner);
    const view = await getBudgetDoublonsView(planner.organizationId, importId);
    expect(view?.groups.flatMap((group) => group.rows)).toHaveLength(14);
    expect(view?.fileSlotCount).toBe(8);
    const slots = new Map((await listEventVendorSlots(planner.organizationId, wedding)).map((slot) => [slot.id, slot.label]));
    const venue = view!.groups.find((group) => group.fileSlot === "Lieu")!;
    expect([slots.get(venue.slotId!), venue.reason]).toEqual(["Lieu de réception", "close"]);
    const split = view!.groups.find((group) => group.fileSlot === "Photo et vidéo")!;
    expect(split.reason).toBe("split");
    expect(split.rows.map((row) => slots.get(row.slotId!))).toEqual(["Photographe", "Vidéaste"]);
    expect(view?.choices.map((choice) => choice.label)).toEqual(["Photo et vidéo", "Décoration", "Élodie Beauté"]);

    // Rien n'est écrit avant l'accord : « Continuer » est bloqué tant qu'un choix reste.
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toEqual({ status: "blocked", blockers: ["matches_undecided"] });
    expect((await listBudgetLines(planner.organizationId, wedding)).lines).toHaveLength(0);

    await decideAll(planner, importId);
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const lines = (await listBudgetLines(planner.organizationId, wedding)).lines;
    expect(lines).toHaveLength(14);
    // Trois lignes « Traiteur » restent trois lignes, chacune avec son montant : jamais fondues.
    const caterer = [...slots].find(([, label]) => label === "Traiteur")![0];
    expect(lines.filter((line) => line.eventVendorSlotId === caterer).map((line) => line.estimatedAmountCents).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([180_000, 210_000, 1_320_000]);
  });

  it("une ligne rangée sous un autre poste à la main y va ; « Nouveau poste » crée un poste aux mots du fichier", async () => {
    const planner = await createPlanner();
    const { wedding, importId } = await budgetTakeover(planner);
    const view = await getBudgetDoublonsView(planner.organizationId, importId);
    const papeterie = view!.groups.find((group) => group.fileSlot === "Papeterie")!;
    expect(await placeBudgetGroup(planner.organizationId, importId, { rowIndexes: papeterie.rows.map((row) => row.rowIndex), slotId: null })).toBe(true);
    const transport = view!.groups.find((group) => group.fileSlot === "Transport")!;
    const deco = view!.slotOptions.find((slot) => slot.label === "Décoration")!;
    expect(await placeBudgetGroup(planner.organizationId, importId, { rowIndexes: transport.rows.map((row) => row.rowIndex), slotId: deco.id })).toBe(true);
    // Un poste qui n'est pas proposé pour ces lignes (un identifiant inventé) est refusé.
    expect(await placeBudgetGroup(planner.organizationId, importId, { rowIndexes: transport.rows.map((row) => row.rowIndex), slotId: randomUUID() })).toBe(false);
    await decideAll(planner, importId, { removeDecoration: false });
    const plan = await getBudgetImportPlan(planner.organizationId, importId, { now: NOW });
    expect(plan?.figures).toMatchObject({ lines: 14, newSlots: 1 });
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const labels = (await listEventVendorSlots(planner.organizationId, wedding)).map((slot) => slot.label);
    expect(labels.filter((label) => label === "Papeterie")).toHaveLength(2);
  });

  it("critère 2 : un poste de départ sans ligne demande « garder » ou « retirer » ; retiré, il n'est plus « à trouver »", async () => {
    const planner = await createPlanner();
    const { wedding, importId } = await budgetTakeover(planner);
    const view = await getBudgetDoublonsView(planner.organizationId, importId);
    expect(view?.unusedSlots).toEqual([{ slotId: expect.any(String), label: "Décoration", starter: true, decision: null }]);
    await decideAll(planner, importId);
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const decoration = (await listEventVendorSlots(planner.organizationId, wedding)).find((slot) => slot.label === "Décoration");
    expect(decoration?.status).toBe("not_required");
  });

  it("critère 3 : « Élodie Beauté » est comparée à « Élodie Perrot · Beauté » ; « C'est la même fiche » retient la fiche du carnet sur « Coiffure et maquillage » ; les autres sont retrouvées, jamais doublées", async () => {
    const planner = await createPlanner();
    const { wedding, importId } = await budgetTakeover(planner);
    const view = await getBudgetDoublonsView(planner.organizationId, importId);
    expect(view?.vendors).toMatchObject({ total: 7, found: 6, absent: 0 });
    const [doubt] = view!.vendors.doubts;
    expect(doubt).toMatchObject({ name: "Élodie Beauté", carnet: { name: "Élodie Perrot · Beauté" }, likeness: { sharedWords: ["Élodie", "Beauté"] }, decision: "proposed" });
    await decideAll(planner, importId);
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const candidates = await listEventVendorCandidates(planner.organizationId, wedding);
    const elodie = candidates.find((candidate) => candidate.vendorName === "Élodie Perrot · Beauté");
    expect(elodie?.vendorId).toBe(doubt!.carnet.id);
    const slots = new Map((await listEventVendorSlots(planner.organizationId, wedding)).map((slot) => [slot.id, slot.label]));
    expect(slots.get(elodie!.vendorSlotId)).toBe("Coiffure et maquillage");
    // Chaque prestataire retenu est relié à sa fiche du carnet : aucun nom en double, aucune fiche créée.
    expect(candidates.every((candidate) => candidate.vendorId !== null)).toBe(true);
    expect(new Set(candidates.map((candidate) => candidate.vendorId)).size).toBe(7);
  });

  it("« Ce n'est pas la même : créer une fiche » ajoute une fiche au carnet, que le retrait de l'import retire", async () => {
    const planner = await createPlanner();
    const { importId } = await budgetTakeover(planner);
    await decideAll(planner, importId, { elodie: "create" });
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const preview = await getUndoPreview(planner.organizationId, importId, NOW);
    expect(preview?.summary.leaving.createdFiches).toBe(1);
    expect(await undoImport({ ...planner, importId, now: NOW })).toMatchObject({ status: "done" });
    expect((await getUndoPreview(planner.organizationId, importId, NOW))?.status).toBe("undone");
  });

  it("critère 5 : les nombres de « Vérifier » sont ceux du bilan, et ceux du budget écrit", async () => {
    const planner = await createPlanner();
    const { wedding, importId } = await budgetTakeover(planner);
    await decideAll(planner, importId);
    const plan = await getBudgetImportPlan(planner.organizationId, importId, { now: NOW });
    expect(plan?.figures).toEqual({
      kind: "budget",
      lines: 14,
      slots: 9,
      newSlots: 0,
      plannedCents: 3_645_000,
      realCents: 2_750_200,
      realMissing: 8,
      paidCents: 872_700,
      paidCount: 6,
      toPayCents: 1_877_500,
      toPayCount: 5,
      toPayFrom: "2027-02-20",
      toPayTo: "2027-03-20",
      overdue: 0,
      vendors: 7,
      vendorsOutsideCarnet: 0,
    });
    const applied = await confirmImport({ ...planner, importId, locale: "fr", now: NOW });
    expect(applied.status === "applied" && applied.result.figures).toEqual(plan!.figures);
    // Le bilan relit le journal : les mêmes nombres, mot pour mot.
    expect((await getUndoPreview(planner.organizationId, importId, NOW))?.result?.figures).toEqual(plan!.figures);
    // Le budget écrit redonne ces nombres.
    const lines = (await listBudgetLines(planner.organizationId, wedding)).lines;
    const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
    expect(sum(lines.map((line) => line.estimatedAmountCents))).toBe(3_645_000);
    expect(sum(lines.map((line) => line.committedAmountCents))).toBe(2_750_200);
    const payments = lines.flatMap((line) => line.payments);
    expect(sum(payments.filter((payment) => payment.paidOn !== null).map((payment) => payment.amountCents))).toBe(872_700);
    expect(sum(payments.filter((payment) => payment.paidOn === null).map((payment) => payment.amountCents))).toBe(1_877_500);
  });

  it("critère 5 : sur les autres fichiers du tableur fictif, « Vérifier » et le bilan comptent les mêmes lignes", async () => {
    const planner = await createPlanner({ carnet: false });
    const wedding = await createWedding(planner);
    const importId = await upload(planner, { entityType: "tasks", file: "a-faire.csv", targetEventId: wedding });
    await getImportMatchesView(planner.organizationId, importId);
    await saveQuestionAnswers(planner.organizationId, importId, { pastDueTasks: { answer: "keep" } });
    const preview = await getImportPreview(planner.organizationId, importId);
    const rows = preview!.counts.creations + preview!.counts.updates;
    const applied = await confirmImport({ ...planner, importId, locale: "fr", now: NOW });
    expect(applied.status === "applied" && applied.result.figures).toEqual({ kind: "rows", rows });
  });
});

describe("HUB-14, UX-07 — Retirer un import (lot 71d)", () => {
  async function appliedBudget(planner: Planner) {
    const setup = await budgetTakeover(planner);
    await decideAll(planner, setup.importId);
    expect(await confirmImport({ ...planner, importId: setup.importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    return setup;
  }

  it("critère 6 : « Retirer cet import… » rend le budget d'avant, « Restent » dit exactement ce qui reste, la ligne de reprise repasse « à faire »", async () => {
    const planner = await createPlanner();
    const { wedding, takeoverId, importId } = await appliedBudget(planner);
    expect((await getTakeover(db, planner.organizationId, takeoverId))?.steps.find((step) => step.kind === "budget")?.state).toBe("done");
    const preview = await getUndoPreview(planner.organizationId, importId, NOW);
    expect(preview?.summary).toEqual({
      leaving: { budgetLines: 14, newSlots: [], paidPayments: 6, duePayments: 5, vendors: 7, createdFiches: 0, tasks: 0, events: 0, others: 0 },
      staying: { carnetFiches: 7, carnetSources: [], restoredSlots: ["Décoration"], modified: 0, usedElsewhere: 0 },
    });
    expect(await undoImport({ ...planner, importId, now: NOW })).toMatchObject({ status: "done" });
    expect((await listBudgetLines(planner.organizationId, wedding)).lines).toHaveLength(0);
    // Le poste retiré de ce mariage est remis « à trouver » ; les fiches du carnet restent.
    expect((await listEventVendorSlots(planner.organizationId, wedding)).find((slot) => slot.label === "Décoration")?.status).toBe("to_find");
    expect(await listEventVendorCandidates(planner.organizationId, wedding)).toHaveLength(0);
    const takeover = await getTakeover(db, planner.organizationId, takeoverId);
    expect(takeover?.steps.find((step) => step.kind === "budget")).toMatchObject({ state: "todo", importId: null });
    expect(takeover?.steps.find((step) => step.kind === "event_vendors")?.state).toBe("todo");
  });

  it("critère 6 : une ligne modifiée depuis à la main reste, sauf si la case « Retirer aussi les lignes modifiées depuis » est cochée", async () => {
    for (const forceModified of [false, true]) {
      const planner = await createPlanner();
      const { wedding, importId } = await appliedBudget(planner);
      const [line] = (await listBudgetLines(planner.organizationId, wedding)).lines;
      await withOrganization(db, planner.organizationId, (tx) => tx.update(budgetLines).set({ estimatedAmountCents: 1 }).where(eq(budgetLines.id, line!.id)));
      expect((await getUndoPreview(planner.organizationId, importId, NOW))?.summary.staying.modified).toBe(1);
      expect(await undoImport({ ...planner, importId, forceModified, now: NOW })).toMatchObject({ status: "done" });
      expect((await listBudgetLines(planner.organizationId, wedding)).lines.map((entry) => entry.id)).toEqual(forceModified ? [] : [line!.id]);
    }
  });

  it("critère 7 : le retrait est possible le 89e jour, refusé le 90e et le 91e, avec la date limite", async () => {
    const planner = await createPlanner();
    const { importId } = await appliedBudget(planner);
    // Horloge simulée à partir de l'heure d'écriture (l'heure réelle du journal).
    const appliedAt = (await getUndoPreview(planner.organizationId, importId))!.appliedAt!;
    const at = (days: number) => new Date(appliedAt.getTime() + days * DAY_MS);
    const day89 = await getUndoPreview(planner.organizationId, importId, at(89));
    expect(day89?.undoable).toBe(true);
    expect(day89?.undoDeadline).toEqual(at(90));
    expect((await getUndoPreview(planner.organizationId, importId, at(90)))?.undoable).toBe(false);
    expect(await undoImport({ ...planner, importId, now: at(90) })).toEqual({ status: "expired" });
    expect(await undoImport({ ...planner, importId, now: at(91) })).toEqual({ status: "expired" });
    expect(await undoImport({ ...planner, importId, now: at(89) })).toMatchObject({ status: "done" });
  });

  it("abus : B ne lit, ne décide ni ne retire rien de l'import de A ; un poste de B cité dans une décision est refusé", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const { importId } = await budgetTakeover(a);
    const foreignWedding = await createWedding(b);
    const foreignSlot = (await listEventVendorSlots(b.organizationId, foreignWedding))[0]!;
    expect(await getBudgetDoublonsView(b.organizationId, importId)).toBeNull();
    expect(await decideBudgetDoublons(b.organizationId, importId, { slots: [] })).toBe(false);
    expect(await decideBudgetDoublons(a.organizationId, importId, { slots: [{ slotId: foreignSlot.id, decision: "remove" }] })).toBe(false);
    const view = await getBudgetDoublonsView(a.organizationId, importId);
    const group = view!.groups[0]!;
    expect(await placeBudgetGroup(a.organizationId, importId, { rowIndexes: group.rows.map((row) => row.rowIndex), slotId: foreignSlot.id })).toBe(false);
    // Un nom que l'import n'a pas proposé n'est pas une décision.
    expect(await decideBudgetDoublons(a.organizationId, importId, { vendors: [{ name: "Inconnue", decision: "same" }] })).toBe(false);
    await decideAll(a, importId);
    expect(await confirmImport({ ...b, importId, locale: "fr", now: NOW })).toEqual({ status: "not_found" });
    expect(await confirmImport({ ...a, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    expect(await getUndoPreview(b.organizationId, importId, NOW)).toBeNull();
    expect(await undoImport({ ...b, importId, now: NOW })).toEqual({ status: "not_found" });
    expect((await getUndoPreview(a.organizationId, importId, NOW))?.status).toBe("applied");
  });
});

describe("HUB-14 — Retirer toute la reprise (lot 71d, décision I10, critère 8)", () => {
  async function sheetTakeover(planner: Planner) {
    const takeover = await createTakeover(db, planner);
    const started = await startEventSheetsImport(db, { ...planner, files: [{ fileName: "fiche-evenement-complete.pdf", bytes: readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf") }] });
    if (started.status !== "started") throw new Error(JSON.stringify(started));
    await runImportJobsUntilIdle([planner.organizationId]);
    await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: [] });
    await attachImportToTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "event", importId: started.importId });
    await getImportMatchesView(planner.organizationId, started.importId);
    await saveQuestionAnswers(planner.organizationId, started.importId, { eventStage: "signed" });
    expect(await confirmImport({ ...planner, importId: started.importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const view = await getTakeover(db, planner.organizationId, takeover.id);
    return { takeoverId: takeover.id, sheetId: started.importId, eventId: view!.eventId! };
  }

  async function addBudget(planner: Planner, takeoverId: string, eventId: string, now = NOW) {
    const importId = await upload(planner, { entityType: "budget_lines", file: "budget.csv", targetEventId: eventId });
    await attachImportToTakeoverStep(db, { ...planner, takeoverId, kind: "budget", importId });
    await getImportMatchesView(planner.organizationId, importId);
    await saveQuestionAnswers(planner.organizationId, importId, { depositsPaid: { answer: "yes" }, contracts: { answer: "all" } });
    await decideAll(planner, importId);
    expect(await confirmImport({ ...planner, importId, locale: "fr", now })).toMatchObject({ status: "applied" });
    return importId;
  }

  it("seule, la fiche se retire en retirant le mariage (niveau 2)", async () => {
    const planner = await createPlanner();
    const { sheetId, eventId, takeoverId } = await sheetTakeover(planner);
    expect((await takeoverRemoval(planner.organizationId, sheetId, NOW))?.otherImports).toEqual([]);
    expect(await undoImport({ ...planner, importId: sheetId, forceModified: true, now: NOW })).toMatchObject({ status: "done" });
    expect(await getEvent(planner.organizationId, eventId)).toBeNull();
    expect((await getTakeover(db, planner.organizationId, takeoverId))?.eventId).toBeNull();
  });

  it("avec d'autres imports : « Retirer l'import » laisse place à « Retirer toute la reprise… », qui retire tout en une fois", async () => {
    const planner = await createPlanner();
    const { sheetId, eventId, takeoverId } = await sheetTakeover(planner);
    const budgetId = await addBudget(planner, takeoverId, eventId);
    const removal = await takeoverRemoval(planner.organizationId, sheetId, NOW);
    expect(removal?.otherImports.map((entry) => entry.id)).toEqual([budgetId]);
    expect(removal?.expired).toEqual([]);
    expect(await undoImport({ ...planner, importId: sheetId, now: NOW })).toEqual({ status: "takeover_has_imports" });
    expect(await undoTakeover({ ...planner, importId: sheetId, now: NOW })).toEqual({ status: "done", imports: 2 });
    expect(await getEvent(planner.organizationId, eventId)).toBeNull();
    expect(await getTakeover(db, planner.organizationId, takeoverId)).toBeNull();
    expect(await getEventTakeover(db, planner.organizationId, eventId)).toBeNull();
    // Les fiches du carnet restent.
    expect((await getUndoPreview(planner.organizationId, budgetId, NOW))?.status).toBe("undone");
  });

  it("un échec au milieu : rien n'est retiré", async () => {
    const planner = await createPlanner();
    const { sheetId, eventId, takeoverId } = await sheetTakeover(planner);
    const budgetId = await addBudget(planner, takeoverId, eventId);
    const failing = async () => {
      throw new Error("panne simulée");
    };
    expect(await undoTakeover({ ...planner, importId: sheetId, now: NOW, afterEachImport: failing })).toEqual({ status: "failed" });
    expect(await getEvent(planner.organizationId, eventId)).not.toBeNull();
    expect((await listBudgetLines(planner.organizationId, eventId)).lines).toHaveLength(14);
    expect((await getUndoPreview(planner.organizationId, budgetId, NOW))?.status).toBe("applied");
    expect((await getTakeover(db, planner.organizationId, takeoverId))?.eventId).toBe(eventId);
  });

  it("un import au-delà de 90 jours : le retrait d'ensemble n'est pas proposé, et la raison nomme l'import", async () => {
    const planner = await createPlanner();
    const { sheetId, eventId, takeoverId } = await sheetTakeover(planner);
    await addBudget(planner, takeoverId, eventId);
    const later = new Date(NOW.getTime() + 95 * DAY_MS);
    expect((await takeoverRemoval(planner.organizationId, sheetId, later))?.expired).toEqual(["budget.csv", "fiche-evenement-complete.pdf"]);
    expect(await undoTakeover({ ...planner, importId: sheetId, now: later })).toEqual({ status: "expired", files: ["budget.csv", "fiche-evenement-complete.pdf"] });
    expect(await getEvent(planner.organizationId, eventId)).not.toBeNull();
  });

  it("abus : B ne retire pas toute la reprise de A", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const { sheetId, eventId, takeoverId } = await sheetTakeover(a);
    await addBudget(a, takeoverId, eventId);
    expect(await takeoverRemoval(b.organizationId, sheetId, NOW)).toBeNull();
    expect(await undoTakeover({ ...b, importId: sheetId, now: NOW })).toEqual({ status: "not_found" });
    expect(await getEvent(a.organizationId, eventId)).not.toBeNull();
  });
});
