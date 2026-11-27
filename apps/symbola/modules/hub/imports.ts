import { randomUUID } from "node:crypto";
// Lot 5 — orchestration de l'import par le hub (PRD §7, ADR 0022). Exposé par
// service.ts. IMP-01 : réception du fichier (taille, antivirus, lecture),
// import en cours gardé en attente ; rien n'est écrit dans les modules avant
// la confirmation (IMP-05).
import {
  CONTRACTS_ANSWERS,
  DEPOSITS_PAID_ANSWERS,
  EVENT_STAGE_ANSWERS,
  IMPORT_FIELDS,
  IMPORT_FILE_ENTITY_TYPES,
  IMPORT_REQUIRED_ONE_OF,
  NAME_CASE_ANSWERS,
  PAST_DUE_TASKS_ANSWERS,
  type ImportAnswers,
  type ImportEntityType,
  type ImportFieldDefinition,
} from "@symbola/contracts";
import { z } from "zod";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import type { ImportColumnChoice, ImportMatch, ImportMatching, ImportResult, ImportVendorTypeTarget } from "@symbola/db/schema/hub";
import { parseEnv } from "@symbola/env";
import { createStorageClient, scanBuffer, sealFile, uploadPrivateObject } from "@symbola/files";
import {
  EVENT_SHEET_COLUMNS,
  EVENT_SHEET_FREE_COLUMNS,
  EVENT_SHEET_TECHNICAL_COLUMNS,
  LOW_CONFIDENCE_THRESHOLD,
  looksLikePdf,
  normalizeLabel,
  proposeMapping,
  proposeVendorsExportMapping,
  readImportFile,
  type ReadFailureReason,
  type UnsupportedHint,
} from "@symbola/import-engine";
import { planningSoftwareProfile, starterImportSynonyms } from "@symbola/starter-templates";
import {
  cancelExpiredDrafts,
  clearExpiredUndoValues,
  findImport,
  findImportItems,
  markImportApplied,
  recordUndoOutcomes,
  findImports,
  insertImport,
  markDraftCancelled,
  updateDraftMapping,
  updateDraftMappingKeepingMatches,
  updateDraftMatching,
  updateDraftTargetEvent,
  type ImportItemRow,
  type ImportRow,
  type NewImportItem,
  findImportedEvents,
} from "./import-repository";
import { cancelImportJobs, createImportJob, isReadingSheets, listImportJobs, type ImportJobView } from "./import-jobs";
import { findPlatformSettings, insertDefaultPlatformSettings } from "./repository";
import { BUDGET_VENDOR_FIELD, clearExpiredImportLeftovers, countImportVendorNames, coverTakeoverFromBudgetImport } from "./takeovers";

export { IMPORT_ENTITY_TYPES, IMPORT_FILE_ENTITY_TYPES, type ImportEntityType } from "@symbola/contracts";
export type { ImportColumnChoice, ImportMatch, ImportMatching, ImportResult, ImportRowEvent, ImportVendorTypeChoice, ImportVendorTypeTarget } from "@symbola/db/schema/hub";

// Module qui reçoit chaque type d'éléments : un type dont le module n'est pas
// souscrit n'est pas proposé (dégradation propre, CLAUDE.md §2.3). Lot 36b : les
// contacts vont au hub, le noyau, toujours là.
export const IMPORT_ENTITY_MODULE: Record<ImportEntityType, "events" | "budget" | "quotes" | "vendors" | "hub"> = {
  events: "events",
  tasks: "events",
  vendor_slots: "events",
  prospect_sources: "events",
  loss_reasons: "events",
  budget_lines: "budget",
  catalog_items: "quotes",
  payment_methods: "quotes",
  vendors: "vendors",
  event_sheets: "events",
  contacts: "hub",
  event_vendors: "events",
  program: "events",
};

// Lot 71a (I4) : leftoversRetentionDays, durée de l'annuaire non repris d'un programme (90 jours).
export type ImportLimits = { maxBytes: number; maxRows: number; maxSheets: number; draftRetentionDays: number; undoRetentionDays: number; leftoversRetentionDays: number };

export async function getImportLimits(db: AppDatabase): Promise<ImportLimits> {
  let settings = await findPlatformSettings(db);
  if (!settings) {
    await insertDefaultPlatformSettings(db);
    settings = await findPlatformSettings(db);
  }
  if (!settings) throw new Error("réglages de la plateforme introuvables");
  return {
    maxBytes: settings.importMaxBytes,
    maxRows: settings.importMaxRows,
    maxSheets: settings.importMaxSheets,
    draftRetentionDays: settings.importDraftRetentionDays,
    undoRetentionDays: settings.importUndoRetentionDays,
    leftoversRetentionDays: settings.importLeftoversRetentionDays,
  };
}

export type StartImportInput = {
  organizationId: string;
  userId: string;
  entityType: ImportEntityType;
  fileName: string;
  bytes: Uint8Array;
  // Lot 65g (HUB-14, BUD-04) : import lancé depuis un évènement (tâches, lignes de budget), vérifié
  // par l'appelant : toutes les lignes vont dans cet évènement.
  targetEventId?: string | null;
  now?: Date;
};

