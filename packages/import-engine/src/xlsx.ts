// Lecteur .xlsx minimal (ADR 0022) : première feuille visible, valeurs
// seulement. Les formules ne sont jamais recalculées : seule la dernière
// valeur calculée, mise en cache par le tableur, est lue. Les cellules au
// format date (numéro de série Excel) deviennent « AAAA-MM-JJ ».
import type { ParsedLine } from "./csv";
import { ReadError } from "./types";
import { assertNoDoctype, attributeIgnoringPrefix, attributes, decodeEntities, decodeOoxmlEscapes, richText } from "./xml";
import { ZipArchive } from "./zip";

type XlsxLimits = { maxRows: number; maxColumns: number; maxUncompressedBytes: number };
type CellKind = "number" | "date" | "datetime" | "time";

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
const BUILTIN_DATETIME_FORMATS = new Set([22]);
const BUILTIN_TIME_FORMATS = new Set([18, 19, 20, 21, 45, 46, 47]);

// Identifie un classeur à partir de [Content_Types].xml ; refuse avec une
// indication les formats proches qu'on ne lit pas.
export function assertReadableWorkbook(zip: ZipArchive): void {
  const contentTypes = zip.readText("[Content_Types].xml");
  if (contentTypes === null) {
    const mimetype = zip.readText("mimetype");
    if (mimetype?.includes("opendocument.spreadsheet")) throw new ReadError("unsupported_format", "ods");
    throw new ReadError("unsupported_format");
  }
  assertNoDoctype(contentTypes);
  if (contentTypes.includes("ms-excel.sheet.macroEnabled.main+xml")) throw new ReadError("unsupported_format", "xlsm");
  if (!/spreadsheetml\.(sheet|template)\.main\+xml/.test(contentTypes)) throw new ReadError("unsupported_format");
}

export function readXlsx(bytes: Uint8Array, limits: XlsxLimits): ParsedLine[] {
  const zip = new ZipArchive(bytes, limits.maxUncompressedBytes);
  assertReadableWorkbook(zip);

  const workbookPath = relationshipTarget(zip, "_rels/.rels", "", "/officeDocument") ?? "xl/workbook.xml";
  const workbook = readXml(zip, workbookPath);
  if (workbook === null) throw new ReadError("malformed");
  const workbookDir = dirname(workbookPath);
  const workbookRels = `${workbookDir}_rels/${basename(workbookPath)}.rels`;

  const sheetRelationId = firstVisibleSheetRelationId(workbook);
  if (!sheetRelationId) throw new ReadError("empty");
  const sheetPath = relationshipTargetById(zip, workbookRels, workbookDir, sheetRelationId);
  if (!sheetPath) throw new ReadError("malformed");
  const sheet = readXml(zip, sheetPath);
  if (sheet === null) throw new ReadError("malformed");

  const sharedStringsPath = relationshipTarget(zip, workbookRels, workbookDir, "/sharedStrings");
  const stylesPath = relationshipTarget(zip, workbookRels, workbookDir, "/styles");
  const sharedStrings = sharedStringsPath ? parseSharedStrings(readXml(zip, sharedStringsPath) ?? "") : [];
  const styleKinds = stylesPath ? parseStyleKinds(readXml(zip, stylesPath) ?? "") : [];
  const date1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904\s*=\s*["'](?:1|true)["']/.test(workbook);

  return parseSheet(sheet, { sharedStrings, styleKinds, date1904, limits });
}

function readXml(zip: ZipArchive, path: string): string | null {
  const xml = zip.readText(path);
  if (xml !== null) assertNoDoctype(xml);
  return xml;
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index + 1);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function resolveTarget(baseDir: string, target: string): string {
  const raw = target.startsWith("/") ? target.slice(1) : `${baseDir}${target}`;
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

function relationships(zip: ZipArchive, relsPath: string): Map<string, string>[] {
  const xml = readXml(zip, relsPath);
  if (xml === null) return [];
  return [...xml.matchAll(/<(?:\w+:)?Relationship\b([^>]*?)\/?>/g)].map((match) => attributes(match[1] ?? ""));
}

function relationshipTarget(zip: ZipArchive, relsPath: string, baseDir: string, typeSuffix: string): string | null {
  const relation = relationships(zip, relsPath).find((attrs) => attrs.get("Type")?.endsWith(typeSuffix));
  const target = relation?.get("Target");
  return target ? resolveTarget(baseDir, target) : null;
}

function relationshipTargetById(zip: ZipArchive, relsPath: string, baseDir: string, id: string): string | null {
  const relation = relationships(zip, relsPath).find((attrs) => attrs.get("Id") === id);
  const target = relation?.get("Target");
  return target ? resolveTarget(baseDir, target) : null;
}

function firstVisibleSheetRelationId(workbook: string): string | undefined {
  const sheets = [...workbook.matchAll(/<(?:\w+:)?sheet\b([^>]*?)\/?>/g)].map((match) => attributes(match[1] ?? ""));
  const visible = sheets.find((attrs) => {
    const state = attrs.get("state");
    return state !== "hidden" && state !== "veryHidden";
  });
  const chosen = visible ?? sheets[0];
  return chosen ? attributeIgnoringPrefix(chosen, "id") : undefined;
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g)].map((match) => richText(match[1] ?? ""));
}

