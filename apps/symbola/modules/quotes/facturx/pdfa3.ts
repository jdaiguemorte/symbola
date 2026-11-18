// Lot 41 (FAC-10, D3, ADR 0080) — du PDF de la facture au Factur-X : le PDF rendu par
// @react-pdf/renderer (polices incorporées, D5) reçoit une mise à jour incrémentale, comme le
// prévoit la norme PDF (ISO 32000, § 7.5.6) : de nouveaux objets ajoutés à la fin du fichier, sans
// réécrire ce qui précède. Ces objets font du fichier un PDF/A-3 (niveau B) qui porte son fichier
// structuré : métadonnées XMP (identification PDF/A et schéma d'extension Factur-X), profil sRGB
// (« OutputIntent »), fichier joint « factur-x.xml » en relation « Alternative », catalogue
// complété. Aucune dépendance (D3 a) ; le lecteur ne sait que ce qu'il faut : table de références
// classique, catalogue, dictionnaire des noms. Les validateurs veraPDF et Mustang le contrôlent en
// CI (D4, ADR 0081).
import { createHash } from "node:crypto";
import { srgbIccProfile, SRGB_DESCRIPTION } from "./icc";

export const FACTURX_FILENAME = "factur-x.xml";
export const FACTURX_PRODUCER = "Symbola";

export class UnreadablePdfError extends Error {
  constructor(reason: string) {
    super(`PDF illisible pour Factur-X : ${reason}`);
    this.name = "UnreadablePdfError";
  }
}

export type FacturXAttachmentInput = {
  xml: string;
  title: string;
  issuedAt: Date;
  // « EN 16931 » (D2) ; « INVOICE » vaut aussi pour un avoir (spécification Factur-X 1.0).
  conformanceLevel: "EN 16931";
};

// --- Lecture minimale ---

const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

type Ref = { num: number; gen: number };
type Value =
  | { kind: "dict"; entries: [string, Value][]; raw: string }
  | { kind: "ref"; ref: Ref; raw: string }
  | { kind: "other"; raw: string };

class Reader {
  constructor(
    private readonly text: string,
    public pos: number,
  ) {}

  skip(): void {
    for (;;) {
      const code = this.text.charCodeAt(this.pos);
      if (WHITESPACE.has(code)) this.pos += 1;
      else if (code === 0x25) {
        while (this.pos < this.text.length && this.text[this.pos] !== "\n" && this.text[this.pos] !== "\r") this.pos += 1;
      } else return;
    }
  }

  private regular(): string {
    const start = this.pos;
    while (this.pos < this.text.length) {
      const code = this.text.charCodeAt(this.pos);
      if (WHITESPACE.has(code) || DELIMITERS.has(code)) break;
      this.pos += 1;
    }
    if (start === this.pos) throw new UnreadablePdfError(`jeton attendu à ${start}`);
    return this.text.slice(start, this.pos);
  }

  name(): string {
    this.skip();
    if (this.text[this.pos] !== "/") throw new UnreadablePdfError(`nom attendu à ${this.pos}`);
    this.pos += 1;
    return `/${this.regularOrEmpty()}`;
  }

  private regularOrEmpty(): string {
    const start = this.pos;
    while (this.pos < this.text.length) {
      const code = this.text.charCodeAt(this.pos);
      if (WHITESPACE.has(code) || DELIMITERS.has(code)) break;
      this.pos += 1;
    }
    return this.text.slice(start, this.pos);
  }

