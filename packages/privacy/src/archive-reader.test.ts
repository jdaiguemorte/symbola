// Lot 35b (HUB-13, ADR 0098) — lecture en flux d'une archive d'export complet : elle relit ce que
// l'écrivain a produit, et refuse une archive tronquée, une entrée altérée (CRC), un nom qui remonte
// d'un dossier, ou une entrée plus grosse qu'annoncé.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createZip, ZipFileWriter } from "./archive";
import { ArchiveReadError, ZipFileReader } from "./archive-reader";

describe("HUB-13 — Archive de l'export complet, relue en flux pour la reprise", () => {
  const dir = mkdtempSync(join(tmpdir(), "symbola-zip-reader-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("relit l'archive de l'écrivain : noms, contenus compressés ou stockés, texte UTF-8", async () => {
    const path = join(dir, "export.zip");
    const image = new Uint8Array(4096).map((_, index) => (index * 31) % 251);
    const writer = await ZipFileWriter.create(path);
    await writer.add("json/events/events.json", JSON.stringify([{ name: "Mariage de Léa et Hugo" }]));
    await writer.add("fichiers/events/event_documents/1-file.jpg", image, { compress: false });
    await writer.add("csv/events/events.csv", "nom\r\n".repeat(2000));
    await writer.finish();
    const reader = await ZipFileReader.open(path);
    try {
      expect(reader.names()).toEqual(["json/events/events.json", "fichiers/events/event_documents/1-file.jpg", "csv/events/events.csv"]);
      expect(JSON.parse((await reader.readText("json/events/events.json"))!)).toEqual([{ name: "Mariage de Léa et Hugo" }]);
      expect([...(await reader.read("fichiers/events/event_documents/1-file.jpg"))!]).toEqual([...image]);
      expect(await reader.readText("csv/events/events.csv")).toBe("nom\r\n".repeat(2000));
      expect(reader.size("csv/events/events.csv")).toBe(10_000);
      expect(await reader.read("absent.json")).toBeNull();
    } finally {
      await reader.close();
    }
  });

  it("refuse une archive qui n'en est pas une, ou tronquée", async () => {
    const notZip = join(dir, "pas-un-zip.zip");
    writeFileSync(notZip, "bonjour, ceci n'est pas une archive");
    await expect(ZipFileReader.open(notZip)).rejects.toBeInstanceOf(ArchiveReadError);
    const whole = createZip([{ name: "a.json", data: "[]" }]);
    const truncated = join(dir, "tronquee.zip");
    writeFileSync(truncated, whole.subarray(0, whole.length - 10));
    await expect(ZipFileReader.open(truncated)).rejects.toBeInstanceOf(ArchiveReadError);
  });

  it("refuse une entrée altérée (CRC-32 faux)", async () => {
    const path = join(dir, "alteree.zip");
    const bytes = Buffer.from(createZip([{ name: "a.txt", data: "aaaaaaaaaaaa" }]));
    // Empreinte CRC-32 du répertoire central changée : le contenu ne lui correspond plus.
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt32LE((bytes.readUInt32LE(central + 16) ^ 0xffffffff) >>> 0, central + 16);
    writeFileSync(path, bytes);
    const reader = await ZipFileReader.open(path);
    try {
      await expect(reader.read("a.txt")).rejects.toBeInstanceOf(ArchiveReadError);
    } finally {
      await reader.close();
    }
  });

  it("refuse un nom qui remonte d'un dossier, et une entrée plus grosse qu'annoncé", async () => {
    const path = join(dir, "noms.zip");
    const bytes = Buffer.from(createZip([{ name: "ab/c.txt", data: "x".repeat(1000) }]));
    // « ab/c.txt » devient « ../c.txt » dans le répertoire central.
    const central = bytes.lastIndexOf(Buffer.from("ab/c.txt"));
    bytes.write("../", central, "utf8");
    writeFileSync(path, bytes);
    await expect(ZipFileReader.open(path)).rejects.toBeInstanceOf(ArchiveReadError);

    const bomb = Buffer.from(createZip([{ name: "b.txt", data: "y".repeat(5000) }]));
    // Taille décompressée annoncée ramenée à 10 octets (répertoire central).
    const centralSignature = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bomb.writeUInt32LE(10, centralSignature + 24);
    const bombPath = join(dir, "bombe.zip");
    writeFileSync(bombPath, bomb);
    const reader = await ZipFileReader.open(bombPath);
    try {
      await expect(reader.read("b.txt")).rejects.toBeInstanceOf(ArchiveReadError);
    } finally {
      await reader.close();
    }
    expect(readFileSync(bombPath).length).toBe(bomb.length);
  });
});