// Pour chaque style de cellule (index dans <cellXfs>), le type de valeur
// qu'annonce son format de nombre.
function parseStyleKinds(xml: string): CellKind[] {
  const customFormats = new Map<number, string>();
  for (const match of xml.matchAll(/<(?:\w+:)?numFmt\b([^>]*?)\/?>/g)) {
    const attrs = attributes(match[1] ?? "");
    const id = Number(attrs.get("numFmtId"));
    if (Number.isInteger(id)) customFormats.set(id, attrs.get("formatCode") ?? "");
  }
  const cellXfs = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(xml)?.[1] ?? "";
  return [...cellXfs.matchAll(/<(?:\w+:)?xf\b([^>]*?)\/?>/g)].map((match) => {
    const id = Number(attributes(match[1] ?? "").get("numFmtId") ?? 0);
    const custom = customFormats.get(id);
    return custom !== undefined ? kindOfFormatCode(custom) : kindOfBuiltinFormat(id);
  });
}

function kindOfBuiltinFormat(id: number): CellKind {
  if (BUILTIN_DATE_FORMATS.has(id)) return "date";
  if (BUILTIN_DATETIME_FORMATS.has(id)) return "datetime";
  if (BUILTIN_TIME_FORMATS.has(id)) return "time";
  return "number";
}

export function kindOfFormatCode(formatCode: string): CellKind {
  // Sans les textes entre guillemets, caractères échappés et sections entre
  // crochets (couleur, langue, durée écoulée).
  const cleaned = formatCode
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[[^\]]*\]/g, "")
    .toLowerCase();
  const words = cleaned.match(/[a-z]+/g) ?? [];
  const hasDate = words.some((word) => /^(y+|d+)$/.test(word));
  const hasTime = words.some((word) => /^(h+|s+|am|pm)$/.test(word));
  if (hasDate && hasTime) return "datetime";
  if (hasDate) return "date";
  if (hasTime) return "time";
  return "number";
}

type SheetContext = {
  sharedStrings: string[];
  styleKinds: CellKind[];
  date1904: boolean;
  limits: XlsxLimits;
};

function parseSheet(xml: string, context: SheetContext): ParsedLine[] {
  const sheetData = /<(?:\w+:)?sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?sheetData>)/.exec(xml)?.[1] ?? "";
  const lines: ParsedLine[] = [];
  let previousRow = 0;

  for (const rowMatch of sheetData.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const rowAttrs = attributes(rowMatch[1] ?? "");
    const rowNumber = Number(rowAttrs.get("r")) || previousRow + 1;
    previousRow = rowNumber;

    const cells: string[] = [];
    let previousColumn = -1;
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const cellAttrs = attributes(cellMatch[1] ?? "");
      const reference = cellAttrs.get("r");
      const column = reference ? columnIndex(reference) : previousColumn + 1;
      previousColumn = column;
      const value = cellValue(cellAttrs, cellMatch[2] ?? "", context);
      if (value === "") continue;
      if (column >= context.limits.maxColumns) throw new ReadError("too_many_columns");
      while (cells.length < column) cells.push("");
      cells[column] = value;
    }
    if (cells.length === 0) continue;
    lines.push({ cells, lineNumber: rowNumber });
    // En-tête et lignes de titre éventuelles en plus des données.
    if (lines.length > context.limits.maxRows + 20) throw new ReadError("too_many_rows");
  }
  return lines;
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function cellValue(attrs: Map<string, string>, inner: string, context: SheetContext): string {
  const type = attrs.get("t") ?? "n";
  const raw = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner)?.[1];

  switch (type) {
    case "s": {
      const index = Number(raw);
      return Number.isInteger(index) ? (context.sharedStrings[index] ?? "") : "";
    }
    case "inlineStr": {
      const is = /<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/.exec(inner)?.[1] ?? "";
      return richText(is);
    }
    case "str":
      return raw === undefined ? "" : decodeOoxmlEscapes(decodeEntities(raw));
    case "b":
      return raw === undefined ? "" : raw.trim() === "1" ? "TRUE" : "FALSE";
    case "e":
      return "";
    case "d":
      // Date ISO 8601 stockée telle quelle (rare : Excel « strict »).
      return raw === undefined ? "" : decodeEntities(raw).slice(0, 10);
    default: {
      if (raw === undefined || raw.trim() === "") return "";
      const number = Number(raw);
      if (!Number.isFinite(number)) return "";
      const style = Number(attrs.get("s") ?? 0);
      const kind = context.styleKinds[style] ?? "number";
      return kind === "number" ? formatNumber(number) : formatSerial(number, kind, context.date1904);
    }
  }
}

// 15 chiffres significatifs : la précision affichée par Excel, sans les
// artefacts binaires (1234.5599999999999 → 1234.56).
function formatNumber(value: number): string {
  return String(Number(value.toPrecision(15)));
}

const DAY_MS = 86_400_000;

function formatSerial(serial: number, kind: Exclude<CellKind, "number">, date1904: boolean): string {
  // Système 1900 : Excel compte un 29 février 1900 qui n'existe pas (série
  // 60) ; la base du 30/12/1899 vaut à partir du 1er mars 1900.
  const base = date1904 ? Date.UTC(1904, 0, 1) : serial < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  const totalSeconds = Math.round(serial * 86_400);
  const days = Math.floor(totalSeconds / 86_400);
  const seconds = totalSeconds - days * 86_400;
  const date = new Date(base + days * DAY_MS).toISOString().slice(0, 10);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = seconds % 60;
  const time = ss === 0 ? `${hh}:${mm}` : `${hh}:${mm}:${String(ss).padStart(2, "0")}`;
  if (kind === "date") return date;
  if (kind === "time") return time;
  return `${date} ${time}`;
}