  private literalString(): void {
    let depth = 0;
    for (; this.pos < this.text.length; this.pos += 1) {
      const char = this.text[this.pos];
      if (char === "\\") this.pos += 1;
      else if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          this.pos += 1;
          return;
        }
      }
    }
    throw new UnreadablePdfError("chaîne non fermée");
  }

  value(): Value {
    this.skip();
    const start = this.pos;
    const char = this.text[this.pos];
    if (char === "<" && this.text[this.pos + 1] === "<") {
      this.pos += 2;
      const entries: [string, Value][] = [];
      for (;;) {
        this.skip();
        if (this.text.startsWith(">>", this.pos)) {
          this.pos += 2;
          return { kind: "dict", entries, raw: this.text.slice(start, this.pos) };
        }
        const key = this.name();
        entries.push([key, this.value()]);
      }
    }
    if (char === "<") {
      const end = this.text.indexOf(">", this.pos);
      if (end < 0) throw new UnreadablePdfError("chaîne hexadécimale non fermée");
      this.pos = end + 1;
    } else if (char === "(") {
      this.literalString();
    } else if (char === "[") {
      this.pos += 1;
      for (;;) {
        this.skip();
        if (this.text[this.pos] === "]") {
          this.pos += 1;
          break;
        }
        this.value();
      }
    } else if (char === "/") {
      this.name();
    } else {
      const token = this.regular();
      // « n g R » : une référence indirecte.
      if (/^\d+$/.test(token)) {
        const back = this.pos;
        this.skip();
        const generation = /^\d+/.exec(this.text.slice(this.pos))?.[0];
        if (generation) {
          this.pos += generation.length;
          this.skip();
          const after = this.text.charCodeAt(this.pos + 1);
          if (this.text[this.pos] === "R" && (Number.isNaN(after) || WHITESPACE.has(after) || DELIMITERS.has(after))) {
            this.pos += 1;
            return { kind: "ref", ref: { num: Number(token), gen: Number(generation) }, raw: this.text.slice(start, this.pos) };
          }
        }
        this.pos = back;
      }
    }
    return { kind: "other", raw: this.text.slice(start, this.pos) };
  }
}

function entry(dict: Value, key: string): Value | undefined {
  return dict.kind === "dict" ? dict.entries.find(([name]) => name === key)?.[1] : undefined;
}

type Parsed = {
  text: string;
  offsets: Map<number, number>;
  startxref: number;
  size: number;
  root: Ref;
  id: string | null;
};

// Table de références classique (« xref »), en suivant /Prev : la dernière révision l'emporte.
function readXref(text: string, at: number, offsets: Map<number, number>, seen: Set<number>): Value {
  if (seen.has(at)) throw new UnreadablePdfError("table de références en boucle");
  seen.add(at);
  if (!text.startsWith("xref", at)) throw new UnreadablePdfError("table de références compressée non prise en charge");
  const reader = new Reader(text, at + 4);
  for (;;) {
    reader.skip();
    if (text.startsWith("trailer", reader.pos)) break;
    const header = /^(\d+)\s+(\d+)/.exec(text.slice(reader.pos, reader.pos + 40));
    if (!header) throw new UnreadablePdfError("sous-section de références illisible");
    reader.pos += header[0].length;
    const first = Number(header[1]);
    const count = Number(header[2]);
    for (let index = 0; index < count; index += 1) {
      reader.skip();
      const line = /^(\d{10}) (\d{5}) ([nf])/.exec(text.slice(reader.pos, reader.pos + 20));
      if (!line) throw new UnreadablePdfError("entrée de références illisible");
      reader.pos += line[0].length;
      const number = first + index;
      if (line[3] === "n" && !offsets.has(number)) offsets.set(number, Number(line[1]));
    }
  }
  reader.pos += "trailer".length;
  const trailer = reader.value();
  const previous = entry(trailer, "/Prev");
  if (previous?.kind === "other" && /^\d+$/.test(previous.raw)) readXref(text, Number(previous.raw), offsets, seen);
  return trailer;
}

function parse(pdf: Uint8Array): Parsed {
  const text = Buffer.from(pdf).toString("latin1");
  if (!text.startsWith("%PDF-")) throw new UnreadablePdfError("en-tête absent");
  const marker = text.lastIndexOf("startxref");
  if (marker < 0) throw new UnreadablePdfError("startxref absent");
  const startxref = Number(/^startxref\s+(\d+)/.exec(text.slice(marker))?.[1] ?? Number.NaN);
  if (!Number.isInteger(startxref)) throw new UnreadablePdfError("startxref illisible");
  const offsets = new Map<number, number>();
  const trailer = readXref(text, startxref, offsets, new Set());
  const root = entry(trailer, "/Root");
  const size = entry(trailer, "/Size");
  if (root?.kind !== "ref") throw new UnreadablePdfError("catalogue absent");
  if (size?.kind !== "other" || !/^\d+$/.test(size.raw)) throw new UnreadablePdfError("taille absente");
  const id = entry(trailer, "/ID");
  const firstId = id ? /<([0-9A-Fa-f]*)>/.exec(id.raw)?.[1] ?? null : null;
  return { text, offsets, startxref, size: Number(size.raw), root: root.ref, id: firstId };
}