export type ImportRejectionReason = ReadFailureReason | "infected";

export type StartImportResult =
  | { status: "rejected"; reason: ImportRejectionReason; hint?: UnsupportedHint }
  | { status: "started"; importId: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function startImport(db: AppDatabase, input: StartImportInput): Promise<StartImportResult> {
  // Lot 71a : un PDF de prestataires retenus ou de programme ne passe pas encore par ici (paquet 71e).
  if (!IMPORT_FILE_ENTITY_TYPES.includes(input.entityType)) throw new Error("sorte d'import non acceptée par l'envoi de fichier");
  const now = input.now ?? new Date();
  const limits = await getImportLimits(db);
  // Taille d'abord : un fichier trop gros n'est ni analysé ni lu.
  if (input.bytes.length > limits.maxBytes) return { status: "rejected", reason: "too_large" };
  if (input.bytes.length === 0) return { status: "rejected", reason: "empty" };

  const env = parseEnv(process.env);
  const scan = await scanBuffer(Buffer.from(input.bytes), { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) return { status: "rejected", reason: "infected" };

  const result = readImportFile(input.bytes, { maxBytes: limits.maxBytes, maxRows: limits.maxRows });
  if (!result.ok) {
    return result.hint
      ? { status: "rejected", reason: result.reason, hint: result.hint }
      : { status: "rejected", reason: result.reason };
  }

  const { table } = result;
  const row = await insertImport(db, {
    organizationId: input.organizationId,
    createdByUserId: input.userId,
    entityType: input.entityType,
    fileName: sanitizeFileName(input.fileName),
    fileFormat: table.format,
    fileSizeBytes: input.bytes.length,
    encoding: table.encoding ?? null,
    delimiter: table.delimiter ?? null,
    headerRowIndex: table.headerRowIndex,
    headers: table.headers,
    rows: table.rows,
    sourceLineNumbers: table.sourceLineNumbers,
    rowCount: table.rows.length,
    neutralizedCells: table.neutralizedCells,
    targetEventId: (input.entityType === "tasks" || input.entityType === "budget_lines") && input.targetEventId ? input.targetEventId : null,
    expiresAt: new Date(now.getTime() + limits.draftRetentionDays * DAY_MS),
    createdAt: now,
    updatedAt: now,
  });
  return { status: "started", importId: row.id };
}

// Lot 14c (IMP-08) — une ou plusieurs fiches événement PDF : chaque fiche,
// vérifiée par l'antivirus et lue sans exécuter aucun script (ADR 0034),
// devient une ligne ; une fiche illisible devient une ligne avec son motif,
// rejetée au rapport des écarts sans bloquer les autres. Les fichiers ne
// sont jamais gardés, seulement les valeurs lues. Les colonnes, construites
// par l'app, sont enregistrées comme déjà reconnues.
export type StartEventSheetsImportInput = {
  organizationId: string;
  userId: string;
  files: { fileName: string; bytes: Uint8Array }[];
  now?: Date;
};

export type StartEventSheetsImportResult =
  | { status: "rejected"; reason: "empty" | "too_many_files" }
  | { status: "started"; importId: string };

// Date du jour à Paris (AAAA-MM-JJ), pour le statut proposé (décision J).
function parisDay(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);
}

export async function startEventSheetsImport(db: AppDatabase, input: StartEventSheetsImportInput): Promise<StartEventSheetsImportResult> {
  const now = input.now ?? new Date();
  const limits = await getImportLimits(db);
  const files = input.files.filter((file) => file.bytes.length > 0);
  if (files.length === 0) return { status: "rejected", reason: "empty" };
  if (files.length > limits.maxSheets) return { status: "rejected", reason: "too_many_files" };

  // Lot 15 (IMP-10) : les fiches sont gardées chiffrées le temps de leur
  // lecture, faite ensuite en tâche de fond (antivirus, lecture, ligne de
  // l'import) ; la planner suit l'avancement. Une fiche trop grosse ou qui
  // n'est pas un PDF est refusée tout de suite, sans être gardée.
  const importId = randomUUID();
  const storage = createStorageClient();
  const stored: { fileName: string; objectKey: string | null; secret: string | null; rejection?: string }[] = [];
  for (const [index, file] of files.entries()) {
    const fileName = sanitizeFileName(file.fileName);
    if (file.bytes.length > limits.maxBytes) {
      stored.push({ fileName, objectKey: null, secret: null, rejection: "too_large" });
      continue;
    }
    if (!looksLikePdf(file.bytes)) {
      stored.push({ fileName, objectKey: null, secret: null, rejection: "not_pdf" });
      continue;
    }
    const sealed = sealFile(file.bytes);
    const objectKey = `imports/${input.organizationId}/${importId}/${index}.bin`;
    await uploadPrivateObject(storage, { key: objectKey, body: sealed.data, contentType: "application/octet-stream" });
    stored.push({ fileName, objectKey, secret: sealed.key });
  }

  const profile = planningSoftwareProfile().eventSheet;
  const fieldKeys = new Set(IMPORT_FIELDS.event_sheets.map((field) => field.key));
  const mapping: ImportColumnChoice[] = EVENT_SHEET_COLUMNS.map((column, columnIndex) => {
    if (fieldKeys.has(column)) return { columnIndex, fieldKey: column, target: "field", confidence: 100, confirmed: true };
    if (EVENT_SHEET_FREE_COLUMNS.includes(column)) return { columnIndex, fieldKey: null, target: "free", confidence: 0, confirmed: true, decidedAtGaps: true };
    if (EVENT_SHEET_TECHNICAL_COLUMNS.includes(column)) return { columnIndex, fieldKey: null, target: "ignore", confidence: 0, confirmed: true };
    return { columnIndex, fieldKey: null, target: "ignore", confidence: 0, confirmed: true, decidedAtGaps: true };
  });
  const first = sanitizeFileName(files[0]!.fileName);
  await insertImport(db, {
    id: importId,
    organizationId: input.organizationId,
    createdByUserId: input.userId,
    entityType: "event_sheets",
    fileName: files.length > 1 ? `${first} (+${files.length - 1})` : first,
    fileFormat: "pdf",
    fileSizeBytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
    encoding: null,
    delimiter: null,
    headerRowIndex: 0,
    headers: EVENT_SHEET_COLUMNS.map((column) => profile.columnHeaders[column] ?? column),
    rows: [],
    sourceLineNumbers: [],
    rowCount: 0,
    neutralizedCells: 0,
    mapping,
    expiresAt: new Date(now.getTime() + limits.draftRetentionDays * DAY_MS),
    createdAt: now,
    updatedAt: now,
  });
  await createImportJob(db, {
    organizationId: input.organizationId,
    importId,
    payload: { kind: "read_sheets", files: stored, today: parisDay(now) },
    total: stored.length,
    now,
  });
  return { status: "started", importId };
}

// Nom affiché au journal : sans chemin ni caractère de contrôle, borné.
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return cleaned === "" ? "fichier" : cleaned;
}

