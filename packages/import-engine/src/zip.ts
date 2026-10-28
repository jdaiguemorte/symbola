// Lecture d'une archive zip (conteneur d'un .xlsx, ADR 0022), sans
// dépendance : répertoire central, entrées « stockées » ou « deflate »
// seulement. Refus du chiffrement et du zip64 (inutiles pour un classeur
// d'import). Chaque décompression est plafonnée (`maxOutputLength`) : une
// bombe zip est refusée avant d'occuper la mémoire.
import { inflateRawSync } from "node:zlib";
import { ReadError } from "./types";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ENTRIES = 10_000;

type Entry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && readUint32(bytes, 0) === LOCAL_SIGNATURE;
}

export class ZipArchive {
  private readonly entries = new Map<string, Entry>();
  private remainingBudget: number;

  constructor(
    private readonly bytes: Uint8Array,
    maxUncompressedBytes: number,
  ) {
    this.remainingBudget = maxUncompressedBytes;
    this.readCentralDirectory();
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  // Contenu décompressé d'une entrée, ou null si elle n'existe pas.
  read(name: string): Uint8Array | null {
    const entry = this.entries.get(name);
    if (!entry) return null;

    const offset = entry.localHeaderOffset;
    if (offset + 30 > this.bytes.length || readUint32(this.bytes, offset) !== LOCAL_SIGNATURE) {
      throw new ReadError("malformed");
    }
    const nameLength = readUint16(this.bytes, offset + 26);
    const extraLength = readUint16(this.bytes, offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > this.bytes.length) throw new ReadError("malformed");
    const data = this.bytes.subarray(start, end);

    let output: Uint8Array;
    if (entry.method === 0) {
      output = data;
    } else {
      try {
        output = inflateRawSync(data, { maxOutputLength: Math.max(1, this.remainingBudget) });
      } catch {
        // RangeError (plafond dépassé) ou flux deflate invalide.
        throw new ReadError("malformed");
      }
    }
    if (output.length > this.remainingBudget) throw new ReadError("malformed");
    this.remainingBudget -= output.length;
    return output;
  }

  readText(name: string): string | null {
    const data = this.read(name);
    if (!data) return null;
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      throw new ReadError("malformed");
    }
  }

  private readCentralDirectory(): void {
    const eocd = this.findEndOfCentralDirectory();
    const totalEntries = readUint16(this.bytes, eocd + 10);
    const directorySize = readUint32(this.bytes, eocd + 12);
    const directoryOffset = readUint32(this.bytes, eocd + 16);
    if (totalEntries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
      throw new ReadError("malformed");
    }
    if (totalEntries > MAX_ENTRIES || directoryOffset + directorySize > this.bytes.length) {
      throw new ReadError("malformed");
    }

    let offset = directoryOffset;
    for (let index = 0; index < totalEntries; index += 1) {
      if (offset + 46 > this.bytes.length || readUint32(this.bytes, offset) !== CENTRAL_SIGNATURE) {
        throw new ReadError("malformed");
      }
      const flags = readUint16(this.bytes, offset + 8);
      const method = readUint16(this.bytes, offset + 10);
      const compressedSize = readUint32(this.bytes, offset + 20);
      const nameLength = readUint16(this.bytes, offset + 28);
      const extraLength = readUint16(this.bytes, offset + 30);
      const commentLength = readUint16(this.bytes, offset + 32);
      const localHeaderOffset = readUint32(this.bytes, offset + 42);
      if (flags & 0x0001) throw new ReadError("unsupported_format", "encrypted");
      if (method !== 0 && method !== 8) throw new ReadError("malformed");
      if (compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) throw new ReadError("malformed");

      const nameBytes = this.bytes.subarray(offset + 46, offset + 46 + nameLength);
      const name = new TextDecoder("utf-8").decode(nameBytes);
      this.entries.set(name, { name, method, compressedSize, localHeaderOffset });
      offset += 46 + nameLength + extraLength + commentLength;
    }
  }

  private findEndOfCentralDirectory(): number {
    // Enregistrement de 22 octets, suivi d'un commentaire de 65 535 octets au plus.
    const lowest = Math.max(0, this.bytes.length - 22 - 0xffff);
    for (let offset = this.bytes.length - 22; offset >= lowest; offset -= 1) {
      if (readUint32(this.bytes, offset) === EOCD_SIGNATURE) return offset;
    }
    throw new ReadError("malformed");
  }
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (readUint16(bytes, offset) | (readUint16(bytes, offset + 2) << 16)) >>> 0;
}
