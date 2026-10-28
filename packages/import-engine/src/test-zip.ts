// Outil de test : fabrique une archive zip (et un .xlsx minimal) en mémoire,
// pour essayer le lecteur sur des fichiers malformés ou hostiles.
import { deflateRawSync } from "node:zlib";

// `predeflated` : `data` est déjà compressé (taille réelle inconnue de l'en-tête,
// comme dans une bombe zip qui ment sur sa taille).
export type TestZipEntry = { name: string; data: string | Uint8Array; store?: boolean; predeflated?: boolean; flags?: number };

export function buildZip(entries: TestZipEntry[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const raw = typeof entry.data === "string" ? Buffer.from(entry.data, "utf-8") : Buffer.from(entry.data);
    const data = entry.store || entry.predeflated ? raw : deflateRawSync(raw);
    const name = Buffer.from(entry.name, "utf-8");
    const method = entry.store ? 0 : 8;
    const flags = entry.flags ?? 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>';
const ROOT_RELS =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
const WORKBOOK =
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Feuil1" sheetId="1" r:id="rId1"/></sheets></workbook>';
const WORKBOOK_RELS =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

// Classeur minimal : `sheetData` est le contenu de <sheetData>.
export function buildXlsx(options: {
  sheetData: string;
  sharedStrings?: string[];
  styles?: string;
  sharedStringsXml?: string;
  sheetEntry?: Pick<TestZipEntry, "data" | "predeflated">;
  contentTypes?: string;
}): Uint8Array {
  const shared = (options.sharedStrings ?? []).map((text) => `<si><t>${text}</t></si>`).join("");
  return buildZip([
    { name: "[Content_Types].xml", data: options.contentTypes ?? CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: WORKBOOK },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${options.sheetData}</sheetData></worksheet>`,
      ...options.sheetEntry,
    },
    {
      name: "xl/sharedStrings.xml",
      data: options.sharedStringsXml ?? `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared}</sst>`,
    },
    { name: "xl/styles.xml", data: options.styles ?? "<styleSheet><cellXfs><xf numFmtId=\"0\"/><xf numFmtId=\"14\"/></cellXfs></styleSheet>" },
  ]);
}
