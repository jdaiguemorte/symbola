// RGPD-02 — archive de l'export : le ZIP produit se relit (même lecteur que
// l'import des classeurs), noms UTF-8 et contenus intacts ; le CSV est lisible
// par un tableur français et neutralise les formules.
import { describe, expect, it } from "vitest";
import { ZipArchive } from "@symbola/import-engine";
import { createZip, toCsv } from "./archive";

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
