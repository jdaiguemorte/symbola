// Lot 5 — orchestration de l'import par le hub (PRD §7, ADR 0022). Exposé par
// service.ts. IMP-01 : réception du fichier (taille, antivirus, lecture),
// import en cours gardé en attente ; rien n'est écrit dans les modules avant
// la confirmation (IMP-05).
import { IMPORT_FIELDS, type ImportEntityType, type ImportFieldDefinition } from "@symbola/contracts";
import type { AppDatabase } from "@symbola/db/client";
import type { ImportColumnChoice } from "@symbola/db/schema/hub";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "@symbola/files";
import {
  LOW_CONFIDENCE_THRESHOLD,
  proposeMapping,
  readImportFile,
  type ReadFailureReason,
  type UnsupportedHint,
} from "@symbola/import-engine";
import { starterImportSynonyms } from "@symbola/starter-templates";
import {
  cancelExpiredDrafts,
  findImport,
  findImports,
  insertImport,
  markDraftCancelled,
  updateDraftMapping,
  type ImportRow,
} from "./import-repository";
import { findPlatformSettings, insertDefaultPlatformSettings } from "./repository";

export { IMPORT_ENTITY_TYPES, type ImportEntityType } from "@symbola/contracts";
export type { ImportColumnChoice } from "@symbola/db/schema/hub";

// Module qui reçoit chaque type d'éléments : un type dont le module n'est pas
// souscrit n'est pas proposé (dégradation propre, CLAUDE.md §2.3).
export const IMPORT_ENTITY_MODULE: Record<ImportEntityType, "events" | "budget" | "quotes"> = {
  events: "events",
  tasks: "events",
  vendor_slots: "events",
  prospect_sources: "events",
  loss_reasons: "events",
  budget_lines: "budget",
  catalog_items: "quotes",
  payment_methods: "quotes",
};

export type ImportLimits = { maxBytes: number; maxRows: number; draftRetentionDays: number };

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
    draftRetentionDays: settings.importDraftRetentionDays,
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

// Nom affiché au journal : sans chemin ni caractère de contrôle, borné.
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return cleaned === "" ? "fichier" : cleaned;
}

export type ImportSummary = {
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
  return { ...toSummary(row), previewRows: row.rows.slice(0, PREVIEW_ROWS), mapping: row.mapping };
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
  const proposals = proposeMapping({ headers: row.headers, rows: row.rows, fields, synonyms: starterImportSynonyms().columns });
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
  return markDraftCancelled(db, organizationId, importId, now);
}

// Purge horaire (lib/import-purge.ts) : les lignes en attente d'un import
// abandonné sans être confirmé sont effacées à son expiration.
export async function purgeExpiredImportDrafts(db: AppDatabase, organizationIds: string[], now: Date = new Date()): Promise<number> {
  let purged = 0;
  for (const organizationId of organizationIds) purged += await cancelExpiredDrafts(db, organizationId, now);
  return purged;
}
