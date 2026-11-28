import { randomUUID } from "node:crypto";
// Lot 71e (HUB-14, SEC-21 ; spécification du lot 71, § 5.5 et § 6 ; ADR 0119) — les PDF des prestataires
// retenus et du programme d'un logiciel de planning entrent dans le journal commun des imports. Mêmes
// contrôles qu'à toute porte : taille réglée par l'Admin, antivirus avant toute lecture, type lu dans le
// contenu, pages et temps de lecture bornés, nom régénéré ; le fichier n'est jamais gardé : seul ce qui
// a été lu (chaque texte neutralisé, =, +, - ou @ en tête) attend la confirmation dans le brouillon, et
// part avec lui (confirmé, abandonné ou expiré). Un import vise toujours un mariage (contrôlé par
// l'appelant, le module des évènements).
import type { AppDatabase } from "@symbola/db/client";
import type { ImportPdfDecisions } from "@symbola/db/schema/hub";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "@symbola/files";
import {
  DEFAULT_PDF_LIMITS,
  looksLikePdf,
  parseEventVendorsExport,
  parseProgramExport,
  readPdfText,
  type EventVendorsExport,
  type ProgramExport,
} from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { findImport, insertImport, updateDraftMatching } from "./import-repository";
import { getImportLimits, sanitizeFileName } from "./imports";

export type { ImportPdfDecisions } from "@symbola/db/schema/hub";

export const PDF_IMPORT_ENTITY_TYPES = ["event_vendors", "program"] as const;
export type PdfImportEntityType = (typeof PDF_IMPORT_ENTITY_TYPES)[number];

export function isPdfImportEntityType(value: string): value is PdfImportEntityType {
  return (PDF_IMPORT_ENTITY_TYPES as readonly string[]).includes(value);
}

export type PdfImportRejection = "empty" | "too_large" | "infected" | "too_many_pages" | "not_pdf" | "not_event_vendors_pdf" | "not_program_pdf";

export type PdfImportDocument = { kind: "event_vendors"; export: EventVendorsExport } | { kind: "program"; program: ProgramExport };

