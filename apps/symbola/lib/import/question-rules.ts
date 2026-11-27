// Lot 71c (HUB-14, BUD-01, EVT-01, EVT-05, CHR-01, CHR-02, UX-10 ; spécification du lot 71, § 5.3 ;
// maquette 07) — les règles de l'étape « Questions » de l'assistant d'import, sans base : quelles
// questions le fichier appelle, ce que chaque réponse donnera en euros ou en nombre, ce qui manque
// avant de continuer, et ce que Symbola a compris seul. Règle de fond : un import ne crée ni retard ni
// relance ; ce qui était payé, signé ou fait le reste ; ce que le fichier ne dit pas reste « non
// renseigné ». Aucune réponse n'est cochée d'avance (R5), aucune question ne renvoie au fichier.
import type { ImportAnswers, ImportQuestionKey } from "@symbola/contracts";
import type { ImportValue } from "@symbola/import-engine";

export type QuestionRow = {
  rowIndex: number;
  lineNumber: number;
  values: Record<string, ImportValue>;
  // Champs repris de la ligne du dessus (lot 67a).
  carried?: Record<string, number>;
};

// L'échéancier qu'écrira le budget pour une ligne (modules/budget, `importedPaymentSchedule`), passé
// par l'appelant : les nombres annoncés sont ceux que l'import écrira.
export type PaymentScheduleFn = (
  values: Record<string, ImportValue>,
  depositPaid: boolean | null,
) => { payments: { fixedAmountCents: number; dueOn: string; paidOn: string | null }[]; paidAmountCents: number } | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: ImportValue | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function cents(value: ImportValue | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function isoDate(value: ImportValue | undefined): string | null {
  return typeof value === "string" && ISO_DATE.test(value) ? value : null;
}

function folded(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function range(dates: string[]): { from: string; to: string } | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0]!, to: sorted.at(-1)! };
}

// —— Le mariage visé (C-52) ——————————————————————————————————————————————————————————

// Champs qui désignent le mariage d'une ligne de budget ou d'une tâche (clients et date).
export const EVENT_REFERENCE_FIELDS = ["eventDate", "client1FirstName", "client1LastName", "client2FirstName", "client2LastName"] as const;

// « Pour quel mariage est ce budget ? » : un budget ou une liste de tâches sans colonne qui nomme le
// mariage, et qui n'en a pas reçu (reprise, fiche du mariage). Un fichier avec une telle colonne garde
// le rattachement ligne par ligne.
export function needsTargetEvent(input: { entityType: string; mappedFields: ReadonlySet<string>; targetEventId: string | null }): boolean {
  if (input.entityType !== "budget_lines" && input.entityType !== "tasks") return false;
  if (input.targetEventId) return false;
  return !EVENT_REFERENCE_FIELDS.some((field) => input.mappedFields.has(field));
}

// —— Les acomptes (C-53) —————————————————————————————————————————————————————————————

export type DepositRow = {
  rowIndex: number;
  lineNumber: number;
  slotLabel: string | null;
  vendorName: string | null;
  amountCents: number;
  dueOn: string;
};

export type MoneyFigures = { paidCents: number; dueCents: number; lateCount: number };

export type DepositsQuestion = {
  rows: DepositRow[];
  dates: { from: string; to: string };
  figures: { yes: MoneyFigures; no: MoneyFigures };
};

// Posée seulement si une colonne d'acompte est datée et que rien ne dit déjà « payé » (pas de colonne
// « Réglé ») : sinon le réglé du fichier décide, comme avant.
export function depositsQuestion(rows: readonly QuestionRow[], mappedFields: ReadonlySet<string>, today: string, schedule: PaymentScheduleFn): DepositsQuestion | null {
  if (mappedFields.has("paidAmount") || !mappedFields.has("depositAmount") || !mappedFields.has("depositDueOn")) return null;
  const deposits: DepositRow[] = [];
  for (const row of rows) {
    const amount = cents(row.values.depositAmount);
    const dueOn = isoDate(row.values.depositDueOn);
    if (amount === null || amount <= 0 || dueOn === null) continue;
    // Une ligne dont l'échéancier ne peut pas s'écrire (solde sans date) ne compte pas : l'import en
    // garde le réglé, sans échéance.
    if (schedule(row.values, false) === null) continue;
    deposits.push({ rowIndex: row.rowIndex, lineNumber: row.lineNumber, slotLabel: text(row.values.slotLabel), vendorName: text(row.values.vendorName), amountCents: amount, dueOn });
  }
  const dates = range(deposits.map((row) => row.dueOn));
  if (!dates) return null;
  return {
    rows: deposits,
    dates,
    figures: {
      yes: depositFigures(rows, new Set(deposits.map((row) => row.rowIndex)), today, schedule),
      no: depositFigures(rows, new Set(), today, schedule),
    },
  };
}