export type ImportSummary = {
  appliedAt: Date | null;
  undoneAt: Date | null;
  result: ImportResult | null;
  id: string;
  entityType: ImportEntityType;
  status: ImportRow["status"];
  fileName: string;
  fileFormat: string;
  fileSizeBytes: number;
  encoding: string | null;
  delimiter: string | null;
  headerRowIndex: number;
  headers: string[];
  rowCount: number;
  neutralizedCells: number;
  createdByUserId: string;
  createdAt: Date;
  expiresAt: Date;
  // Lot 71b : la reprise de l'import, et le mariage qu'il vise (« Pour » du journal).
  takeoverId: string | null;
  targetEventId: string | null;
};

export type ImportDraft = ImportSummary & {
  // Premières lignes, pour l'aperçu de l'étape « fichier ».
  previewRows: string[][];
  // IMP-02 : choix de colonnes enregistrés, ou null avant l'étape « colonnes ».
  mapping: ImportColumnChoice[] | null;
  // IMP-03 : rapprochements calculés et décidés, ou null.
  matching: ImportMatching | null;
  // Lot 15 (IMP-10) : traitements de fond de l'import (lecture des fiches…).
  jobs: ImportJobView[];
};

const PREVIEW_ROWS = 5;

function toSummary(row: ImportRow): ImportSummary {
  return {
    id: row.id,
    entityType: row.entityType,
    status: row.status,
    fileName: row.fileName,
    fileFormat: row.fileFormat,
    fileSizeBytes: row.fileSizeBytes,
    encoding: row.encoding,
    delimiter: row.delimiter,
    headerRowIndex: row.headerRowIndex,
    headers: row.headers,
    rowCount: row.rowCount,
    neutralizedCells: row.neutralizedCells,
    createdByUserId: row.createdByUserId,
    appliedAt: row.appliedAt,
    undoneAt: row.undoneAt,
    result: row.result,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    takeoverId: row.takeoverId ?? null,
    targetEventId: row.targetEventId ?? null,
  };
}

// Import en cours (non expiré) de l'organisation, ou null.
export async function getImportDraft(
  db: AppDatabase,
  organizationId: string,
  importId: string,
  now: Date = new Date(),
): Promise<ImportDraft | null> {
  const row = await findImport(db, organizationId, importId);
  if (!row || row.status !== "draft" || row.expiresAt <= now || !row.rows) return null;
  return {
    ...toSummary(row),
    previewRows: row.rows.slice(0, PREVIEW_ROWS),
    mapping: row.mapping,
    matching: row.matching,
    jobs: await listImportJobs(db, organizationId, importId),
  };
}

async function findActiveDraft(db: AppDatabase, organizationId: string, importId: string, now: Date) {
  const row = await findImport(db, organizationId, importId);
  if (!row || row.status !== "draft" || row.expiresAt <= now || !row.rows) return null;
  return { ...row, rows: row.rows };
}

// IMP-02 — étape « colonnes » : pour chaque colonne, quelques valeurs
// d'exemple, la correspondance proposée (champ et confiance) et le choix
// déjà enregistré s'il existe.
export type ImportColumnView = {
  columnIndex: number;
  header: string;
  samples: string[];
  proposedFieldKey: string | null;
  confidence: number;
  // Lot 14 (IMP-07) : correspondance proposée d'après le contenu de la
  // colonne et non son intitulé (colonnes inversées par l'export).
  byContent: boolean;
  saved: ImportColumnChoice | null;
  // Lot 16 (IMP-11) : colonne annexe d'un export reconnu, décidée d'office.
  profileDecision: "ignore" | "free" | null;
};

