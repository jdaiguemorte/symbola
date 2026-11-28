// Lot 71c (HUB-14, BUD-01, CHR-01, CHR-02 ; spécification du lot 71, § 5.3 ; maquette 07) — les règles
// de l'étape « Questions », sur les fichiers fictifs du tableur de la planner, à l'horloge simulée.
import { IMPORT_FIELDS } from "@symbola/contracts";
import { parseImportRows, proposeMapping, readImportFile } from "@symbola/import-engine";
import { starterBudgetImportPaymentLabels, starterImportSynonyms } from "@symbola/starter-templates";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { describe, expect, it } from "vitest";
import { importedPaymentSchedule } from "@/modules/budget/service";
import {
  applyPastDueAnswer,
  budgetUnderstood,
  contractFigures,
  contractVendors,
  depositFigures,
  depositsQuestion,
  missingAnswers,
  needsTargetEvent,
  pastDueTasksQuestion,
  tasksUnderstood,
  type AskedQuestions,
  type PaymentScheduleFn,
} from "./question-rules";

const labels = starterBudgetImportPaymentLabels("fr");
const schedule: PaymentScheduleFn = (values, depositPaid) => importedPaymentSchedule(values, labels, depositPaid);

function corpusRows(file: string, entityType: "budget_lines" | "tasks") {
  const read = readImportFile(readImportCorpusFile(`tableur-planner/${file}`), { maxBytes: 10 * 1024 * 1024, maxRows: 5000 });
  if (!read.ok) throw new Error(read.reason);
  const synonyms = starterImportSynonyms();
  const proposals = proposeMapping({ headers: read.table.headers, rows: read.table.rows, fields: IMPORT_FIELDS[entityType], synonyms: synonyms.columns });
  const assignments = proposals.map((proposal) => ({ columnIndex: proposal.columnIndex, fieldKey: proposal.fieldKey, target: proposal.fieldKey ? ("field" as const) : ("ignore" as const) }));
  const rows = parseImportRows({ headers: read.table.headers, rows: read.table.rows, sourceLineNumbers: read.table.sourceLineNumbers, assignments, fields: IMPORT_FIELDS[entityType], synonyms });
  return { rows, mapped: new Set(proposals.flatMap((proposal) => (proposal.fieldKey ? [proposal.fieldKey] : []))), raw: read.table };
}

const none: AskedQuestions = { targetEvent: false, depositsPaid: false, contracts: false, eventType: false, eventStage: false, prospectSource: false, pastDueTasks: false };

