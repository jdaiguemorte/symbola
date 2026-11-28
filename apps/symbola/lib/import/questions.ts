// Lot 71c (HUB-14, BUD-01, EVT-01, EVT-05, CHR-01, CHR-02, UX-10 ; spécification du lot 71, § 5.3 ;
// maquette 07) — l'étape « Questions » de l'assistant d'import : ce que le fichier ne dit pas, demandé
// une fois, chaque réponse avec son résultat. Orchestration de l'app : l'import chez le hub, les
// mariages, types et sources chez les évènements, l'échéancier chez le budget. Session, organisation
// et rôle sont contrôlés par l'appelant ; tout est lu sous RLS, dans l'organisation.
import type { ImportAnswers } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { appNameCase } from "@symbola/import-engine";
import { starterBudgetImportPaymentLabels, type StarterLocale } from "@symbola/starter-templates";
import { importedPaymentSchedule, listBudgetLines } from "@/modules/budget/service";
import { eventNames, getEvent, listEvents, listEventTypes, listProspectSources } from "@/modules/events/service";
import { getImportAnswers, getImportTakeoverId, getImportWorkingSet, saveImportAnswers, saveImportMatching, setImportTargetEvent, type ImportEntityType } from "@/modules/hub/service";
import { computeImportMatching, parseWorkingSetRows } from "./matching";
import {
  askedCount,
  budgetUnderstood,
  contractVendors,
  depositsQuestion,
  missingAnswers,
  needsTargetEvent,
  pastDueTasksQuestion,
  tasksUnderstood,
  type AskedQuestions,
  type ContractVendor,
  type DepositsQuestion,
  type MissingAnswer,
  type PastDueQuestion,
  type PaymentScheduleFn,
  type QuestionRow,
  type UnderstoodLine,
} from "./question-rules";

// Les mariages proposés à « Pour quel mariage ? » : ceux à venir (ou sans date), au plus.
const TARGET_EVENT_OPTIONS = 12;

export type TargetEventOption = { id: string; name: string; eventDate: string | null; budgetLines: number };

// La fiche d'un logiciel : ce qui sera écrit (noms à la casse de l'app, et tels qu'écrits).
export type SheetWritten = {
  rowIndex: number;
  clients: { written: string; asInFile: string }[];
  eventDate: string | null;
  places: string[];
  wantedBudgetCents: number | null;
  totalCents: number | null;
  paidCents: number | null;
  note: string | null;
};