export type ImportColumnsView = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  fields: readonly ImportFieldDefinition[];
  lowConfidenceThreshold: number;
  columns: ImportColumnView[];
};

const SAMPLE_VALUES = 3;

export async function getImportColumns(
  db: AppDatabase,
  organizationId: string,
  importId: string,
  now: Date = new Date(),
): Promise<ImportColumnsView | null> {
  const row = await findActiveDraft(db, organizationId, importId, now);
  if (!row) return null;
  const fields = IMPORT_FIELDS[row.entityType];
  const generic = proposeMapping({ headers: row.headers, rows: row.rows, fields, synonyms: starterImportSynonyms().columns });
  // Export du carnet d'un logiciel tiers reconnu : sa correspondance prime.
  const profile = planningSoftwareProfile().vendors;
  const known = row.entityType === "vendors" ? proposeVendorsExportMapping(row, profile, fields.map((field) => field.key)) : null;
  // Lot 65g (HUB-14, BUD-04) : une colonne calculée (« Différence », « Reste à payer ») sans
  // équivalent est ignorée d'office ; Symbola la recalcule.
  const computed = new Set((starterImportSynonyms().ignored[row.entityType] ?? []).map((label) => normalizeLabel(label).join(" ")));
  const annexDecision = (columnIndex: number): "ignore" | "free" | null => {
    if (!generic[columnIndex]?.fieldKey && computed.has(normalizeLabel(row.headers[columnIndex] ?? "").join(" "))) return "ignore";
    const field = known?.[columnIndex]?.profileField;
    if (!field || known?.[columnIndex]?.fieldKey) return null;
    if (profile.annexColumns?.ignore.includes(field)) return "ignore";
    if (profile.annexColumns?.keep.includes(field)) return "free";
    return null;
  };
  const proposals = generic.map((proposal) => {
    const override = known?.[proposal.columnIndex];
    return override ? { ...proposal, fieldKey: override.fieldKey, confidence: override.confidence, byContent: override.byContent } : { ...proposal, byContent: false };
  });
  return {
    importId: row.id,
    entityType: row.entityType,
    fileName: row.fileName,
    fields,
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    columns: proposals.map((proposal) => ({
      columnIndex: proposal.columnIndex,
      header: row.headers[proposal.columnIndex] ?? "",
      samples: row.rows
        .map((cells) => cells[proposal.columnIndex] ?? "")
        .filter((value) => value !== "")
        .slice(0, SAMPLE_VALUES),
      proposedFieldKey: proposal.fieldKey,
      confidence: proposal.confidence,
      byContent: proposal.byContent,
      saved: row.mapping?.find((choice) => choice.columnIndex === proposal.columnIndex) ?? null,
      profileDecision: annexDecision(proposal.columnIndex),
    })),
  };
}

// Choix de la planner pour une colonne : un champ, « sans équivalent » (à
// traiter au rapport des écarts) ou « ignorer » ; `confirmed` = case
// « je valide » cochée pour une proposition sous le seuil de confiance.
export type ColumnChoiceInput = { columnIndex: number; target: string; confirmed: boolean };

export type MappingError =
  | { code: "unknown_field"; columnIndex: number }
  | { code: "duplicate_field"; columnIndex: number; fieldKey: string }
  | { code: "low_confidence_not_confirmed"; columnIndex: number; fieldKey: string }
  | { code: "missing_required"; fieldKey: string };

export type SaveImportMappingResult = { status: "saved" } | { status: "not_found" } | { status: "invalid"; errors: MappingError[] };