function objectAt(parsed: Parsed, ref: Ref): Value {
  const offset = parsed.offsets.get(ref.num);
  if (offset === undefined) throw new UnreadablePdfError(`objet ${ref.num} introuvable`);
  const header = new RegExp(`^${ref.num}\\s+${ref.gen}\\s+obj`).exec(parsed.text.slice(offset, offset + 40));
  if (!header) throw new UnreadablePdfError(`objet ${ref.num} illisible`);
  return new Reader(parsed.text, offset + header[0].length).value();
}

// --- Écriture ---

function pdfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}+00'00'`;
}

function xmpDate(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}

// Chaîne de texte PDF : ASCII imprimable entre parenthèses, sinon UTF-16BE avec sa marque d'ordre.
export function pdfTextString(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return `(${value.replace(/([\\()])/g, "\\$1")})`;
  const units: string[] = ["FEFF"];
  for (let index = 0; index < value.length; index += 1) units.push(value.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase());
  return `<${units.join("")}>`;
}

function xmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Marque d'ordre des octets du paquet XMP (U+FEFF, écrite en UTF-8).
const BOM = String.fromCharCode(0xfeff);
const FACTURX_NAMESPACE = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";

function xmp(input: FacturXAttachmentInput): string {
  const property = (name: string, description: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`;
  const date = xmpDate(input.issuedAt);
  return [
    `<?xpacket begin="${BOM}" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`,
    `<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>`,
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(input.title)}</rdf:li></rdf:Alt></dc:title></rdf:Description>`,
    `<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${FACTURX_PRODUCER}</pdf:Producer></rdf:Description>`,
    `<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreateDate>${date}</xmp:CreateDate><xmp:ModifyDate>${date}</xmp:ModifyDate></rdf:Description>`,
    `<rdf:Description rdf:about="" xmlns:fx="${FACTURX_NAMESPACE}"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>${input.conformanceLevel}</fx:ConformanceLevel></rdf:Description>`,
    `<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">`,
    `<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">`,
    `<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>${FACTURX_NAMESPACE}</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix>`,
    `<pdfaSchema:property><rdf:Seq>`,
    property("DocumentFileName", "name of the embedded XML invoice file"),
    property("DocumentType", "INVOICE"),
    property("Version", "The actual version of the Factur-X XML schema"),
    property("ConformanceLevel", "The conformance level of the embedded Factur-X data"),
    `</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>`,
    `</rdf:RDF>`,
    `</x:xmpmeta>`,
    `<?xpacket end="w"?>`,
  ].join("\n");
}

function md5Hex(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex").toUpperCase();
}

// Entrées du catalogue reprises telles quelles, sauf celles que la mise à jour remplace.
const REPLACED_CATALOG_KEYS = new Set(["/Metadata", "/OutputIntents", "/AF", "/Names"]);

