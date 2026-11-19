// Lot 35b (HUB-13, ADR 0097) — lecture en flux d'une archive ZIP sur le disque (l'export complet
// d'une organisation, à reprendre), sans dépendance : le répertoire central est lu une fois, puis
// chaque entrée à la demande, une à la fois (la mémoire ne tient qu'une entrée). Chaque entrée est
// contrôlée : nom sans chemin remontant, taille annoncée respectée (pas de bombe de décompression),
// CRC-32 juste. Comme l'écrivain : pas de zip64 (4 Gio et 65 535 entrées au plus).
import { open, type FileHandle } from "node:fs/promises";
import { promisify } from "node:util";
import { crc32, inflateRaw } from "node:zlib";

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_MIN = 22;
const EOCD_MAX_COMMENT = 0xffff;
const STORED = 0;
const DEFLATE = 8;
const ENCRYPTED_FLAG = 0x0001;

const inflateRawAsync = promisify(inflateRaw);

// Archive illisible : tronquée, mal formée, chiffrée, entrée corrompue ou plus grosse qu'annoncé.
export class ArchiveReadError extends Error {
  constructor(readonly detail: string) {
    super(`archive illisible : ${detail}`);
    this.name = "ArchiveReadError";
  }
}

type ReaderEntry = { method: number; checksum: number; compressedSize: number; size: number; localHeaderOffset: number };

function safeName(name: string): boolean {
  return name !== "" && !name.startsWith("/") && !name.includes("\\") && !name.split("/").includes("..") && !name.includes("\0");
}

export class ZipFileReader {
  private constructor(
    private readonly handle: FileHandle,
    private readonly fileSize: number,
    private readonly entries: Map<string, ReaderEntry>,
  ) {}

  static async open(path: string): Promise<ZipFileReader> {
    const handle = await open(path, "r");
    try {
      const { size } = await handle.stat();
      const entries = await readCentralDirectory(handle, size);
      return new ZipFileReader(handle, size, entries);
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  // Taille décompressée annoncée d'une entrée.
  size(name: string): number | null {
    return this.entries.get(name)?.size ?? null;
  }

  // Contenu d'une entrée, ou null si elle n'existe pas.
  async read(name: string): Promise<Buffer | null> {
    const entry = this.entries.get(name);
    if (!entry) return null;
    const header = Buffer.alloc(30);
    await this.readAt(header, entry.localHeaderOffset);
    if (header.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new ArchiveReadError("en-tête local");
    const start = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    if (start + entry.compressedSize > this.fileSize) throw new ArchiveReadError("entrée tronquée");
    const raw = Buffer.alloc(entry.compressedSize);
    await this.readAt(raw, start);
    let data: Buffer;
    if (entry.method === STORED) {
      data = raw;
    } else {
      try {
        data = await inflateRawAsync(raw, { maxOutputLength: Math.max(1, entry.size) });
      } catch {
        throw new ArchiveReadError("entrée corrompue");
      }
    }
    if (data.length !== entry.size || crc32(data) !== entry.checksum) throw new ArchiveReadError("empreinte CRC");
    return data;
  }

  async readText(name: string): Promise<string | null> {
    const data = await this.read(name);
    if (!data) return null;
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      throw new ArchiveReadError("texte non UTF-8");
    }
  }

  async close(): Promise<void> {
    await this.handle.close();
  }

  private async readAt(buffer: Buffer, position: number): Promise<void> {
    const { bytesRead } = await this.handle.read(buffer, 0, buffer.length, position);
    if (bytesRead !== buffer.length) throw new ArchiveReadError("lecture tronquée");
  }
}

async function readCentralDirectory(handle: FileHandle, fileSize: number): Promise<Map<string, ReaderEntry>> {
  if (fileSize < EOCD_MIN) throw new ArchiveReadError("trop courte");
  const tailLength = Math.min(fileSize, EOCD_MIN + EOCD_MAX_COMMENT);
  const tail = Buffer.alloc(tailLength);
  await handle.read(tail, 0, tailLength, fileSize - tailLength);
  let eocd = -1;
  for (let offset = tailLength - EOCD_MIN; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveReadError("fin de répertoire");
  const total = tail.readUInt16LE(eocd + 10);
  const directorySize = tail.readUInt32LE(eocd + 12);
  const directoryOffset = tail.readUInt32LE(eocd + 16);
  if (total === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff || directoryOffset + directorySize > fileSize) {
    throw new ArchiveReadError("répertoire central");
  }
  const directory = Buffer.alloc(directorySize);
  await handle.read(directory, 0, directorySize, directoryOffset);
  const entries = new Map<string, ReaderEntry>();
  let offset = 0;
  for (let index = 0; index < total; index += 1) {
    if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new ArchiveReadError("entrée du répertoire");
    const flags = directory.readUInt16LE(offset + 8);
    const method = directory.readUInt16LE(offset + 10);
    const checksum = directory.readUInt32LE(offset + 16);
    const compressedSize = directory.readUInt32LE(offset + 20);
    const size = directory.readUInt32LE(offset + 24);
    const nameLength = directory.readUInt16LE(offset + 28);
    const extraLength = directory.readUInt16LE(offset + 30);
    const commentLength = directory.readUInt16LE(offset + 32);
    const localHeaderOffset = directory.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength > directory.length) throw new ArchiveReadError("nom d'entrée");
    const name = directory.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;
    if (flags & ENCRYPTED_FLAG) throw new ArchiveReadError("entrée chiffrée");
    if (method !== STORED && method !== DEFLATE) throw new ArchiveReadError("méthode de compression");
    if (name.endsWith("/")) continue;
    if (!safeName(name) || entries.has(name)) throw new ArchiveReadError("nom d'entrée");
    entries.set(name, { method, checksum, compressedSize, size, localHeaderOffset });
  }
  return entries;
}