export type ImportQuestionsView = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  rowCount: number;
  today: string;
  // Le mariage déjà connu (page de reprise, fiche du mariage) : écrit en tête, pas demandé.
  fixedEvent: { name: string; eventDate: string | null; fromTakeover: boolean } | null;
  targetEvent: { options: TargetEventOption[] } | null;
  deposits: (DepositsQuestion & { header: string }) | null;
  contracts: { vendors: ContractVendor[] } | null;
  eventType: { options: { id: string; label: string }[] } | null;
  onlyEventType: string | null;
  eventStage: boolean;
  prospectSource: { options: { id: string; label: string }[] } | null;
  pastDue: PastDueQuestion | null;
  understood: UnderstoodLine[];
  sheets: SheetWritten[];
  asked: AskedQuestions;
  answers: ImportAnswers | null;
  missing: MissingAnswer[];
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function cents(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

const db = () => appDatabase();

function scheduleFor(locale: StarterLocale): PaymentScheduleFn {
  const labels = starterBudgetImportPaymentLabels(locale);
  return (values, depositPaid) => importedPaymentSchedule(values, labels, depositPaid);
}

async function targetOptions(organizationId: string, today: string): Promise<TargetEventOption[]> {
  const events = (await listEvents({ organizationId }))
    .filter((event) => !event.isDemo && !event.archivedAt && event.status !== "cancelled" && event.status !== "closed" && (event.eventDate === null || event.eventDate >= today))
    .sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"))
    .slice(0, TARGET_EVENT_OPTIONS);
  return Promise.all(
    events.map(async (event) => ({
      id: event.id,
      name: eventNames(event.clients, event.name),
      eventDate: event.eventDate,
      budgetLines: (await listBudgetLines(organizationId, event.id)).lines.length,
    })),
  );
}

// Les noms à la casse de l'app (« Léa MARTIN » → « Léa Martin »), comme l'écrira l'import, sauf
// « Garder les capitales ».
function sheetWritten(row: QuestionRow, keepCase: boolean): SheetWritten {
  const values = row.values;
  const clients: SheetWritten["clients"] = [];
  for (const index of [1, 2]) {
    const parts = [text(values[`client${index}FirstName`]), text(values[`client${index}LastName`])].filter((part): part is string => part !== null);
    if (parts.length === 0) continue;
    clients.push({ asInFile: parts.join(" "), written: (keepCase ? parts : parts.map((part) => appNameCase(part))).join(" ") });
  }
  // « 14:30 — Domaine des Tilleuls », une ligne par lieu (lu dans la fiche).
  const places = (text(values.places) ?? text(values.venueName) ?? "")
    .split("\n")
    .map((place) => place.trim())
    .filter((place) => place !== "");
  return {
    rowIndex: row.rowIndex,
    clients,
    eventDate: text(values.eventDate),
    places,
    wantedBudgetCents: cents(values.wantedBudget),
    totalCents: cents(values.total),
    paidCents: cents(values.paid),
    note: text(values.note),
  };
}

export async function getImportQuestions(
  organizationId: string,
  importId: string,
  options: { now?: Date; locale?: StarterLocale } = {},
): Promise<ImportQuestionsView | null> {
  const set = await getImportWorkingSet(db(), organizationId, importId);
  if (!set) return null;
  const today = parisToday(options.now ?? new Date());
  const answers = await getImportAnswers(db(), organizationId, importId);
  const rows: QuestionRow[] = parseWorkingSetRows(set).filter((row) => row.errors.length === 0);
  const mapped = new Set(set.mapping.flatMap((choice) => (choice.target === "field" && choice.fieldKey ? [choice.fieldKey] : [])));
  const entityType = set.entityType;

  let fixedEvent: ImportQuestionsView["fixedEvent"] = null;
  if (set.targetEventId) {
    const event = await getEvent(organizationId, set.targetEventId);
    if (event) fixedEvent = { name: eventNames(event.clients, event.name), eventDate: event.eventDate, fromTakeover: (await getImportTakeoverId(db(), organizationId, importId)) !== null };
  }
  // Un mariage choisi à cette étape n'est plus « connu d'avance » : la question reste, avec sa réponse.
  const chosenHere = answers?.targetEvent !== undefined && answers.targetEvent === set.targetEventId;
  const askTarget = (entityType === "budget_lines" || entityType === "tasks") && (chosenHere || answers?.newEvent !== undefined || needsTargetEvent({ entityType, mappedFields: mapped, targetEventId: set.targetEventId }));
  if (chosenHere) fixedEvent = null;

  const isBudget = entityType === "budget_lines";
  const isSheet = entityType === "event_sheets";
  const schedule = scheduleFor(options.locale ?? "fr");
  const deposits = isBudget ? depositsQuestion(rows, mapped, today, schedule) : null;
  const depositColumn = set.mapping.find((choice) => choice.target === "field" && choice.fieldKey === "depositAmount");
  const vendors = isBudget ? contractVendors(rows) : [];
  const types = isSheet ? await listEventTypes(organizationId) : [];
  const pastDue = entityType === "tasks" ? pastDueTasksQuestion(rows, today) : null;

  const asked: AskedQuestions = {
    targetEvent: askTarget,
    depositsPaid: deposits !== null,
    contracts: vendors.length > 0,
    eventType: isSheet && types.length > 1,
    eventStage: isSheet,
    prospectSource: isSheet,
    pastDueTasks: pastDue !== null,
  };

  let understood: UnderstoodLine[] = [];
  if (isBudget) understood = budgetUnderstood(rows, mapped, today);
  if (entityType === "tasks") {
    const who = set.mapping.find((choice) => choice.target === "field" && choice.fieldKey === "responsible");
    understood = tasksUnderstood(rows, new Map(rows.map((row) => [row.rowIndex, who ? (set.rows[row.rowIndex]?.[who.columnIndex] ?? "") : ""])));
  }
  const keepCase = answers?.nameCase === "keep";
  const sheets = isSheet ? rows.map((row) => sheetWritten(row, keepCase)) : [];

  return {
    importId,
    entityType,
    fileName: set.fileName,
    rowCount: rows.length,
    today,
    fixedEvent,
    targetEvent: askTarget ? { options: await targetOptions(organizationId, today) } : null,
    deposits: deposits ? { ...deposits, header: depositColumn ? (set.headers[depositColumn.columnIndex] ?? "") : "" } : null,
    contracts: vendors.length > 0 ? { vendors } : null,
    eventType: asked.eventType ? { options: types.map((type) => ({ id: type.id, label: type.label })) } : null,
    onlyEventType: isSheet && types.length === 1 ? types[0]!.label : null,
    eventStage: isSheet,
    prospectSource: isSheet ? { options: (await listProspectSources(organizationId)).map((source) => ({ id: source.id, label: source.label })) } : null,
    pastDue,
    understood,
    sheets,
    asked,
    answers,
    missing: missingAnswers(asked, answers, today),
  };
}

// L'étape existe s'il y a au moins une réponse à donner.
export function hasQuestions(view: Pick<ImportQuestionsView, "asked">): boolean {
  return askedCount(view.asked) > 0;
}

export class ImportTargetEventNotFoundError extends Error {
  constructor() {
    super("mariage visé introuvable");
    this.name = "ImportTargetEventNotFoundError";
  }
}

// « Continuer » : les réponses enregistrées (validées par le hub), et le mariage visé posé sur l'import.
// Un mariage d'une autre organisation, un essai ou un identifiant inconnu répond comme un mariage
// inexistant (SEC-13), sans rien écrire. Les rapprochements sont recalculés pour le mariage choisi.
export async function saveQuestionAnswers(organizationId: string, importId: string, answers: ImportAnswers): Promise<boolean> {
  const set = await getImportWorkingSet(db(), organizationId, importId);
  if (!set) return false;
  const targets = set.entityType === "budget_lines" || set.entityType === "tasks";
  const choosesTarget = targets && (answers.targetEvent !== undefined || answers.newEvent !== undefined);
  if (answers.targetEvent !== undefined) {
    const event = await getEvent(organizationId, answers.targetEvent);
    if (!event || event.isDemo) throw new ImportTargetEventNotFoundError();
  }
  if (!(await saveImportAnswers(db(), { organizationId, importId, answers }))) return false;
  if (!choosesTarget) return true;
  const wanted = answers.newEvent !== undefined ? null : (answers.targetEvent ?? null);
  const previousAnswers = set.matching?.answers ?? {};
  const unchanged = wanted === set.targetEventId && JSON.stringify(previousAnswers.newEvent ?? null) === JSON.stringify(answers.newEvent ?? null);
  if (unchanged && set.matching && (set.matching.rowEvents.length > 0 || set.matching.matches.length > 0)) return true;
  if (!(await setImportTargetEvent(db(), { organizationId, importId, eventId: wanted }))) return false;
  const fresh = await getImportWorkingSet(db(), organizationId, importId);
  if (!fresh) return false;
  const matching = await computeImportMatching(organizationId, fresh);
  return saveImportMatching(db(), { organizationId, importId, matching: { ...matching, answers: answers as Record<string, unknown> } });
}