export function attachFacturX(pdf: Uint8Array, input: FacturXAttachmentInput): Buffer {
  const parsed = parse(pdf);
  const catalog = objectAt(parsed, parsed.root);
  if (catalog.kind !== "dict") throw new UnreadablePdfError("catalogue illisible");
  // Dictionnaire des noms existant (destinations…), repris avec les fichiers joints en plus.
  const names = entry(catalog, "/Names");
  const namesDict = names?.kind === "ref" ? objectAt(parsed, names.ref) : names;
  const keptNames = namesDict?.kind === "dict" ? namesDict.entries.filter(([key]) => key !== "/EmbeddedFiles") : [];

  const xmlBytes = Buffer.from(input.xml, "utf8");
  const metadataBytes = Buffer.from(xmp(input), "utf8");
  const icc = srgbIccProfile();
  const date = pdfDate(input.issuedAt);

  let next = parsed.size;
  const number = () => next++;
  const ids = {
    metadata: number(),
    icc: number(),
    outputIntent: number(),
    file: number(),
    filespec: number(),
    embeddedFiles: number(),
    names: number(),
    info: number(),
  };
  const stream = (dictionary: string, body: Buffer) => [Buffer.from(`${dictionary}\nstream\n`, "latin1"), body, Buffer.from("\nendstream", "latin1")];
  const objects: [number, Buffer[]][] = [
    [ids.metadata, stream(`<< /Type /Metadata /Subtype /XML /Length ${metadataBytes.length} >>`, metadataBytes)],
    [ids.icc, stream(`<< /N 3 /Length ${icc.length} >>`, icc)],
    [
      ids.outputIntent,
      [Buffer.from(`<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (${SRGB_DESCRIPTION}) /RegistryName (http://www.color.org) /Info (${SRGB_DESCRIPTION}) /DestOutputProfile ${ids.icc} 0 R >>`, "latin1")],
    ],
    [
      ids.file,
      stream(`<< /Type /EmbeddedFile /Subtype /text#2Fxml /Params << /ModDate (${date}) /Size ${xmlBytes.length} /CheckSum <${md5Hex(xmlBytes)}> >> /Length ${xmlBytes.length} >>`, xmlBytes),
    ],
    [
      ids.filespec,
      [Buffer.from(`<< /Type /Filespec /F (${FACTURX_FILENAME}) /UF (${FACTURX_FILENAME}) /Desc (Factur-X) /AFRelationship /Alternative /EF << /F ${ids.file} 0 R /UF ${ids.file} 0 R >> >>`, "latin1")],
    ],
    [ids.embeddedFiles, [Buffer.from(`<< /Names [(${FACTURX_FILENAME}) ${ids.filespec} 0 R] >>`, "latin1")]],
    [ids.names, [Buffer.from(`<< ${keptNames.map(([key, value]) => `${key} ${value.raw}`).join(" ")} /EmbeddedFiles ${ids.embeddedFiles} 0 R >>`, "latin1")]],
    [ids.info, [Buffer.from(`<< /Title ${pdfTextString(input.title)} /Producer (${FACTURX_PRODUCER}) /CreationDate (${date}) /ModDate (${date}) >>`, "latin1")]],
    [
      parsed.root.num,
      [
        Buffer.from(
          `<< ${catalog.entries
            .filter(([key]) => !REPLACED_CATALOG_KEYS.has(key))
            .map(([key, value]) => `${key} ${value.raw}`)
            .join(" ")} /Metadata ${ids.metadata} 0 R /OutputIntents [${ids.outputIntent} 0 R] /AF [${ids.filespec} 0 R] /Names ${ids.names} 0 R >>`,
          "latin1",
        ),
      ],
    ],
  ];

  const original = Buffer.from(pdf);
  const parts: Buffer[] = [original];
  let length = original.length;
  const push = (buffer: Buffer) => {
    parts.push(buffer);
    length += buffer.length;
  };
  if (original[original.length - 1] !== 0x0a) push(Buffer.from("\n", "latin1"));
  const written = new Map<number, number>();
  for (const [id, chunks] of objects) {
    written.set(id, length);
    push(Buffer.from(`${id} ${id === parsed.root.num ? parsed.root.gen : 0} obj\n`, "latin1"));
    for (const chunk of chunks) push(chunk);
    push(Buffer.from("\nendobj\n", "latin1"));
  }
  // Table de cette révision : une sous-section par suite de numéros contigus.
  const numbers = [...written.keys()].sort((a, b) => a - b);
  const sections: number[][] = [];
  for (const id of numbers) {
    const last = sections[sections.length - 1];
    if (last && last[last.length - 1] === id - 1) last.push(id);
    else sections.push([id]);
  }
  const xrefOffset = length;
  const xref = ["xref"];
  for (const section of sections) {
    xref.push(`${section[0]} ${section.length}`);
    for (const id of section) xref.push(`${String(written.get(id)).padStart(10, "0")} ${String(id === parsed.root.num ? parsed.root.gen : 0).padStart(5, "0")} n `);
  }
  const fileId = md5Hex(Buffer.concat([original, xmlBytes]));
  xref.push("trailer");
  xref.push(`<< /Size ${next} /Root ${parsed.root.num} ${parsed.root.gen} R /Info ${ids.info} 0 R /Prev ${parsed.startxref} /ID [<${parsed.id ?? fileId}> <${fileId}>] >>`);
  xref.push("startxref", String(xrefOffset), "%%EOF", "");
  push(Buffer.from(xref.join("\n"), "latin1"));
  return Buffer.concat(parts);
}

// Le fichier structuré porté par un Factur-X émis par Symbola (flux joint non compressé), pour la
// relecture en test et au contrôle de l'original ; null s'il n'y en a pas.
export function extractFacturXml(pdf: Uint8Array): string | null {
  const text = Buffer.from(pdf).toString("latin1");
  const marker = text.lastIndexOf("/Type /EmbeddedFile /Subtype /text#2Fxml");
  if (marker < 0) return null;
  const length = /\/Length (\d+) >>\nstream\n/.exec(text.slice(marker));
  if (!length) return null;
  const start = marker + (length.index ?? 0) + length[0].length;
  return Buffer.from(pdf).subarray(start, start + Number(length[1])).toString("utf8");
}
