export { readImportFile } from "./read";
export { neutralizeCell, needsNeutralization } from "./neutralize";
export { parseDelimited } from "./csv";
// Lecteur ZIP, aussi utilisé pour vérifier l'archive de l'export RGPD (RGPD-02).
export { ZipArchive } from "./zip";
export type {
  Delimiter,
  ImportFormat,
  ImportTable,
  ReadFailureReason,
  ReadLimits,
  ReadResult,
  TextEncoding,
  UnsupportedHint,
} from "./types";
export {
  LOW_CONFIDENCE_THRESHOLD,
  normalizeLabel,
  profileColumn,
  proposeMapping,
  type ColumnProfile,
  type ColumnProposal,
  type MappableField,
} from "./mapping";
export {
  detectDateOrder,
  detectDecimalStyle,
  looksLikeEmail,
  looksLikePhone,
  parseAmountCents,
  parseDate,
  parsePercentageBasisPoints,
  type DateOrder,
  type DecimalStyle,
} from "./values";
export {
  parseImportRows,
  type ColumnAssignment,
  type ImportValue,
  type ParsedImportRow,
  type RowError,
  type RowErrorCode,
  type RowFieldDefinition,
  type ValueSynonyms,
} from "./rows";
export {
  MATCH_THRESHOLD,
  bestMatch,
  clientsSimilarity,
  eventSimilarity,
  labelSimilarity,
  matchVendorType,
  textSimilarity,
  vendorSimilarity,
  VENDOR_TYPE_SYNONYM_SCORE,
  type MatchCandidate,
  type PersonName,
} from "./similarity";

// Lot 14 (ADR 0034) — lecture des PDF et exports d'un logiciel de planification tiers.
export { DEFAULT_PDF_LIMITS, looksLikePdf, readPdfText, type PdfFailureReason, type PdfLimits, type PdfPage, type PdfReadResult, type PdfTextItem } from "./pdf";
export { decodeHtmlEntities, looksLikeUrl, normalizePostalCode, splitList, splitPhones, tidyText, type PhoneEntry } from "./cleanup";
export {
  parseEventSheet,
  splitPersonName,
  type EventSheet,
  type EventSheetPerson,
  type EventSheetPlace,
  type EventSheetResult,
} from "./third-party/event-sheet";
export {
  cleanVendorImportText,
  detectVendorsExport,
  normalizeVendorImportValues,
  parseVendorRating,
  normalizeVendorsExportRow,
  proposeVendorsExportMapping,
  type VendorsExportDetection,
  type VendorsExportProposal,
  type VendorsExportField,
  type VendorsExportRow,
} from "./third-party/vendors-export";
export {
  EVENT_SHEET_COLUMNS,
  EVENT_SHEET_FREE_COLUMNS,
  EVENT_SHEET_TECHNICAL_COLUMNS,
  assignPhones,
  eventSheetRejectionRow,
  eventSheetRow,
  eventSheetStatus,
  parsePlacesCell,
  placesCell,
  type EventSheetColumn,
  type EventSheetRejection,
} from "./third-party/event-sheet-row";
