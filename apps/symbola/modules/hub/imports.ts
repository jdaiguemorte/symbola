import { randomUUID } from "node:crypto";
// Lot 5 — orchestration de l'import par le hub (PRD §7, ADR 0022). Exposé par
// service.ts. IMP-01 : réception du fichier (taille, antivirus, lecture),
// import en cours gardé en attente ; rien n'est écrit dans les modules avant
// la confirmation (IMP-05).
import { IMPORT_FIELDS, type ImportEntityType, type ImportFieldDefinition } from "@symbola/contracts";
import type { AppDatabase } from "@symbola/db/client";
import type { ImportColumnChoice, ImportMatch, ImportMatching, ImportResult } from "@symbola/db/schema/hub";
import { parseEnv } from "@symbola/env";
import { createStorageClient, scanBuffer, sealFile, uploadPrivateObject } from "@symbola/files";
import {
  EVENT_SHEET_COLUMNS,
  EVENT_SHEET_FREE_COLUMNS,
  EVENT_SHEET_TECHNICAL_COLUMNS,
  LOW_CONFIDENCE_THRESHOLD,
  looksLikePdf,
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
  type ImportItemRow,
  type ImportRow,
  type NewImportItem,
} from "./import-repository";
import { cancelImportJobs, createImportJob, isReadingSheets, listImportJobs, type ImportJobView } from "./import-jobs";
import { findPlatformSettings, insertDefaultPlatformSettings } from "./repository";

export { IMPORT_ENTITY_TYPES, type ImportEntityType } from "@symbola/contracts";
export type { ImportColumnChoice, ImportMatch, ImportMatching, ImportResult, ImportRowEvent, ImportVendorTypeChoice } from "@symbola/db/schema/hub";

// Module qui reçoit chaque type d'éléments : un type dont le module n'est pas
// souscrit n'est pas proposé (dégradation propre, CLAUDE.md §2.3).
export const IMPORT_ENTITY_MODULE: Record<ImportEntityType, "events" | "budget" | "quotes" | "vendors"> = {
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
};

export type ImportLimits = { maxBytes: number; maxRows: number; maxSheets: number; draftRetentionDays: number; undoRetentionDays: number };

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
  };
}

export type StartImportInput = {
  organizationId: string;
  userId: string;
  entityType: ImportEntityType;
  fileName: string;
  bytes: Uint8Array;
  now?: Date;
};

export type ImportRejectionReason = ReadFailureReason | "infected";

export type StartImportResult =
  | { status: "rejected"; reason: ImportRejectionReason; hint?: UnsupportedHint }
  | { status: "started"; importId: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function startImport(db: AppDatabase, input: StartImportInput): Promise<StartImportResult> {
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
  const known =
    row.entityType === "vendors"
      ? proposeVendorsExportMapping(row, planningSoftwareProfile().vendors, fields.map((field) => field.key))
      : null;
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
  if (errors.length > 0) return { status: "invalid", errors };

  const saved = await updateDraftMapping(db, input.organizationId, input.importId, mapping, now);
  return saved ? { status: "saved" } : { status: "not_found" };
}

export async function listImports(db: AppDatabase, organizationId: string): Promise<ImportSummary[]> {
  return (await findImports(db, organizationId)).map(toSummary);
}

export async function cancelImport(db: AppDatabase, organizationId: string, importId: string, now: Date = new Date()): Promise<boolean> {
  const cancelled = await markDraftCancelled(db, organizationId, importId, now);
  // Lot 15 : la lecture en cours s'arrête, les fiches encore gardées sont supprimées.
  if (cancelled) await cancelImportJobs(db, organizationId, importId, now);
  return cancelled;
}

// Purge horaire (lib/import-purge.ts) : les lignes en attente d'un import
// abandonné sans être confirmé sont effacées à son expiration.
export async function purgeExpiredImportDrafts(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  let purged = 0;
  for (const organizationId of organizationIds) purged += await cancelExpiredDrafts(db, organizationId, now);
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
  };
}

export async function saveImportMatching(
  db: AppDatabase,
  input: { organizationId: string; importId: string; matching: ImportMatching; now?: Date },
): Promise<boolean> {
  return updateDraftMatching(db, input.organizationId, input.importId, input.matching, input.now ?? new Date());
}

// Décision de la planner sur des rapprochements proposés : un par un ou en
// lot (plusieurs lignes à la fois). Une ligne sans rapprochement est ignorée.
export type MatchDecision = { rowIndex: number; decision: "accept" | "refuse" };

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
    return { ...match, status: decision === "accept" ? "accepted" : "refused" };
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
export type VendorTypeDecision = { label: string; typeId: string | null };

export async function decideImportVendorTypes(
  db: AppDatabase,
  input: { organizationId: string; importId: string; decisions: VendorTypeDecision[]; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const set = await getImportWorkingSet(db, input.organizationId, input.importId, now);
  if (!set?.matching?.vendorTypes) return false;
  const decisions = new Map(input.decisions.map((decision) => [decision.label, decision.typeId]));
  const vendorTypes = set.matching.vendorTypes.map((choice) =>
    decisions.has(choice.label) ? { ...choice, typeId: decisions.get(choice.label) ?? null, manual: true } : choice,
  );
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
  return {
    ...toSummary(row),
    items,
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
