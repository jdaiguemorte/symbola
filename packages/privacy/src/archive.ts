// RGPD-02 — archive de l'export (ADR 0023) : écriture d'un ZIP sans
// dépendance (node:zlib : deflate et CRC-32), et CSV réutilisable par un
// tableur. Volumes d'une personne (quelques centaines de fiches) : tout est
// construit en mémoire (createZip). Lot 35a (HUB-13, ADR 0068) : l'export complet
// d'une organisation s'écrit en flux dans un fichier (ZipFileWriter), entrée par
// entrée, compressée hors du fil principal : la mémoire ne tient qu'un fichier à
// la fois. Pas de zip64 : 4 Gio et 65 535 entrées au plus (ArchiveTooLargeError).
import { open, type FileHandle } from "node:fs/promises";
import { promisify } from "node:util";
import { crc32, deflateRaw, deflateRawSync } from "node:zlib";
import { neutralizeCell } from "@symbola/import-engine";

export type ArchiveEntry = { name: string; data: Uint8Array | string };

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
// Bit 11 : noms de fichiers en UTF-8.
const UTF8_FLAG = 0x0800;
const VERSION = 20;
const MAX_ARCHIVE_BYTES = 0xffffffff;
const MAX_ENTRIES = 0xffff;
const STORED = 0;
const DEFLATE = 8;

const deflateRawAsync = promisify(deflateRaw);

export class ArchiveTooLargeError extends Error {
  constructor() {
    super("archive trop volumineuse");
    this.name = "ArchiveTooLargeError";
  }
}

// Date et heure au format MS-DOS (heure locale du serveur, précision 2 s).
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function checkName(name: string, names: Set<string>): Buffer {
  if (name === "" || name.startsWith("/") || name.split("/").includes("..") || names.has(name)) {
    throw new Error(`nom d'entrée invalide : ${name}`);
  }
  names.add(name);
  return Buffer.from(name, "utf8");
}

type EncodedEntry = { name: Buffer; method: number; checksum: number; rawLength: number; data: Buffer };

// En-tête local (avant les données) et entrée du répertoire central d'une entrée.
function entryHeaders(entry: EncodedEntry, stamp: { time: number; date: number }, offset: number): { local: Buffer; central: Buffer } {
  const local = Buffer.alloc(30);
  local.writeUInt32LE(LOCAL_SIGNATURE, 0);
  local.writeUInt16LE(VERSION, 4);
  local.writeUInt16LE(UTF8_FLAG, 6);
  local.writeUInt16LE(entry.method, 8);
  local.writeUInt16LE(stamp.time, 10);
  local.writeUInt16LE(stamp.date, 12);
  local.writeUInt32LE(entry.checksum, 14);
  local.writeUInt32LE(entry.data.length, 18);
  local.writeUInt32LE(entry.rawLength, 22);
  local.writeUInt16LE(entry.name.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
  central.writeUInt16LE(VERSION, 4);
  central.writeUInt16LE(VERSION, 6);
  central.writeUInt16LE(UTF8_FLAG, 8);
  central.writeUInt16LE(entry.method, 10);
  central.writeUInt16LE(stamp.time, 12);
  central.writeUInt16LE(stamp.date, 14);
  central.writeUInt32LE(entry.checksum, 16);
  central.writeUInt32LE(entry.data.length, 20);
  central.writeUInt32LE(entry.rawLength, 24);
  central.writeUInt16LE(entry.name.length, 28);
  central.writeUInt32LE(offset, 42);
  return { local, central: Buffer.concat([central, entry.name]) };
}

function endOfCentralDirectory(entries: number, directoryLength: number, directoryOffset: number): Buffer {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD_SIGNATURE, 0);
  end.writeUInt16LE(entries, 8);
  end.writeUInt16LE(entries, 10);
  end.writeUInt32LE(directoryLength, 12);
  end.writeUInt32LE(directoryOffset, 16);
  return end;
}