export type StartPdfImportResult = { status: "rejected"; reason: PdfImportRejection } | { status: "started"; importId: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function startPdfImport(
  db: AppDatabase,
  input: { organizationId: string; userId: string; entityType: PdfImportEntityType; fileName: string; bytes: Uint8Array; targetEventId: string; now?: Date },
): Promise<StartPdfImportResult> {
  const now = input.now ?? new Date();
  const limits = await getImportLimits(db);
  if (input.bytes.length === 0) return { status: "rejected", reason: "empty" };
  if (input.bytes.length > limits.maxBytes) return { status: "rejected", reason: "too_large" };
  const env = parseEnv(process.env);
  const scan = await scanBuffer(Buffer.from(input.bytes), { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) return { status: "rejected", reason: "infected" };
  if (!looksLikePdf(input.bytes)) return { status: "rejected", reason: "not_pdf" };
  const profile = planningSoftwareProfile();
  const maxPages = input.entityType === "event_vendors" ? profile.eventVendorsExport.maxPages : profile.programExport.maxPages;
  const read = await readPdfText(input.bytes, { ...DEFAULT_PDF_LIMITS, maxBytes: limits.maxBytes, maxPages });
  const notThis = input.entityType === "event_vendors" ? "not_event_vendors_pdf" : "not_program_pdf";
  if (!read.ok) return { status: "rejected", reason: read.reason === "too_large" ? "too_large" : read.reason === "too_many_pages" ? "too_many_pages" : notThis };
  const calendar = { weekdays: profile.eventSheet.weekdays, months: profile.eventSheet.months };
  let document: PdfImportDocument;
  let neutralized: number;
  let rowCount: number;
  if (input.entityType === "event_vendors") {
    const parsed = parseEventVendorsExport(read.pages, profile.eventVendorsExport, { calendar, footerPrefix: profile.programExport.footerPrefix, plannerRoles: profile.programExport.plannerRoles });
    if (!parsed.ok) return { status: "rejected", reason: notThis };
    document = { kind: "event_vendors", export: parsed.export };
    neutralized = parsed.neutralized;
    rowCount = parsed.export.rows.length;
  } else {
    const parsed = parseProgramExport(read.pages, profile.programExport, calendar);
    if (!parsed.ok) return { status: "rejected", reason: notThis };
    document = { kind: "program", program: parsed.program };
    neutralized = parsed.neutralized;
    rowCount = parsed.program.rows.length;
  }
  const row = await insertImport(db, {
    id: randomUUID(),
    organizationId: input.organizationId,
    createdByUserId: input.userId,
    entityType: input.entityType,
    fileName: sanitizeFileName(input.fileName),
    fileFormat: "pdf",
    fileSizeBytes: input.bytes.length,
    encoding: null,
    delimiter: null,
    headerRowIndex: 0,
    headers: [],
    // Ce qui a été lu, en une cellule : effacé à la confirmation, à l'abandon et à l'expiration.
    rows: [[JSON.stringify(document)]],
    sourceLineNumbers: [],
    rowCount,
    neutralizedCells: neutralized,
    mapping: [],
    matching: { matches: [], rowEvents: [], pdf: {} },
    targetEventId: input.targetEventId,
    expiresAt: new Date(now.getTime() + limits.draftRetentionDays * DAY_MS),
    createdAt: now,
    updatedAt: now,
  });
  return { status: "started", importId: row.id };
}

export type PdfImportDraft = {
  id: string;
  entityType: PdfImportEntityType;
  fileName: string;
  createdByUserId: string;
  createdAt: Date;
  expiresAt: Date;
  targetEventId: string | null;
  takeoverId: string | null;
  neutralizedCells: number;
  document: PdfImportDocument;
  decisions: ImportPdfDecisions;
};

// Le brouillon d'un PDF de l'organisation, encore ouvert ; null sinon (d'une autre organisation, d'une
// autre sorte, confirmé, abandonné, expiré : la même réponse, SEC-13).
export async function getPdfImportDraft(db: AppDatabase, organizationId: string, importId: string, now: Date = new Date()): Promise<PdfImportDraft | null> {
  const row = await findImport(db, organizationId, importId);
  if (!row || row.status !== "draft" || row.expiresAt <= now || !isPdfImportEntityType(row.entityType)) return null;
  const cell = row.rows?.[0]?.[0];
  if (!cell) return null;
  let document: PdfImportDocument;
  try {
    document = JSON.parse(cell) as PdfImportDocument;
  } catch {
    return null;
  }
  if (document.kind !== row.entityType) return null;
  return {
    id: row.id,
    entityType: row.entityType,
    fileName: row.fileName,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    targetEventId: row.targetEventId ?? null,
    takeoverId: row.takeoverId ?? null,
    neutralizedCells: row.neutralizedCells,
    document,
    decisions: row.matching?.pdf ?? {},
  };
}

// Les choix de la planner, fusionnés avec les précédents (une ligne, un intervenant à la fois). false :
// brouillon introuvable.
export async function savePdfImportDecisions(
  db: AppDatabase,
  input: { organizationId: string; importId: string; decisions: ImportPdfDecisions; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const row = await findImport(db, input.organizationId, input.importId);
  if (!row || row.status !== "draft" || row.expiresAt <= now || !isPdfImportEntityType(row.entityType)) return false;
  const current: ImportPdfDecisions = row.matching?.pdf ?? {};
  const vendorRows = new Map((current.vendorRows ?? []).map((entry) => [entry.line, entry] as const));
  for (const entry of input.decisions.vendorRows ?? []) vendorRows.set(entry.line, { ...vendorRows.get(entry.line), ...entry });
  const speakerSlots = new Map((current.speakerSlots ?? []).map((entry) => [entry.index, entry] as const));
  for (const entry of input.decisions.speakerSlots ?? []) speakerSlots.set(entry.index, entry);
  const merged: ImportPdfDecisions = {
    ...current,
    ...(input.decisions.coupleConfirmed !== undefined ? { coupleConfirmed: input.decisions.coupleConfirmed } : {}),
    ...(input.decisions.reviewed !== undefined ? { reviewed: input.decisions.reviewed } : {}),
    vendorRows: [...vendorRows.values()].sort((a, b) => a.line - b.line),
    speakerSlots: [...speakerSlots.values()].sort((a, b) => a.index - b.index),
  };
  return updateDraftMatching(db, input.organizationId, input.importId, { ...(row.matching ?? { matches: [], rowEvents: [] }), pdf: merged }, now);
}
