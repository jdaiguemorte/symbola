// RGPD-02 — archive de l'export : le ZIP produit se relit (même lecteur que
// l'import des classeurs), noms UTF-8 et contenus intacts ; le CSV est lisible
// par un tableur français et neutralise les formules.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ZipArchive } from "@symbola/import-engine";
import { createZip, toCsv, ZipFileWriter } from "./archive";

describe("RGPD-02 — Archive de l'export", () => {
  it("le ZIP se relit : chaque entrée garde son nom et son contenu", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 255, 10]);
    const zip = createZip(
      [
        { name: "donnees.json", data: JSON.stringify({ personne: "Élodie Durand" }) },
        { name: "csv/événements.csv", data: "a;b\r\n".repeat(500) },
        { name: "export.pdf", data: pdf },
      ],
      new Date(2026, 10, 2, 14, 30, 10),
    );
    const archive = new ZipArchive(zip, 10 * 1024 * 1024);
    expect(JSON.parse(archive.readText("donnees.json")!)).toEqual({ personne: "Élodie Durand" });
    expect(archive.readText("csv/événements.csv")).toBe("a;b\r\n".repeat(500));
    expect([...archive.read("export.pdf")!]).toEqual([...pdf]);
    // Compressé : 2 500 octets répétitifs tiennent dans bien moins.
    expect(zip.length).toBeLessThan(1000);
  });

  it("refuse un nom vide, absolu, remontant d'un dossier ou en double", () => {
    for (const name of ["", "/etc/passwd", "../x.csv", "a/../../x"]) expect(() => createZip([{ name, data: "x" }])).toThrow();
    expect(() => createZip([{ name: "a.csv", data: "x" }, { name: "a.csv", data: "y" }])).toThrow();
  });

  it("le CSV : séparateur point-virgule, guillemets, BOM UTF-8, formules neutralisées, téléphone international intact", () => {
    const csv = toCsv([
      ["champ", "valeur"],
      ["note", 'Dit "oui"; à rappeler\nlundi'],
      ["formule", "=HYPERLINK(\"http://x\")"],
      ["téléphone", "+33 6 12 34 56 78"],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "champ;valeur",
      'note;"Dit ""oui""; à rappeler\nlundi"',
      `formule;"'=HYPERLINK(""http://x"")"`,
      "téléphone;+33 6 12 34 56 78",
      "",
    ]);
  });
});

// Lot 35a (HUB-13) — l'export complet s'écrit en flux dans un fichier, entrée par entrée.
describe("HUB-13 — Archive de l'export complet, écrite en flux", () => {
  const dir = mkdtempSync(join(tmpdir(), "symbola-zip-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("l'archive se relit : noms dans l'ordre, contenus intacts, entrée compressée ou stockée telle quelle", async () => {
    const path = join(dir, "export.zip");
    const image = new Uint8Array(4096).map((_, index) => (index * 31) % 251);
    const writer = await ZipFileWriter.create(path, new Date(2026, 10, 15, 10, 0, 0));
    await writer.add("json/events/events.json", JSON.stringify([{ name: "Mariage de Léa et Hugo" }]));
    await writer.add("csv/events/events.csv", "name\r\n".repeat(1000));
    await writer.add("fichiers/events/event_documents/1-file.jpg", image, { compress: false });
    expect(writer.entryCount).toBe(3);
    const size = await writer.finish();
    const bytes = readFileSync(path);
    expect(bytes.length).toBe(size);
    const archive = new ZipArchive(bytes, 10 * 1024 * 1024);
    expect(archive.names()).toEqual(["json/events/events.json", "csv/events/events.csv", "fichiers/events/event_documents/1-file.jpg"]);
    expect(JSON.parse(archive.readText("json/events/events.json")!)).toEqual([{ name: "Mariage de Léa et Hugo" }]);
    expect(archive.readText("csv/events/events.csv")).toBe("name\r\n".repeat(1000));
    expect([...archive.read("fichiers/events/event_documents/1-file.jpg")!]).toEqual([...image]);
    // Le texte répétitif est compressé ; l'image est stockée telle quelle (4 096 octets au moins).
    expect(size).toBeGreaterThan(4096);
    expect(size).toBeLessThan(4096 + 1500);
  });

  it("refuse un nom vide, absolu, remontant d'un dossier ou en double, et toute entrée après la fermeture", async () => {
    const writer = await ZipFileWriter.create(join(dir, "noms.zip"));
    for (const name of ["", "/etc/passwd", "../x.csv", "a/../../x"]) await expect(writer.add(name, "x")).rejects.toThrow();
    await writer.add("a.csv", "x");
    await expect(writer.add("a.csv", "y")).rejects.toThrow();
    await writer.finish();
    await expect(writer.add("b.csv", "z")).rejects.toThrow();
  });

  it("ne remplace jamais un fichier existant", async () => {
    const path = join(dir, "unique.zip");
    await (await ZipFileWriter.create(path)).finish();
    await expect(ZipFileWriter.create(path)).rejects.toThrow();
  });
});
