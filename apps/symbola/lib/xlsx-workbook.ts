// Lot 28c (BUD-10, décision D6) — classeur XLSX écrit par l'app, sans
// dépendance (comme la lecture, ADR 0022) : SpreadsheetML minimal rangé dans
// l'archive ZIP de l'app (@symbola/privacy). Chaînes en ligne (pas de table
// partagée), quelques styles fixes : en-tête à la couleur de l'organisation,
// gras, montant en euros, date, pourcentage. Une cellule de texte n'est jamais
// une formule : rien n'est interprété à l'ouverture.
import { createZip } from "@symbola/privacy";

export type XlsxCell =
  | { kind: "text"; value: string; bold?: boolean }
  // Montant en centimes entiers, écrit en euros sans passer par un float.
  | { kind: "money"; cents: number; bold?: boolean }
  // Date AAAA-MM-JJ, écrite en numéro de série du tableur.
  | { kind: "date"; value: string }
  // Taux en points de base (2000 = 20 %).
  | { kind: "percent"; basisPoints: number }
  | null;

export type XlsxSheet = { name: string; columns: { header: string; width: number }[]; rows: XlsxCell[][] };

export type XlsxWorkbookInput = {
  title: string;
  author: string;
  // #RRGGBB : fond des en-têtes de colonnes.
  headerColor: string;
  sheets: XlsxSheet[];
  createdAt?: Date;
};

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAX_CELL_LENGTH = 32767;

// Index des styles de cellule (cellXfs de styles.xml).
const STYLE = { header: 1, bold: 2, money: 3, moneyBold: 4, date: 5, percent: 6 } as const;

function escapeXml(value: string): string {
  return value
    // Caractères interdits en XML 1.0 (contrôles hors tabulation et fins de ligne).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function columnLetter(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

// 123456 → « 1234.56 », -5 → « -0.05 » : la valeur décimale lue par le tableur.
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function basisPointsToFraction(basisPoints: number): string {
  return `${Math.floor(basisPoints / 10000)}.${String(basisPoints % 10000).padStart(4, "0")}`;
}

// Numéro de série du tableur (calendrier 1900) : jours depuis le 30/12/1899.
export function dateSerial(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

// Couleur #RRGGBB sombre (luminosité perçue) : texte blanc dessus, sinon texte
// sombre. Partagé avec le PDF du budget.
export function isDarkColor(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const brightness = ((value >> 16) & 0xff) * 299 + ((value >> 8) & 0xff) * 587 + (value & 0xff) * 114;
  return brightness < 150_000;
}

function headerTextColor(hex: string): string {
  return isDarkColor(hex) ? "FFFFFFFF" : "FF111111";
}

function cellXml(cell: XlsxCell, reference: string, header = false): string {
  if (cell === null) return "";
  switch (cell.kind) {
    case "text": {
      const style = header ? STYLE.header : cell.bold ? STYLE.bold : 0;
      const text = escapeXml(cell.value.slice(0, MAX_CELL_LENGTH));
      return `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${text}</t></is></c>`;
    }
    case "money":
      return `<c r="${reference}" s="${cell.bold ? STYLE.moneyBold : STYLE.money}"><v>${centsToDecimal(cell.cents)}</v></c>`;
    case "date":
      return `<c r="${reference}" s="${STYLE.date}"><v>${dateSerial(cell.value)}</v></c>`;
    case "percent":
      return `<c r="${reference}" s="${STYLE.percent}"><v>${basisPointsToFraction(cell.basisPoints)}</v></c>`;
  }
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`).join("");
  const header = `<row r="1">${sheet.columns.map((column, index) => cellXml({ kind: "text", value: column.header }, `${columnLetter(index)}1`, true)).join("")}</row>`;
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const number = rowIndex + 2;
      return `<row r="${number}">${row.map((cell, index) => cellXml(cell, `${columnLetter(index)}${number}`)).join("")}</row>`;
    })
    .join("");
  return (
    `${XML_HEAD}<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    // La ligne d'en-tête reste visible au défilement.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${header}${rows}</sheetData></worksheet>`
  );
}

function stylesXml(headerColor: string): string {
  const fill = headerColor.slice(1).toUpperCase();
  return (
    `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">` +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>' +
    '<fonts count="3">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    `<font><b/><sz val="11"/><color rgb="${headerTextColor(headerColor)}"/><name val="Calibri"/></font>` +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    "</fonts>" +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF${fill}"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="7">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

// Nom de feuille : 31 caractères au plus, sans []:*?/\ (règles du tableur).
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Feuille";
}

export function createXlsx(input: XlsxWorkbookInput): Buffer {
  if (!/^#[0-9a-fA-F]{6}$/.test(input.headerColor)) throw new Error("couleur d'en-tête invalide");
  const createdAt = (input.createdAt ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const sheets = input.sheets.map((sheet, index) => ({ ...sheet, file: `sheet${index + 1}.xml`, id: index + 1 }));
  const contentTypes =
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((sheet) => `<Override PartName="/xl/worksheets/${sheet.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    "</Types>";
  const rootRels =
    `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
    `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    "</Relationships>";
  const workbook =
    `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>` +
    sheets.map((sheet) => `<sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="${sheet.id}" r:id="rId${sheet.id}"/>`).join("") +
    "</sheets></workbook>";
  const workbookRels =
    `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
    sheets.map((sheet) => `<Relationship Id="rId${sheet.id}" Type="${REL_NS}/worksheet" Target="worksheets/${sheet.file}"/>`).join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>` +
    "</Relationships>";
  const core =
    `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escapeXml(input.title)}</dc:title><dc:creator>${escapeXml(input.author)}</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created></cp:coreProperties>`;

  return createZip(
    [
      { name: "[Content_Types].xml", data: contentTypes },
      { name: "_rels/.rels", data: rootRels },
      { name: "docProps/core.xml", data: core },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
      { name: "xl/styles.xml", data: stylesXml(input.headerColor) },
      ...sheets.map((sheet) => ({ name: `xl/worksheets/${sheet.file}`, data: sheetXml(sheet) })),
    ],
    input.createdAt,
  );
}