describe("HUB-14 — L'assistant demande au lieu de rejeter (lot 71c)", () => {
  describe("critère 1 : le mariage visé est demandé, jamais rejeté", () => {
    it("un budget sans colonne qui nomme le mariage, hors reprise, demande « Pour quel mariage ? »", () => {
      const { mapped } = corpusRows("budget.csv", "budget_lines");
      expect(needsTargetEvent({ entityType: "budget_lines", mappedFields: mapped, targetEventId: null })).toBe(true);
      expect(needsTargetEvent({ entityType: "tasks", mappedFields: new Set(["label", "dueDate"]), targetEventId: null })).toBe(true);
    });
    it("critère 2 : depuis la page de reprise (mariage connu), la question n'est pas posée", () => {
      const { mapped } = corpusRows("budget.csv", "budget_lines");
      expect(needsTargetEvent({ entityType: "budget_lines", mappedFields: mapped, targetEventId: "4e2c7f0a-0000-4000-8000-000000000001" })).toBe(false);
    });
    it("un fichier avec une colonne qui nomme le mariage garde le rattachement ligne par ligne", () => {
      expect(needsTargetEvent({ entityType: "budget_lines", mappedFields: new Set(["slotLabel", "plannedAmount", "client1FirstName"]), targetEventId: null })).toBe(false);
      expect(needsTargetEvent({ entityType: "vendors", mappedFields: new Set(["name"]), targetEventId: null })).toBe(false);
    });
    it("« Un mariage pas encore dans Symbola » sans nom écrit ce qui manque sous la question", () => {
      const asked = { ...none, targetEvent: true };
      expect(missingAnswers(asked, {}, "2026-11-24")).toEqual([{ key: "targetEvent", code: "choose" }]);
      expect(missingAnswers(asked, { newEvent: { name: " ", eventDate: null } }, "2026-11-24")).toEqual([{ key: "targetEvent", code: "name_required" }]);
      expect(missingAnswers(asked, { newEvent: { name: "Clara & Yanis", eventDate: "2027-06-05" } }, "2026-11-24")).toEqual([]);
    });
  });

  describe("critère 3 : chaque réponse affiche son résultat, recalculé sur le fichier", () => {
    it("budget.csv au 24/11/2026 : « Oui » donne 8 727,00 € réglés, 18 775,00 € à payer, aucune en retard ; « Non », 0 €, 27 502,00 €, 6 en retard", () => {
      const { rows, mapped } = corpusRows("budget.csv", "budget_lines");
      const question = depositsQuestion(rows, mapped, "2026-11-24", schedule);
      expect(question?.rows).toHaveLength(6);
      expect(question?.dates).toEqual({ from: "2026-09-05", to: "2026-11-12" });
      expect(question?.figures.yes).toEqual({ paidCents: 872700, dueCents: 1877500, lateCount: 0 });
      expect(question?.figures.no).toEqual({ paidCents: 0, dueCents: 2750200, lateCount: 6 });
    });
    it("horloge simulée : un acompte dû aujourd'hui n'est pas en retard, il l'est le lendemain", () => {
      const values = { slotLabel: "Lieu", plannedAmount: 100000, depositAmount: 30000, depositDueOn: "2027-03-28", balanceAmount: 70000, balanceDueOn: "2027-04-10" };
      const rows = [{ rowIndex: 0, lineNumber: 2, values }];
      const mapped = new Set(["slotLabel", "plannedAmount", "depositAmount", "depositDueOn", "balanceAmount", "balanceDueOn"]);
      // 28/03/2027 : jour du passage à l'heure d'été ; les dates sans heure n'en dépendent pas.
      expect(depositsQuestion(rows, mapped, "2027-03-27", schedule)?.figures.no.lateCount).toBe(0);
      expect(depositsQuestion(rows, mapped, "2027-03-28", schedule)?.figures.no.lateCount).toBe(0);
      expect(depositsQuestion(rows, mapped, "2027-03-29", schedule)?.figures.no.lateCount).toBe(1);
    });
    it("rien ne dit déjà « payé » : avec une colonne « Réglé », la question n'est pas posée", () => {
      const { rows, mapped } = corpusRows("budget.csv", "budget_lines");
      expect(depositsQuestion(rows, new Set([...mapped, "paidAmount"]), "2026-11-24", schedule)).toBeNull();
    });
    it("aucune question n'a de réponse cochée d'avance : sans réponse, chacune manque", () => {
      const asked: AskedQuestions = { targetEvent: true, depositsPaid: true, contracts: true, eventType: true, eventStage: true, prospectSource: true, pastDueTasks: true };
      // La source est facultative : elle ne manque jamais.
      expect(missingAnswers(asked, null, "2026-11-24").map((entry) => entry.key)).toEqual(["targetEvent", "depositsPaid", "contracts", "eventType", "eventStage", "pastDueTasks"]);
    });
  });

  it("critère 4 : « Certains seulement » coche ligne par ligne et le total réglé suit", () => {
    const { rows, mapped } = corpusRows("budget.csv", "budget_lines");
    const question = depositsQuestion(rows, mapped, "2026-11-24", schedule)!;
    // Tous sauf l'acompte de la papeterie (812,00 €) : 5 payés sur 6, réglé 7 915,00 €.
    const papeterie = question.rows.find((row) => row.amountCents === 81200)!;
    const paid = new Set(question.rows.filter((row) => row !== papeterie).map((row) => row.rowIndex));
    expect(depositFigures(rows, paid, "2026-11-24", schedule)).toEqual({ paidCents: 791500, dueCents: 1958700, lateCount: 1 });
    expect(depositFigures(rows, new Set(), "2026-11-24", schedule)).toEqual(question.figures.no);
  });

  it("I1 : un budget qui nomme ses prestataires demande leurs contrats ; un nom sur deux lignes est un prestataire", () => {
    const { rows } = corpusRows("budget.csv", "budget_lines");
    const vendors = contractVendors(rows);
    expect(vendors.map((vendor) => vendor.name)).toEqual([
      "Domaine de la Roche Fictive",
      "Maison Bellerive",
      "Atelier Pivoine",
      "Studio Clair-Obscur",
      "Nuit Blanche Sono",
      "Atelier Papier Plié",
      "Élodie Beauté",
    ]);
    expect(contractFigures(vendors, { answer: "all" })).toEqual({ signed: 7, unsigned: 0 });
    expect(contractFigures(vendors, { answer: "none" })).toEqual({ signed: 0, unsigned: 7 });
    expect(contractFigures(vendors, { answer: "per_line", signedRows: vendors[1]!.rowIndexes })).toEqual({ signed: 1, unsigned: 6 });
  });

  describe("critère 7 : a-faire.csv, les deux échéances passées", () => {
    it("au 25/11/2026, « Trouver un vidéaste » (20/11) et « Relancer les trois devis de navette » (23/11) sont passées ; 5 faites sur 17", () => {
      const { rows } = corpusRows("a-faire.csv", "tasks");
      expect(pastDueTasksQuestion(rows, "2026-11-25")).toEqual({
        tasks: [
          { rowIndex: 5, label: "Trouver un vidéaste", dueDate: "2026-11-20" },
          { rowIndex: 6, label: "Relancer les trois devis de navette", dueDate: "2026-11-23" },
        ],
        doneCount: 5,
        total: 17,
      });
    });
    it("horloge simulée : une tâche due aujourd'hui n'est pas passée ; la veille non plus ; le lendemain, si", () => {
      const rows = [{ rowIndex: 0, lineNumber: 2, values: { label: "Essai", dueDate: "2027-03-28", done: false } }];
      expect(pastDueTasksQuestion(rows, "2027-03-27")).toBeNull();
      expect(pastDueTasksQuestion(rows, "2027-03-28")).toBeNull();
      expect(pastDueTasksQuestion(rows, "2027-03-29")?.tasks).toHaveLength(1);
    });
    it("chaque réponse donne ce qu'elle annonce : 2 en retard, 2 redatées, 7 faites", () => {
      const { rows } = corpusRows("a-faire.csv", "tasks");
      const today = "2026-11-25";
      const late = (list: typeof rows) => list.filter((row) => row.values.done !== true && String(row.values.dueDate) < today).length;
      const done = (list: typeof rows) => list.filter((row) => row.values.done === true).length;
      expect(late(applyPastDueAnswer(rows, { answer: "keep" }, today))).toBe(2);
      const redated = applyPastDueAnswer(rows, { answer: "redate", date: "2026-12-04" }, today);
      expect(late(redated)).toBe(0);
      expect(redated.filter((row) => row.values.dueDate === "2026-12-04").map((row) => row.values.label)).toEqual(["Trouver un vidéaste", "Relancer les trois devis de navette"]);
      expect(done(applyPastDueAnswer(rows, { answer: "done" }, today))).toBe(7);
      expect(late(applyPastDueAnswer(rows, { answer: "done" }, today))).toBe(0);
    });
    it("« Leur donner une nouvelle date » sans date, ou avec une date passée, dit ce qui manque", () => {
      const asked = { ...none, pastDueTasks: true };
      expect(missingAnswers(asked, { pastDueTasks: { answer: "redate" } }, "2026-11-25")).toEqual([{ key: "pastDueTasks", code: "date_required" }]);
      expect(missingAnswers(asked, { pastDueTasks: { answer: "redate", date: "2026-11-24" } }, "2026-11-25")).toEqual([{ key: "pastDueTasks", code: "date_past" }]);
      expect(missingAnswers(asked, { pastDueTasks: { answer: "redate", date: "2026-11-25" } }, "2026-11-25")).toEqual([]);
    });
  });

  describe("« Ce que Symbola a compris »", () => {
    it("budget.csv : poste de la ligne du dessus, soldes à venir, réel vide non renseigné, prestataires retenus", () => {
      const { rows, mapped } = corpusRows("budget.csv", "budget_lines");
      expect(budgetUnderstood(rows, mapped, "2026-11-24")).toEqual([
        // La maquette dit « 8 lignes » et « 7 lignes » pour illustrer ; le fichier fictif en a 6 et 8.
        { key: "carriedSlot", count: 6 },
        { key: "balances", count: 5, from: "2027-02-20", to: "2027-03-20", upcoming: true },
        { key: "actualEmpty", count: 8 },
        { key: "vendorsRetained", count: 7 },
      ]);
    });
    it("a-faire.csv : « x » → Faite (5), vide → À faire (12), « moi » → Vous, « mariés » → Les mariés, échéances du 15/09/2026 au 19/03/2027", () => {
      const { rows, raw } = corpusRows("a-faire.csv", "tasks");
      const who = raw.headers.indexOf("Qui");
      const rawResponsible = new Map(rows.map((row) => [row.rowIndex, raw.rows[row.rowIndex]?.[who] ?? ""]));
      expect(tasksUnderstood(rows, rawResponsible)).toEqual([
        { key: "taskDone", count: 5 },
        { key: "taskTodo", count: 12 },
        { key: "taskPlanner", values: ["moi"] },
        { key: "taskClients", values: ["mariés"] },
        { key: "taskDue", from: "2026-09-15", to: "2027-03-19" },
      ]);
    });
  });
});