function toBuffer(data: Uint8Array | string): Buffer {
  return typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function createZip(entries: ArchiveEntry[], modifiedAt: Date = new Date()): Buffer {
  const names = new Set<string>();
  const stamp = dosDateTime(modifiedAt);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = checkName(entry.name, names);
    const raw = toBuffer(entry.data);
    const encoded = { name, method: DEFLATE, checksum: crc32(raw), rawLength: raw.length, data: deflateRawSync(raw) };
    const { local, central } = entryHeaders(encoded, stamp, offset);
    locals.push(local, name, encoded.data);
    centrals.push(central);
    offset += local.length + name.length + encoded.data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = endOfCentralDirectory(entries.length, centralDirectory.length, offset);
  if (offset + centralDirectory.length + end.length > MAX_ARCHIVE_BYTES || entries.length > MAX_ENTRIES) throw new ArchiveTooLargeError();
  return Buffer.concat([...locals, centralDirectory, end]);
}

// Lot 35a (HUB-13) — archive écrite en flux dans un fichier : chaque entrée part sur le disque
// dès qu'elle est ajoutée ; seul le répertoire central reste en mémoire (quelques dizaines
// d'octets par entrée). Une entrée déjà compressée (image, PDF compressé…) peut être
// « stockée » telle quelle (compress: false).
export class ZipFileWriter {
  private readonly names = new Set<string>();
  private readonly centrals: Buffer[] = [];
  private offset = 0;
  private closed = false;

  private constructor(
    private readonly handle: FileHandle,
    private readonly stamp: { time: number; date: number },
  ) {}

  static async create(path: string, modifiedAt: Date = new Date()): Promise<ZipFileWriter> {
    return new ZipFileWriter(await open(path, "wx", 0o600), dosDateTime(modifiedAt));
  }

  get entryCount(): number {
    return this.centrals.length;
  }

  async add(entryName: string, data: Uint8Array | string, options: { compress?: boolean } = {}): Promise<void> {
    if (this.closed) throw new Error("archive déjà fermée");
    const name = checkName(entryName, this.names);
    const raw = toBuffer(data);
    const compress = options.compress ?? true;
    const encoded = {
      name,
      method: compress ? DEFLATE : STORED,
      checksum: crc32(raw),
      rawLength: raw.length,
      data: compress ? await deflateRawAsync(raw) : raw,
    };
    const { local, central } = entryHeaders(encoded, this.stamp, this.offset);
    const length = local.length + name.length + encoded.data.length;
    if (this.offset + length > MAX_ARCHIVE_BYTES || this.centrals.length + 1 > MAX_ENTRIES) throw new ArchiveTooLargeError();
    await this.write(local);
    await this.write(name);
    await this.write(encoded.data);
    this.centrals.push(central);
    this.offset += length;
  }

  // Écrit le répertoire central et ferme le fichier ; renvoie la taille de l'archive.
  async finish(): Promise<number> {
    if (this.closed) throw new Error("archive déjà fermée");
    const centralDirectory = Buffer.concat(this.centrals);
    const end = endOfCentralDirectory(this.centrals.length, centralDirectory.length, this.offset);
    if (this.offset + centralDirectory.length + end.length > MAX_ARCHIVE_BYTES) throw new ArchiveTooLargeError();
    await this.write(centralDirectory);
    await this.write(end);
    await this.close();
    return this.offset + centralDirectory.length + end.length;
  }

  // Abandon (échec en cours d'écriture) : le fichier est fermé ; l'appelant le supprime.
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.handle.close();
  }

  private async write(buffer: Buffer): Promise<void> {
    let written = 0;
    while (written < buffer.length) {
      const { bytesWritten } = await this.handle.write(buffer, written, buffer.length - written);
      written += bytesWritten;
    }
  }
}

// Une cellule qui commencerait par =, +, - ou @ serait interprétée comme une
// formule par le tableur qui ouvre l'export : neutralisée comme à l'import
// (CLAUDE.md §5), téléphones internationaux et montants négatifs intacts.
function quote(value: string): string {
  const safe = neutralizeCell(value).value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// CSV au format d'un tableur français : séparateur « ; », fins de ligne CRLF,
// marque d'ordre des octets pour qu'Excel reconnaisse l'UTF-8.
export function toCsv(rows: string[][]): string {
  return `﻿${rows.map((row) => row.map(quote).join(";")).join("\r\n")}\r\n`;
}