export async function saveImportMapping(
  db: AppDatabase,
  input: { organizationId: string; importId: string; choices: ColumnChoiceInput[]; now?: Date },
): Promise<SaveImportMappingResult> {
  const now = input.now ?? new Date();
  const view = await getImportColumns(db, input.organizationId, input.importId, now);
  if (!view) return { status: "not_found" };

  const fieldKeys = new Set(view.fields.map((field) => field.key));
  const byColumn = new Map(input.choices.map((choice) => [choice.columnIndex, choice]));
  const errors: MappingError[] = [];
  const usedFields = new Map<string, number>();
  const mapping: ImportColumnChoice[] = [];

  for (const column of view.columns) {
    // Une colonne absente du formulaire garde la proposition, qui reste
    // soumise à la même règle de confiance.
    const choice = byColumn.get(column.columnIndex) ?? {
      columnIndex: column.columnIndex,
      target: column.proposedFieldKey ?? "none",
      confirmed: false,
    };
    if (choice.target === "none" || choice.target === "ignore") {
      mapping.push({ columnIndex: column.columnIndex, fieldKey: null, target: choice.target, confidence: column.confidence, confirmed: true });
      continue;
    }
    if (!fieldKeys.has(choice.target)) {
      errors.push({ code: "unknown_field", columnIndex: column.columnIndex });
      continue;
    }
    if (usedFields.has(choice.target)) {
      errors.push({ code: "duplicate_field", columnIndex: column.columnIndex, fieldKey: choice.target });
      continue;
    }
    usedFields.set(choice.target, column.columnIndex);
    // Choisir soi-même un autre champ que la proposition vaut validation ;
    // garder une proposition sous le seuil exige de la confirmer.
    const keepsProposal = choice.target === column.proposedFieldKey;
    const confidence = keepsProposal ? column.confidence : 100;
    if (keepsProposal && column.confidence < view.lowConfidenceThreshold && !choice.confirmed) {
      errors.push({ code: "low_confidence_not_confirmed", columnIndex: column.columnIndex, fieldKey: choice.target });
      continue;
    }
    mapping.push({ columnIndex: column.columnIndex, fieldKey: choice.target, target: "field", confidence, confirmed: true });
  }

  for (const field of view.fields) {
    if (field.required && !usedFields.has(field.key)) errors.push({ code: "missing_required", fieldKey: field.key });
  }
  // Lot 36b : un champ parmi plusieurs (le nom d'un contact, de sa colonne ou d'un « nom complet »).
  const oneOf = IMPORT_REQUIRED_ONE_OF[view.entityType];
  if (oneOf && !oneOf.keys.some((key) => usedFields.has(key))) errors.push({ code: "missing_required", fieldKey: oneOf.errorKey });
  if (errors.length > 0) return { status: "invalid", errors };

  const saved = await updateDraftMapping(db, input.organizationId, input.importId, mapping, now);
  if (!saved) return { status: "not_found" };
  // Lot 71b (critère 4) : un budget de reprise qui nomme ses prestataires couvre leur ligne.
  await coverTakeoverFromBudgetImport(db, input.organizationId, input.importId, now);
  return { status: "saved" };
}

export async function listImports(db: AppDatabase, organizationId: string): Promise<ImportSummary[]> {
  return (await findImports(db, organizationId)).map(toSummary);
}

// Lot 71b (critère 4) : la colonne proposée pour le prestataire d'un budget, tant que ses colonnes ne
// sont pas enregistrées ; null sinon.
async function proposedBudgetVendorColumn(db: AppDatabase, organizationId: string, importId: string): Promise<number | null> {
  const view = await getImportColumns(db, organizationId, importId);
  if (!view || view.entityType !== "budget_lines") return null;
  return view.columns.find((column) => column.proposedFieldKey === BUDGET_VENDOR_FIELD)?.columnIndex ?? null;
}

// Un budget de reprise déposé : s'il nomme ses prestataires, leur ligne est couverte dès maintenant.
export async function coverTakeoverFromBudgetProposal(db: AppDatabase, organizationId: string, importId: string, now: Date = new Date()): Promise<boolean> {
  return coverTakeoverFromBudgetImport(db, organizationId, importId, now, await proposedBudgetVendorColumn(db, organizationId, importId));
}

// « Votre budget nomme 7 prestataires » : par la colonne choisie, sinon par la colonne proposée.
export async function countBudgetVendorNames(db: AppDatabase, organizationId: string, importId: string): Promise<number> {
  return countImportVendorNames(db, organizationId, importId, await proposedBudgetVendorColumn(db, organizationId, importId));
}

// Lot 71b : les imports des lignes d'une reprise (le carnet peut venir d'une autre reprise).
export async function listImportSummaries(db: AppDatabase, organizationId: string, importIds: readonly string[]): Promise<ImportSummary[]> {
  if (importIds.length === 0) return [];
  const wanted = new Set(importIds);
  return (await findImports(db, organizationId)).filter((row) => wanted.has(row.id)).map(toSummary);
}

export async function cancelImport(db: AppDatabase, organizationId: string, importId: string, now: Date = new Date()): Promise<boolean> {
  const cancelled = await markDraftCancelled(db, organizationId, importId, now);
  // Lot 15 : la lecture en cours s'arrête, les fiches encore gardées sont supprimées.
  if (cancelled) await cancelImportJobs(db, organizationId, importId, now);
  return cancelled;
}

// Purge horaire (lib/import-purge.ts) : les lignes en attente d'un import
// abandonné sans être confirmé sont effacées à son expiration. Lot 71a
// (SEC-21) : ses traitements s'arrêtent et les fiches PDF encore gardées dans
// le stockage sont supprimées, sans attendre le traitement de fond.
export async function purgeExpiredImportDrafts(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  let purged = 0;
  for (const organizationId of organizationIds) {
    const expired = await cancelExpiredDrafts(db, organizationId, now);
    for (const importId of expired) await cancelImportJobs(db, organizationId, importId, now);
    purged += expired.length;
  }
  return purged;
}

// IMP-03 — données de travail d'un import en cours dont les colonnes sont
// validées, pour l'orchestrateur des rapprochements (lib/import), qui
// interroge les modules par leur service.ts.
export type ImportWorkingSet = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  headers: string[];
  rows: string[][];
  sourceLineNumbers: number[];
  mapping: ImportColumnChoice[];
  matching: ImportMatching | null;
  // Lot 65g : l'évènement de toutes les lignes, pour un import lancé depuis un évènement.
  targetEventId: string | null;
};