// Réglé, reste à payer et échéances en retard qu'écrira l'import, selon les lignes dont l'acompte est
// payé. Une ligne sans échéancier garde son réglé ; une échéance due avant aujourd'hui est en retard
// (le jour même n'est pas en retard, comme `paymentStatus` du budget).
export function depositFigures(rows: readonly QuestionRow[], paidRows: ReadonlySet<number>, today: string, schedule: PaymentScheduleFn): MoneyFigures {
  const figures: MoneyFigures = { paidCents: 0, dueCents: 0, lateCount: 0 };
  for (const row of rows) {
    const hasDeposit = cents(row.values.depositAmount) !== null && isoDate(row.values.depositDueOn) !== null;
    const plan = schedule(row.values, hasDeposit ? paidRows.has(row.rowIndex) : null);
    if (!plan) {
      figures.paidCents += Math.max(0, cents(row.values.paidAmount) ?? 0);
      continue;
    }
    figures.paidCents += plan.paidAmountCents;
    for (const payment of plan.payments) {
      if (payment.paidOn !== null) continue;
      figures.dueCents += payment.fixedAmountCents;
      if (payment.dueOn < today) figures.lateCount += 1;
    }
  }
  return figures;
}

// —— Les contrats (I1) ———————————————————————————————————————————————————————————————

export type ContractVendor = { name: string; rowIndexes: number[] };

// « Leurs contrats sont-ils signés ? » : un budget qui nomme ses prestataires. Un nom écrit sur
// plusieurs lignes est un seul prestataire (une seule réponse).
export function contractVendors(rows: readonly QuestionRow[]): ContractVendor[] {
  const byName = new Map<string, ContractVendor>();
  for (const row of rows) {
    const name = text(row.values.vendorName);
    if (!name) continue;
    const key = folded(name);
    const vendor = byName.get(key) ?? { name, rowIndexes: [] };
    vendor.rowIndexes.push(row.rowIndex);
    byName.set(key, vendor);
  }
  return [...byName.values()];
}

export function contractFigures(vendors: readonly ContractVendor[], answers: ImportAnswers["contracts"] | undefined): { signed: number; unsigned: number } {
  if (!answers) return { signed: 0, unsigned: 0 };
  if (answers.answer === "all") return { signed: vendors.length, unsigned: 0 };
  if (answers.answer === "none") return { signed: 0, unsigned: vendors.length };
  const signedRows = new Set(answers.signedRows ?? []);
  const signed = vendors.filter((vendor) => vendor.rowIndexes.some((rowIndex) => signedRows.has(rowIndex))).length;
  return { signed, unsigned: vendors.length - signed };
}

// —— Les échéances passées d'une liste « à faire » (R16, I3) ——————————————————————————

export type PastDueTask = { rowIndex: number; label: string; dueDate: string };

export type PastDueQuestion = { tasks: PastDueTask[]; doneCount: number; total: number };

// Tâches non faites dont l'échéance est passée : avant aujourd'hui (une tâche due aujourd'hui n'est pas
// passée). Dates sans heure : le passage à l'heure d'été ne change rien.
export function pastDueTasksQuestion(rows: readonly QuestionRow[], today: string): PastDueQuestion | null {
  const tasks: PastDueTask[] = [];
  let doneCount = 0;
  for (const row of rows) {
    if (row.values.done === true) {
      doneCount += 1;
      continue;
    }
    const dueDate = isoDate(row.values.dueDate);
    if (dueDate !== null && dueDate < today) tasks.push({ rowIndex: row.rowIndex, label: text(row.values.label) ?? "", dueDate });
  }
  return tasks.length > 0 ? { tasks, doneCount, total: rows.length } : null;
}

// Ce que la réponse fait aux tâches passées, avant l'écriture : gardées à leur date (en retard, comme
// dans le tableur), redatées, ou dites faites (date de fin non renseignée, à l'écriture).
export function applyPastDueAnswer<T extends Pick<QuestionRow, "values">>(rows: readonly T[], answer: ImportAnswers["pastDueTasks"] | undefined, today: string): T[] {
  if (!answer || answer.answer === "keep") return [...rows];
  return rows.map((row) => {
    const dueDate = isoDate(row.values.dueDate);
    if (row.values.done === true || dueDate === null || dueDate >= today) return row;
    if (answer.answer === "done") return { ...row, values: { ...row.values, done: true } };
    return answer.date ? { ...row, values: { ...row.values, dueDate: answer.date } } : row;
  });
}

// —— Ce qui manque avant de continuer ————————————————————————————————————————————————

export type AskedQuestions = {
  targetEvent: boolean;
  depositsPaid: boolean;
  contracts: boolean;
  // Type demandé seulement s'il y en a plusieurs dans l'espace.
  eventType: boolean;
  eventStage: boolean;
  prospectSource: boolean;
  pastDueTasks: boolean;
};

