// Lot 71c (HUB-14, BUD-01, EVT-01, EVT-05, CHR-01, CHR-02, UX-10 ; spécification du lot 71, § 5.3 ;
// maquette 07) — l'assistant qui demande, contre un vrai PostgreSQL, sur les fichiers fictifs du tableur
// de la planner : chaque question, chaque réponse et ce qu'elle écrit, à l'horloge simulée. Règle de
// fond : un import ne crée ni retard ni relance ; ce que le fichier ne dit pas reste « non renseigné ».
// Tests d'abus : « Pour quel mariage ? » ne propose jamais un mariage d'une autre organisation, et un
// identifiant d'une autre organisation posté à la main est refusé.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventTasks, events as eventsTable } from "@symbola/db/schema/events";
import { importItems } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { listBudgetLines } from "@/modules/budget/service";
import { paymentStatus } from "@/modules/budget/payments";
import {
  addDefaultVendorSlots,
  addTaskTemplateItem,
  applyTaskTemplate,
  createEventType,
  createProspect,
  createProspectSource,
  createTaskTemplate,
  getEvent,
  listEventVendorSlots,
  listUncontractedVendors,
  startExampleEvent,
  TemplatePastDueUnansweredError,
} from "@/modules/events/service";
import { attachImportToTakeoverStep, createTakeover, decideFreeColumns, getEventTakeover, getImportColumns, saveImportMapping, startEventSheetsImport, startImport } from "@/modules/hub/service";
import { runImportJobsUntilIdle } from "../import-jobs";
import { confirmImport, getImportPreview } from "./apply";
import { getImportGapsView } from "./gaps";
import { decideMatches, getImportMatchesView } from "./matching";
import { getImportQuestions, ImportTargetEventNotFoundError, saveQuestionAnswers } from "./questions";
import { getImportWizard } from "./wizard";

const { sql, db } = createAppConnection();
// Le lendemain de la reprise de Camille (maquette 07) : « Trouver un vidéaste » est en retard de 5 jours.
const NOW = new Date("2026-11-25T08:00:00Z");
const TODAY = "2026-11-25";

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}
type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function createWedding(planner: Planner, firstName = "Juliette", eventDate = "2027-03-20") {
  const source = await createProspectSource(planner.organizationId, `Salon ${randomUUID().slice(0, 6)}`);
  const { id } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: source.id, clients: [{ firstName, lastName: "Exemple" }], eventDate });
  return id;
}

const corpus = (name: string) => readImportCorpusFile(`tableur-planner/${name}`);

// Un fichier lu et ses colonnes proposées, comme les choisit l'écran « Colonnes ».
async function upload(planner: Planner, input: { entityType: "budget_lines" | "tasks"; file: string; targetEventId?: string }) {
  const started = await startImport(db, { ...planner, entityType: input.entityType, fileName: input.file, bytes: corpus(input.file), ...(input.targetEventId ? { targetEventId: input.targetEventId } : {}) });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  const view = await getImportColumns(db, planner.organizationId, started.importId);
  const saved = await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId: started.importId,
    choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "ignore", confirmed: true })),
  });
  if (saved.status !== "saved") throw new Error(JSON.stringify(saved));
  await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: [] });
  // L'assistant calcule les rapprochements dès les colonnes faites.
  await getImportMatchesView(planner.organizationId, started.importId);
  return started.importId;
}

async function acceptProposals(planner: Planner, importId: string) {
  const matches = await getImportMatchesView(planner.organizationId, importId);
  const proposed = matches!.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const }));
  if (proposed.length > 0) await decideMatches(planner.organizationId, importId, proposed);
}

async function payments(planner: Planner, eventId: string) {
  const list = (await listBudgetLines(planner.organizationId, eventId)).lines.flatMap((line) => line.payments);
  return {
    paidCents: list.filter((payment) => payment.paidOn !== null).reduce((sum, payment) => sum + payment.amountCents, 0),
    dueCents: list.filter((payment) => payment.paidOn === null).reduce((sum, payment) => sum + payment.amountCents, 0),
    lateCount: list.filter((payment) => paymentStatus(payment, "2026-11-24") === "overdue").length,
  };
}