export async function getImportWorkingSet(
  db: AppDatabase,
  organizationId: string,
  importId: string,
  now: Date = new Date(),
): Promise<ImportWorkingSet | null> {
  const row = await findActiveDraft(db, organizationId, importId, now);
  if (!row || !row.mapping) return null;
  // Fiches PDF encore en lecture : pas de rapprochements sur des lignes partielles.
  if (row.entityType === "event_sheets" && (await isReadingSheets(db, organizationId, importId))) return null;
  return {
    importId: row.id,
    entityType: row.entityType,
    fileName: row.fileName,
    headers: row.headers,
    rows: row.rows,
    sourceLineNumbers: row.sourceLineNumbers ?? row.rows.map((_, index) => index + 2),
    mapping: row.mapping,
    matching: row.matching,
    targetEventId: row.targetEventId ?? null,
  };
}

export async function saveImportMatching(
  db: AppDatabase,
  input: { organizationId: string; importId: string; matching: ImportMatching; now?: Date },
): Promise<boolean> {
  // Lot 71a : les réponses de l'étape « Questions » restent quand les rapprochements sont recalculés.
  const answers = input.matching.answers ?? (await findImport(db, input.organizationId, input.importId))?.matching?.answers;
  return updateDraftMatching(db, input.organizationId, input.importId, answers ? { ...input.matching, answers } : input.matching, input.now ?? new Date());
}

// —— Lot 71a (HUB-14 ; ADR 0119) : réponses de l'étape « Questions » ————————————————————————

// Réponses validées (entrée externe : Zod, CLAUDE.md § 5) ; aucune n'est cochée d'avance.
const importAnswersSchema = z.strictObject({
  targetEvent: z.guid().optional(),
  newEvent: z.strictObject({ name: z.string().trim().min(1).max(200), eventDate: z.iso.date().nullable() }).optional(),
  depositsPaid: z.strictObject({ answer: z.enum(DEPOSITS_PAID_ANSWERS), paidRows: z.array(z.number().int().nonnegative()).max(5000).optional() }).optional(),
  contracts: z.strictObject({ answer: z.enum(CONTRACTS_ANSWERS), signedRows: z.array(z.number().int().nonnegative()).max(5000).optional() }).optional(),
  pastDueTasks: z.strictObject({ answer: z.enum(PAST_DUE_TASKS_ANSWERS), date: z.iso.date().optional() }).optional(),
  eventTypeId: z.guid().optional(),
  eventStage: z.enum(EVENT_STAGE_ANSWERS).optional(),
  prospectSourceId: z.guid().optional(),
  nameCase: z.enum(NAME_CASE_ANSWERS).optional(),
});

export class ImportAnswersInvalidError extends Error {
  constructor() {
    super("réponses invalides");
    this.name = "ImportAnswersInvalidError";
  }
}

// Les réponses d'un import en cours (les identifiants qu'elles citent sont contrôlés à l'écriture, par
// le module qui les reçoit). false : import inconnu, d'une autre organisation ou déjà terminé.
export async function saveImportAnswers(db: AppDatabase, input: { organizationId: string; importId: string; answers: unknown; now?: Date }): Promise<boolean> {
  const parsed = importAnswersSchema.safeParse(input.answers);
  if (!parsed.success) throw new ImportAnswersInvalidError();
  const row = await findImport(db, input.organizationId, input.importId);
  if (!row || row.status !== "draft") return false;
  const matching: ImportMatching = { ...(row.matching ?? { matches: [], rowEvents: [] }), answers: parsed.data };
  return updateDraftMatching(db, input.organizationId, input.importId, matching, input.now ?? new Date());
}

// Lot 71c (HUB-14, C-52) : « Pour quel mariage est ce budget ? ». L'évènement est contrôlé par
// l'appelant (le module des évènements : de l'organisation, pas un essai) ; null, un mariage qui n'est pas
// encore dans Symbola. false : import inconnu, d'une autre organisation, terminé, ou d'une autre sorte.
export async function setImportTargetEvent(db: AppDatabase, input: { organizationId: string; importId: string; eventId: string | null; now?: Date }): Promise<boolean> {
  return updateDraftTargetEvent(db, input.organizationId, input.importId, input.eventId, input.now ?? new Date());
}

export async function getImportAnswers(db: AppDatabase, organizationId: string, importId: string): Promise<ImportAnswers | null> {
  const answers = (await findImport(db, organizationId, importId))?.matching?.answers;
  if (!answers) return null;
  const parsed = importAnswersSchema.safeParse(answers);
  return parsed.success ? (parsed.data as ImportAnswers) : null;
}

// Purge horaire (lib/import-purge.ts) : ce qu'un import n'avait pas repris (l'annuaire d'un programme)
// est effacé passé la durée réglée par l'Admin (I4), et dès qu'il est abandonné ou retiré.
export async function purgeExpiredImportLeftovers(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  const { leftoversRetentionDays } = await getImportLimits(db);
  const appliedBefore = new Date(now.getTime() - leftoversRetentionDays * DAY_MS);
  let cleared = 0;
  for (const organizationId of organizationIds) cleared += await clearExpiredImportLeftovers(db, organizationId, appliedBefore);
  return cleared;
}

