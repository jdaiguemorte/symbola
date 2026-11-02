// RGPD-02 — archive de l'export (ADR 0023) : écriture d'un ZIP sans
// dépendance (node:zlib : deflate et CRC-32), et CSV réutilisable par un
// tableur. Volumes d'une personne (quelques centaines de fiches) : tout est
// construit en mémoire. Pas de zip64 (inutile à ces volumes).
import { crc32, deflateRawSync } from "node:zlib";
import { neutralizeCell } from "@symbola/import-engine";

export type ArchiveEntry = { name: string; data: Uint8Array | string };

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
// Bit 11 : noms de fichiers en UTF-8.
const UTF8_FLAG = 0x0800;
const VERSION = 20;
const MAX_ARCHIVE_BYTES = 0xffffffff;

// Date et heure au format MS-DOS (heure locale du serveur, précision 2 s).
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZip(entries: ArchiveEntry[], modifiedAt: Date = new Date()): Buffer {
  const names = new Set<string>();
  const { time, date } = dosDateTime(modifiedAt);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name === "" || entry.name.startsWith("/") || entry.name.split("/").includes("..") || names.has(entry.name)) {
      throw new Error(`nom d'entrée invalide : ${entry.name}`);
    }
    names.add(entry.name);
    const name = Buffer.from(entry.name, "utf8");
    const raw = typeof entry.data === "string" ? Buffer.from(entry.data, "utf8") : Buffer.from(entry.data);
    const compressed = deflateRawSync(raw);
    const checksum = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, compressed);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD_SIGNATURE, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  if (offset + centralDirectory.length + end.length > MAX_ARCHIVE_BYTES || entries.length > 0xffff) throw new Error("archive trop volumineuse");
  return Buffer.concat([...locals, centralDirectory, end]);
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