async function sheetImport(planner: Planner) {
  const started = await startEventSheetsImport(db, { ...planner, files: [{ fileName: "fiche-evenement-complete.pdf", bytes: readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf") }] });
  if (started.status !== "started") throw new Error(JSON.stringify(started));
  await runImportJobsUntilIdle([planner.organizationId]);
  await decideFreeColumns(db, { organizationId: planner.organizationId, importId: started.importId, decisions: [] });
  await getImportMatchesView(planner.organizationId, started.importId);
  return started.importId;
}

describe("HUB-14 — L'assistant demande au lieu de rejeter (lot 71c)", () => {
  it("critère 1 : un budget sans colonne évènement n'est jamais rejeté faute de mariage ; « Un mariage pas encore dans Symbola » crée le mariage et sa reprise à l'écriture", async () => {
    const planner = await createPlanner();
    // Les postes de départ de l'agence : les lignes du fichier s'y rangent, même pour un mariage à créer.
    await addDefaultVendorSlots(planner.organizationId, ["Lieu", "Traiteur"]);
    const existing = await createWedding(planner, "Léa", "2027-01-30");
    const importId = await upload(planner, { entityType: "budget_lines", file: "budget.csv" });

    const view = await getImportQuestions(planner.organizationId, importId, { now: NOW });
    expect(view?.asked.targetEvent).toBe(true);
    expect(view?.targetEvent?.options.map((option) => option.id)).toEqual([existing]);
    // La question vient en premier : la frise s'arrête à « Questions », pas au quatrième écran.
    expect((await getImportWizard(planner.organizationId, importId, NOW))?.next).toBe("questions");

    expect(await saveQuestionAnswers(planner.organizationId, importId, { newEvent: { name: "Clara & Yanis", eventDate: "2027-06-05" }, depositsPaid: { answer: "yes" }, contracts: { answer: "all" } })).toBe(true);
    // Aucune ligne n'est rejetée « introuvable » : toutes vont au mariage à créer.
    expect((await getImportGapsView(planner.organizationId, importId))?.rejected).toEqual([]);
    const preview = await getImportPreview(planner.organizationId, importId);
    expect(preview?.rejectedCount).toBe(0);
    expect((await getImportWizard(planner.organizationId, importId, NOW))?.steps.find((step) => step.key === "questions")?.done).toBe(true);
    await acceptProposals(planner, importId);

    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied", result: { created: 14 } });
    const [item] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(importItems).where(and(eq(importItems.importId, importId), eq(importItems.kind, "budget_line"))));
    const lines = await withOrganization(db, planner.organizationId, (tx) => tx.select({ id: eventsTable.id, name: eventsTable.name, origin: eventsTable.origin, eventDate: eventsTable.eventDate }).from(eventsTable).where(eq(eventsTable.name, "Clara & Yanis")));
    expect(lines).toHaveLength(1);
    const created = lines[0]!;
    expect(created).toMatchObject({ origin: "takeover", eventDate: "2027-06-05" });
    expect(item).toBeDefined();
    expect((await listBudgetLines(planner.organizationId, created.id)).lines).toHaveLength(14);
    // Rangées sous les postes de l'agence : un seul « Lieu » et un seul « Traiteur » dans le mariage créé.
    const slots = (await listEventVendorSlots(planner.organizationId, created.id)).map((slot) => slot.label);
    expect(slots.filter((label) => label === "Lieu")).toHaveLength(1);
    expect(slots.filter((label) => label === "Traiteur")).toHaveLength(1);
    expect((await getEvent(planner.organizationId, created.id))?.status).toBe("confirmed");
    const takeover = await getEventTakeover(db, planner.organizationId, created.id);
    expect(takeover?.steps.find((step) => step.kind === "budget")).toMatchObject({ state: "done", importId });
    expect(takeover?.steps.find((step) => step.kind === "event")?.state).toBe("done");
    // Le mariage existant n'a rien reçu.
    expect((await listBudgetLines(planner.organizationId, existing)).lines).toHaveLength(0);
  });

  it("critère 1 : choisir un mariage existant y range les 14 lignes ; un mariage d'une autre organisation n'est jamais proposé, et posté à la main il est refusé", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const mine = await createWedding(a);
    const foreign = await createWedding(b, "Inès");
    const example = await startExampleEvent({ organizationId: a.organizationId, userId: a.userId, locale: "fr", now: new Date() });
    const importId = await upload(a, { entityType: "budget_lines", file: "budget.csv" });

    const options = (await getImportQuestions(a.organizationId, importId, { now: NOW }))!.targetEvent!.options.map((option) => option.id);
    expect(options).toContain(mine);
    expect(options).not.toContain(foreign);
    // Un essai guidé n'est jamais visé par un import.
    expect(options).not.toContain(example.eventId);
    await expect(saveQuestionAnswers(a.organizationId, importId, { targetEvent: foreign })).rejects.toBeInstanceOf(ImportTargetEventNotFoundError);
    await expect(saveQuestionAnswers(a.organizationId, importId, { targetEvent: example.eventId })).rejects.toBeInstanceOf(ImportTargetEventNotFoundError);
    // B ne répond pas aux questions de l'import de A, et ne les lit pas.
    expect(await saveQuestionAnswers(b.organizationId, importId, { depositsPaid: { answer: "yes" } })).toBe(false);
    expect(await getImportQuestions(b.organizationId, importId, { now: NOW })).toBeNull();

    expect(await saveQuestionAnswers(a.organizationId, importId, { targetEvent: mine, depositsPaid: { answer: "no" }, contracts: { answer: "none" } })).toBe(true);
    const view = await getImportQuestions(a.organizationId, importId, { now: NOW });
    // La question reste, avec sa réponse : la planner peut en changer.
    expect(view?.asked.targetEvent).toBe(true);
    expect(view?.missing).toEqual([]);
    await acceptProposals(a, importId);
    expect(await confirmImport({ ...a, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    expect((await listBudgetLines(a.organizationId, mine)).lines).toHaveLength(14);
    expect((await listBudgetLines(b.organizationId, foreign)).lines).toHaveLength(0);
  });

  it("critère 2 : depuis la page de reprise, le mariage n'est pas demandé ; il est écrit en tête", async () => {
    const planner = await createPlanner();
    const wedding = await createWedding(planner);
    const takeover = await createTakeover(db, { ...planner, eventId: wedding });
    const importId = await upload(planner, { entityType: "budget_lines", file: "budget.csv", targetEventId: wedding });
    await attachImportToTakeoverStep(db, { ...planner, takeoverId: takeover.id, kind: "budget", importId });
    const view = await getImportQuestions(planner.organizationId, importId, { now: NOW });
    expect(view?.asked.targetEvent).toBe(false);
    expect(view?.targetEvent).toBeNull();
    expect(view?.fixedEvent).toMatchObject({ name: "Juliette", eventDate: "2027-03-20", fromTakeover: true });
  });

  it("critère 3 : aucune réponse n'est supposée ; sans elles rien n'est écrit, et chaque réponse écrit ce qu'elle annonçait", async () => {
    for (const answer of ["yes", "no"] as const) {
      const planner = await createPlanner();
      const wedding = await createWedding(planner);
      const importId = await upload(planner, { entityType: "budget_lines", file: "budget.csv", targetEventId: wedding });
      const view = await getImportQuestions(planner.organizationId, importId, { now: new Date("2026-11-24T08:00:00Z") });
      expect(view?.answers).toBeNull();
      expect(view?.missing.map((entry) => entry.key)).toEqual(["depositsPaid", "contracts"]);
      await acceptProposals(planner, importId);
      expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toEqual({ status: "blocked", blockers: ["questions_pending"] });
      expect((await listBudgetLines(planner.organizationId, wedding)).lines).toHaveLength(0);

      await saveQuestionAnswers(planner.organizationId, importId, { depositsPaid: { answer }, contracts: { answer: "all" } });
      expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
      // L'annonce de la question = ce qui est écrit (réglé, reste à payer, en retard au 24/11/2026).
      expect(await payments(planner, wedding)).toEqual(view!.deposits!.figures[answer]);
      // Un import ne crée aucune relance « à faire signer ».
      expect(await listUncontractedVendors(planner.organizationId, "2026-11-24")).toEqual([]);
    }
  });

  it("critère 4 : « Certains seulement » coche ligne par ligne et le total réglé suit", async () => {
    const planner = await createPlanner();
    const wedding = await createWedding(planner);
    const importId = await upload(planner, { entityType: "budget_lines", file: "budget.csv", targetEventId: wedding });
    const view = await getImportQuestions(planner.organizationId, importId, { now: NOW });
    const deposits = view!.deposits!.rows;
    const paidRows = deposits.slice(0, 5).map((row) => row.rowIndex);
    await saveQuestionAnswers(planner.organizationId, importId, { depositsPaid: { answer: "some", paidRows }, contracts: { answer: "per_line", signedRows: [] } });
    await acceptProposals(planner, importId);
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const written = await payments(planner, wedding);
    expect(written.paidCents).toBe(deposits.slice(0, 5).reduce((sum, row) => sum + row.amountCents, 0));
    // Le dernier acompte, non coché, reste dû et passé : la seule échéance en retard.
    expect(written.lateCount).toBe(1);
  });

  it("critère 5 : la fiche d'un espace à un seul type ne demande pas le type ; à plusieurs, elle le demande", async () => {
    const one = await createPlanner();
    await createEventType(one.organizationId, { label: "Mariage", audience: "couple" });
    const oneView = await getImportQuestions(one.organizationId, await sheetImport(one), { now: NOW });
    expect(oneView?.asked).toMatchObject({ eventType: false, eventStage: true, prospectSource: true });
    expect(oneView?.onlyEventType).toBe("Mariage");

    const many = await createPlanner();
    const wedding = await createEventType(many.organizationId, { label: "Mariage", audience: "couple" });
    await createEventType(many.organizationId, { label: "Baptême", audience: "couple" });
    const importId = await sheetImport(many);
    const manyView = await getImportQuestions(many.organizationId, importId, { now: NOW });
    expect(manyView?.asked.eventType).toBe(true);
    expect(manyView?.eventType?.options.map((option) => option.label).sort()).toEqual(["Baptême", "Mariage"]);
    expect(manyView?.missing.map((entry) => entry.key)).toEqual(["eventType", "eventStage"]);
    // Les noms à la casse de l'app, montrés avant (« Léa MARTIN » → « Léa Martin »).
    expect(manyView?.sheets[0]?.clients.map((client) => client.written)).toEqual(["Léa Martin", "Hugo Bernard"]);
    await saveQuestionAnswers(many.organizationId, importId, { eventTypeId: wedding.id, eventStage: "enquiry" });
    expect(await confirmImport({ ...many, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const [created] = await withOrganization(db, many.organizationId, (tx) => tx.select().from(eventsTable));
    expect(created).toMatchObject({ eventTypeId: wedding.id, status: "option" });
  });

  it("critère 6 : la source laissée vide est « non renseignée » et l'import passe ; une source d'une autre organisation n'est pas reprise", async () => {
    const planner = await createPlanner();
    const other = await createPlanner();
    await createEventType(planner.organizationId, { label: "Mariage", audience: "couple" });
    const importId = await sheetImport(planner);
    const foreign = await createProspectSource(other.organizationId, "Salon d'ailleurs");
    await saveQuestionAnswers(planner.organizationId, importId, { eventStage: "signed", prospectSourceId: foreign.id });
    expect((await getImportQuestions(planner.organizationId, importId, { now: NOW }))?.missing).toEqual([]);
    expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied" });
    const [created] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventsTable));
    expect(created).toMatchObject({ prospectSourceId: null, status: "confirmed" });
  });

  describe("critère 7 : a-faire.csv, reconnu d'office, et les deux échéances passées", () => {
    for (const [answer, expected] of [
      ["keep", { late: 2, redated: 0, done: 5 }],
      ["redate", { late: 0, redated: 2, done: 5 }],
      ["done", { late: 0, redated: 0, done: 7 }],
    ] as const) {
      it(`« ${answer} » donne ce qu'il annonce : ${expected.late} en retard, ${expected.redated} redatées, ${expected.done} faites`, async () => {
        const planner = await createPlanner();
        const wedding = await createWedding(planner);
        const importId = await upload(planner, { entityType: "tasks", file: "a-faire.csv", targetEventId: wedding });
        const columns = await getImportColumns(db, planner.organizationId, importId);
        expect(columns!.columns.map((column) => column.proposedFieldKey)).toEqual(["done", "label", "dueDate", "responsible"]);
        const view = await getImportQuestions(planner.organizationId, importId, { now: NOW });
        expect(view?.pastDue?.tasks.map((task) => task.label)).toEqual(["Trouver un vidéaste", "Relancer les trois devis de navette"]);
        expect(view?.missing).toEqual([{ key: "pastDueTasks", code: "choose" }]);
        await saveQuestionAnswers(planner.organizationId, importId, { pastDueTasks: answer === "redate" ? { answer, date: "2026-12-04" } : { answer } });
        await acceptProposals(planner, importId);
        expect(await confirmImport({ ...planner, importId, locale: "fr", now: NOW })).toMatchObject({ status: "applied", result: { created: 17 } });
        const tasks = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, wedding)));
        expect({
          late: tasks.filter((task) => task.doneAt === null && task.dueDate < TODAY).length,
          redated: tasks.filter((task) => task.dueDate === "2026-12-04").length,
          done: tasks.filter((task) => task.doneAt !== null).length,
        }).toEqual(expected);
        // Faites avant la reprise : date de fin non renseignée, sans auteur.
        expect(tasks.filter((task) => task.doneAt !== null).every((task) => !task.doneDateKnown && task.doneByUserId === null)).toBe(true);
      });
    }

    it("horloge simulée : la veille de l'échéance, rien n'est passé ; le jour même non plus ; le lendemain, si", async () => {
      const planner = await createPlanner();
      const wedding = await createWedding(planner);
      const importId = await upload(planner, { entityType: "tasks", file: "a-faire.csv", targetEventId: wedding });
      // « Trouver un vidéaste » est due le 20/11/2026.
      expect((await getImportQuestions(planner.organizationId, importId, { now: new Date("2026-11-19T12:00:00Z") }))?.pastDue).toBeNull();
      expect((await getImportQuestions(planner.organizationId, importId, { now: new Date("2026-11-20T22:30:00Z") }))?.pastDue).toBeNull();
      expect((await getImportQuestions(planner.organizationId, importId, { now: new Date("2026-11-20T23:30:00Z") }))?.pastDue?.tasks).toHaveLength(1);
    });
  });

  it("critère 8 : aucun modèle de tâches n'est appliqué à un mariage repris, sauf par « Partir d'un modèle », qui pose la même question sur les échéances passées", async () => {
    const planner = await createPlanner();
    const template = await createTaskTemplate(planner.organizationId, "Mariage", [
      { label: "Réserver le lieu", offsetDays: -300, responsible: "planner" },
      { label: "Choisir le traiteur", offsetDays: -200, responsible: "planner" },
      { label: "Plan de table", offsetDays: -20, responsible: "clients" },
    ]);
    await addTaskTemplateItem(planner.organizationId, template.id, { label: "Feuilles de route", offsetDays: -7, responsible: "planner" });
    // Repris : Confirmé, sans tâche, même si un modèle est cité.
    const { id: taken } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: null, clients: [], name: "Juliette & Romain", eventDate: "2027-03-20", takeover: true, taskTemplateId: template.id });
    const count = async () => (await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, taken)))).length;
    expect(await count()).toBe(0);

    // Au 25/11/2026, « Réserver le lieu » (24/05/2026) et « Choisir le traiteur » (01/09/2026) sont passées.
    await expect(applyTaskTemplate(planner.organizationId, taken, template.id, { now: NOW })).rejects.toBeInstanceOf(TemplatePastDueUnansweredError);
    await expect(applyTaskTemplate(planner.organizationId, taken, template.id, { now: NOW, pastDue: { answer: "redate", date: "2026-11-24" } })).rejects.toBeInstanceOf(TemplatePastDueUnansweredError);
    expect(await count()).toBe(0);
    await applyTaskTemplate(planner.organizationId, taken, template.id, { now: NOW, pastDue: { answer: "done" } });
    const tasks = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, taken)));
    expect(tasks.filter((task) => task.doneAt !== null).map((task) => task.label).sort()).toEqual(["Choisir le traiteur", "Réserver le lieu"]);
    expect(tasks.filter((task) => task.doneAt !== null).every((task) => !task.doneDateKnown && task.doneByUserId === null)).toBe(true);
    expect(tasks.filter((task) => task.doneAt === null && task.dueDate < TODAY)).toEqual([]);

    // Un mariage créé dans Symbola : la règle d'avant, sans question.
    const created = await createWedding(planner, "Inès", "2027-03-20");
    await applyTaskTemplate(planner.organizationId, created, template.id, { now: NOW });
    const own = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.eventId, created)));
    expect(own.filter((task) => task.doneAt === null && task.dueDate < TODAY)).toHaveLength(2);
  });
});