// Décision de la planner sur des rapprochements proposés : un par un ou en
// lot (plusieurs lignes à la fois). Une ligne sans rapprochement est ignorée.
// Lot 63b (HUB-14) : « later », décider plus tard (la proposition reste en attente).
export type MatchDecision = { rowIndex: number; decision: "accept" | "refuse" | "later" };

export async function decideImportMatches(
  db: AppDatabase,
  input: { organizationId: string; importId: string; decisions: MatchDecision[]; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set?.matching) return false;
  const decisions = new Map(input.decisions.map((decision) => [decision.rowIndex, decision.decision]));
  const matches = set.matching.matches.map((match): ImportMatch => {
    const decision = decisions.get(match.rowIndex);
    if (!decision) return match;
    return { ...match, status: decision === "accept" ? "accepted" : decision === "later" ? "proposed" : "refused", ...(match.toVerify ? { reviewed: decision !== "later" } : {}) };
  });
  return updateDraftMatching(db, input.organizationId, input.importId, { ...set.matching, matches }, now);
}

// Rapprochement ajouté à la main : l'orchestrateur a vérifié que l'élément
// existe et convient à la ligne. Il remplace une proposition éventuelle.
export async function setManualImportMatch(
  db: AppDatabase,
  input: { organizationId: string; importId: string; rowIndex: number; candidateId: string; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set?.matching || input.rowIndex < 0 || input.rowIndex >= set.rows.length) return false;
  const matches = [
    ...set.matching.matches.filter((match) => match.rowIndex !== input.rowIndex),
    { rowIndex: input.rowIndex, candidateId: input.candidateId, score: 100, status: "accepted" as const, manual: true },
  ].sort((a, b) => a.rowIndex - b.rowIndex);
  return updateDraftMatching(db, input.organizationId, input.importId, { ...set.matching, matches }, now);
}

// Lot 14c (décision J) — statut d'un événement à créer, choisi dans l'aperçu.
export async function setImportRowStatuses(
  db: AppDatabase,
  input: { organizationId: string; importId: string; statuses: { rowIndex: number; status: string }[]; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set?.matching) return false;
  const byRow = new Map((set.matching.rowStatuses ?? []).map((entry) => [entry.rowIndex, entry.status]));
  for (const entry of input.statuses) if (entry.rowIndex >= 0 && entry.rowIndex < set.rows.length) byRow.set(entry.rowIndex, entry.status);
  const rowStatuses = [...byRow].map(([rowIndex, status]) => ({ rowIndex, status })).sort((a, b) => a.rowIndex - b.rowIndex);
  return updateDraftMatching(db, input.organizationId, input.importId, { ...set.matching, rowStatuses }, now);
}

// Lot 14 (décision N) — type de prestataire du fichier rapproché d'un type
// du carnet (l'orchestrateur a vérifié qu'il existe) ou créé (null).
// Lot 16 (IMP-12) : `target` dit ce que devient le libellé ; `typeId` reste
// rempli pour un type du carnet (compatibilité des imports en cours).
// Lot 16 (IMP-11) — étapes « Types » et « Doublons » vérifiées par la planner
// (« Continuer ») : l'assistant passe ensuite à la suivante.
export async function markImportStepReviewed(
  db: AppDatabase,
  input: { organizationId: string; importId: string; step: "types" | "matches" | "rows"; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set?.matching) return false;
  const reviewed = { ...(set.matching.reviewed ?? {}), [input.step]: true };
  return updateDraftMatching(db, input.organizationId, input.importId, { ...set.matching, reviewed }, now);
}