export type MissingAnswer = { key: ImportQuestionKey; code: "choose" | "name_required" | "date_required" | "date_past" };

// « Continuer » sans réponse : ce qui manque, sous chaque question. La source est facultative.
export function missingAnswers(asked: AskedQuestions, answers: ImportAnswers | null, today: string): MissingAnswer[] {
  const missing: MissingAnswer[] = [];
  const given = answers ?? {};
  if (asked.targetEvent) {
    if (given.newEvent) {
      if (given.newEvent.name.trim() === "") missing.push({ key: "targetEvent", code: "name_required" });
    } else if (!given.targetEvent) missing.push({ key: "targetEvent", code: "choose" });
  }
  if (asked.depositsPaid && !given.depositsPaid) missing.push({ key: "depositsPaid", code: "choose" });
  if (asked.contracts && !given.contracts) missing.push({ key: "contracts", code: "choose" });
  if (asked.eventType && !given.eventTypeId) missing.push({ key: "eventType", code: "choose" });
  if (asked.eventStage && !given.eventStage) missing.push({ key: "eventStage", code: "choose" });
  if (asked.pastDueTasks) {
    const pastDue = given.pastDueTasks;
    if (!pastDue) missing.push({ key: "pastDueTasks", code: "choose" });
    else if (pastDue.answer === "redate" && !pastDue.date) missing.push({ key: "pastDueTasks", code: "date_required" });
    else if (pastDue.answer === "redate" && pastDue.date && pastDue.date < today) missing.push({ key: "pastDueTasks", code: "date_past" });
  }
  return missing;
}

export function askedCount(asked: AskedQuestions): number {
  return Object.entries(asked).filter(([key, value]) => value && key !== "prospectSource").length;
}

// —— Ce que Symbola a compris ————————————————————————————————————————————————————————

export type UnderstoodLine =
  | { key: "carriedSlot"; count: number }
  | { key: "balances"; count: number; from: string; to: string; upcoming: boolean }
  | { key: "actualEmpty"; count: number }
  | { key: "vendorsRetained"; count: number }
  | { key: "taskDone"; count: number }
  | { key: "taskTodo"; count: number }
  | { key: "taskPlanner"; values: string[] }
  | { key: "taskClients"; values: string[] }
  | { key: "taskDue"; from: string; to: string };

export function budgetUnderstood(rows: readonly QuestionRow[], mappedFields: ReadonlySet<string>, today: string): UnderstoodLine[] {
  const lines: UnderstoodLine[] = [];
  const carried = rows.filter((row) => row.carried?.slotLabel !== undefined).length;
  if (carried > 0) lines.push({ key: "carriedSlot", count: carried });
  const balances = rows.flatMap((row) => (cents(row.values.balanceAmount) !== null && isoDate(row.values.balanceDueOn) ? [isoDate(row.values.balanceDueOn)!] : []));
  const balanceRange = range(balances);
  if (balanceRange) lines.push({ key: "balances", count: balances.length, ...balanceRange, upcoming: balanceRange.from >= today });
  if (mappedFields.has("actualAmount")) {
    const empty = rows.filter((row) => cents(row.values.actualAmount) === null).length;
    if (empty > 0) lines.push({ key: "actualEmpty", count: empty });
  }
  const vendors = contractVendors(rows).length;
  if (vendors > 0) lines.push({ key: "vendorsRetained", count: vendors });
  return lines;
}

// Les mots du fichier pour « Qui » : ceux qui donnent « Vous » (planner) et « Les mariés ».
export function tasksUnderstood(rows: readonly QuestionRow[], rawResponsible: ReadonlyMap<number, string>): UnderstoodLine[] {
  const lines: UnderstoodLine[] = [];
  const done = rows.filter((row) => row.values.done === true).length;
  if (done > 0) lines.push({ key: "taskDone", count: done });
  if (rows.length - done > 0) lines.push({ key: "taskTodo", count: rows.length - done });
  const words = (responsible: string) => [
    ...new Set(rows.flatMap((row) => (row.values.responsible === responsible && rawResponsible.get(row.rowIndex) ? [rawResponsible.get(row.rowIndex)!.trim()] : []))),
  ];
  const planner = words("planner");
  if (planner.length > 0) lines.push({ key: "taskPlanner", values: planner });
  const clients = words("clients");
  if (clients.length > 0) lines.push({ key: "taskClients", values: clients });
  const dueRange = range(rows.flatMap((row) => (isoDate(row.values.dueDate) ? [isoDate(row.values.dueDate)!] : [])));
  if (dueRange) lines.push({ key: "taskDue", ...dueRange });
  return lines;
}