// Lot 36b (D11) — lignes d'un import de contacts écartées selon une colonne : l'orchestrateur a
// recalculé les rapprochements des lignes gardées ; l'étape « Lignes » est faite.
export async function setImportRowFilter(
  db: AppDatabase,
  input: { organizationId: string; importId: string; matching: ImportMatching; filter: { columnIndex: number; excluded: string[] } | null; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (set?.entityType !== "contacts") return false;
  if (input.filter && (input.filter.columnIndex < 0 || input.filter.columnIndex >= set.headers.length)) return false;
  // Le filtre enregistré est celui donné (null : aucune ligne écartée), jamais un filtre ancien.
  const rest: ImportMatching = { ...input.matching };
  delete rest.rowFilter;
  const matching: ImportMatching = {
    ...rest,
    ...(input.filter && input.filter.excluded.length > 0 ? { rowFilter: input.filter } : {}),
    reviewed: { ...(input.matching.reviewed ?? {}), rows: true },
  };
  return updateDraftMatching(db, input.organizationId, input.importId, matching, now);
}

export type VendorTypeDecision = { label: string; typeId: string | null; target?: ImportVendorTypeTarget };

export async function decideImportVendorTypes(
  db: AppDatabase,
  input: { organizationId: string; importId: string; decisions: VendorTypeDecision[]; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set?.matching?.vendorTypes) return false;
  const decisions = new Map(input.decisions.map((decision) => [decision.label, decision]));
  const vendorTypes = set.matching.vendorTypes.map((choice) => {
    const decision = decisions.get(choice.label);
    if (!decision) return choice;
    return { ...choice, typeId: decision.typeId, manual: true, ...(decision.target ? { target: decision.target } : {}) };
  });
  return updateDraftMatching(db, input.organizationId, input.importId, { ...set.matching, vendorTypes }, now);
}

// IMP-04 — une colonne sans équivalent est gardée en champ libre (visible sur
// la fiche de l'élément importé) ou ignorée. Seules les colonnes laissées
// « sans équivalent » à l'étape des colonnes, ou déjà décidées ici, peuvent
// l'être.
export function isGapColumn(choice: ImportColumnChoice): boolean {
  return choice.target === "none" || choice.target === "free" || (choice.target === "ignore" && choice.decidedAtGaps === true);
}

export type FreeColumnDecision = { columnIndex: number; keep: boolean };

export async function decideFreeColumns(
  db: AppDatabase,
  input: { organizationId: string; importId: string; decisions: FreeColumnDecision[]; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set) return false;
  const decisions = new Map(input.decisions.map((decision) => [decision.columnIndex, decision.keep]));
  const mapping = set.mapping.map((choice): ImportColumnChoice => {
    const keep = decisions.get(choice.columnIndex);
    if (keep === undefined || !isGapColumn(choice)) return choice;
    return { ...choice, target: keep ? "free" : "ignore", decidedAtGaps: true };
  });
  return updateDraftMappingKeepingMatches(db, input.organizationId, input.importId, mapping, now);
}

// —— IMP-05 : confirmation, journal, annulation ——————————————————————————

export type RecordedItem = NewImportItem;

export async function recordAppliedImport(
  db: AppDatabase,
  input: { organizationId: string; importId: string; items: RecordedItem[]; result: ImportResult; now?: Date },
): Promise<boolean> {
  return markImportApplied(db, { ...input, now: input.now ?? new Date() });
}

export type AppliedImportItem = Pick<ImportItemRow, "id" | "module" | "kind" | "elementId" | "action" | "previous" | "written" | "undoOutcome">;

export type AppliedImportView = ImportSummary & {
  items: AppliedImportItem[];
  // Lot 63b (HUB-14) : intitulés des colonnes gardées comme note sur la fiche.
  keptColumns: string[];
  // Encore annulable : confirmé, non annulé, dans le délai réglé par l'Admin.
  undoable: boolean;
  undoDeadline: Date | null;
};

export async function getAppliedImport(
  db: AppDatabase,
  organizationId: string,
  importId: string,
  now: Date = new Date(),
): Promise<AppliedImportView | null> {
  const row = await findImport(db, organizationId, importId);
  if (!row || (row.status !== "applied" && row.status !== "undone") || !row.appliedAt) return null;
  const { undoRetentionDays } = await getImportLimits(db);
  const deadline = new Date(row.appliedAt.getTime() + undoRetentionDays * DAY_MS);
  const items = (await findImportItems(db, organizationId, importId)).map(({ id, module, kind, elementId, action, previous, written, undoOutcome }) => ({
    id,
    module,
    kind,
    elementId,
    action,
    previous,
    written,
    undoOutcome,
  }));
  const pending = items.some((item) => item.undoOutcome !== "undone" && item.undoOutcome !== "missing");
  const keptColumns = (row.mapping ?? []).filter((choice) => choice.target === "free").map((choice) => row.headers[choice.columnIndex] || `#${choice.columnIndex + 1}`);
  return {
    ...toSummary(row),
    items,
    keptColumns,
    undoable: row.status === "applied" && now < deadline && pending && items.every((item) => item.written !== null),
    undoDeadline: row.status === "applied" ? deadline : null,
  };
}

export async function recordImportUndo(
  db: AppDatabase,
  input: { organizationId: string; importId: string; outcomes: { itemId: string; outcome: "undone" | "kept_modified" | "kept_in_use" | "missing" }[]; now?: Date },
): Promise<void> {
  const view = await getAppliedImport(db, input.organizationId, input.importId);
  if (!view) return;
  const outcomes = new Map(input.outcomes.map((entry) => [entry.itemId, entry.outcome]));
  // L'import est annulé quand chaque élément l'est (ou a disparu depuis) ;
  // sinon il reste confirmé, et les éléments gardés restent annulables.
  const complete = view.items.every((item) => {
    const outcome = outcomes.get(item.id) ?? item.undoOutcome;
    return outcome === "undone" || outcome === "missing";
  });
  await recordUndoOutcomes(db, { ...input, complete, now: input.now ?? new Date() });
}

export async function purgeExpiredImportUndoValues(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  const { undoRetentionDays } = await getImportLimits(db);
  const appliedBefore = new Date(now.getTime() - undoRetentionDays * DAY_MS);
  let cleared = 0;
  for (const organizationId of organizationIds) cleared += await clearExpiredUndoValues(db, organizationId, appliedBefore);
  return cleared;
}

// Lot 70d (UX-08, C-55) : les évènements créés par un import encore appliqué, et sa date (mariage repris).
export async function listImportedEvents(organizationId: string): Promise<{ eventId: string; importedAt: string }[]> {
  return findImportedEvents(appDatabase(), organizationId);
}
