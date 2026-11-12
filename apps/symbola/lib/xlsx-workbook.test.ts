import { describe, expect, it } from "vitest";
import { readImportFile, ZipArchive } from "@symbola/import-engine";
import { centsToDecimal, columnLetter, createXlsx, dateSerial } from "./xlsx-workbook";

const LIMITS = { maxBytes: 5_000_000, maxRows: 1000 };

function workbook(headerColor = "#334155") {
  return createXlsx({
    title: "Budget",
    author: "Organisation",
    headerColor,
    createdAt: new Date("2026-11-12T10:00:00Z"),
    sheets: [
      {
        name: "Budget",
        columns: [
          { header: "Ligne", width: 30 },
          { header: "Engagé", width: 14 },
          { header: "TVA", width: 8 },
        ],
        rows: [
          [{ kind: "text", value: "Traiteur & vin <dîner>", bold: true }, { kind: "money", cents: 960000, bold: true }, null],
          [{ kind: "text", value: "=SOMME(A1)" }, { kind: "money", cents: -5 }, { kind: "percent", basisPoints: 550 }],
        ],
      },
      {
        name: "Échéances",
        columns: [{ header: "Date", width: 12 }],
        rows: [[{ kind: "date", value: "2027-06-12" }]],
      },
    ],
  });
}

describe("BUD-10 — Classeur XLSX écrit par l'app (D6)", () => {
  it("se relit comme un classeur : en-têtes, textes et montants en euros", () => {
    const result = readImportFile(new Uint8Array(workbook()), LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.table.headers).toEqual(["Ligne", "Engagé", "TVA"]);
    expect(result.table.rows[0]!.slice(0, 2)).toEqual(["Traiteur & vin <dîner>", "9600"]);
    expect(result.table.rows[1]![1]).toBe("-0.05");
  });

  it("une cellule qui ressemble à une formule reste du texte (jamais de formule)", () => {
    const zip = new ZipArchive(new Uint8Array(workbook()), 5_000_000);
    const sheet = zip.readText("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain("=SOMME(A1)");
    expect(sheet).not.toContain("<f>");
  });

  it("a deux feuilles nommées, des montants au format monétaire et les en-têtes à la couleur de l'organisation", () => {
    const zip = new ZipArchive(new Uint8Array(workbook("#7A1F4B")), 5_000_000);
    expect(zip.readText("xl/workbook.xml")).toContain('<sheet name="Budget"');
    expect(zip.readText("xl/workbook.xml")).toContain('<sheet name="Échéances"');
    const styles = zip.readText("xl/styles.xml")!;
    expect(styles).toContain('<fgColor rgb="FF7A1F4B"/>');
    expect(styles).toContain("&quot;€&quot;");
    // Couleur sombre : texte blanc ; couleur claire : texte sombre.
    expect(styles).toContain('<color rgb="FFFFFFFF"/>');
    const light = new ZipArchive(new Uint8Array(workbook("#F5E6C8")), 5_000_000).readText("xl/styles.xml")!;
    expect(light).toContain('<color rgb="FF111111"/>');
  });

  it("refuse une couleur d'en-tête qui n'est pas #RRGGBB", () => {
    expect(() => workbook("red")).toThrow();
  });
});

describe("BUD-10 — Valeurs écrites sans nombre à virgule", () => {
  it("convertit les centimes en euros exacts", () => {
    expect(centsToDecimal(123456)).toBe("1234.56");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(-120000)).toBe("-1200.00");
  });

  it("numérote les colonnes comme le tableur", () => {
    expect([0, 25, 26, 27, 701].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "ZZ"]);
  });

  it("écrit une date en numéro de série (12/06/2027 = 46550)", () => {
    expect(dateSerial("2027-06-12")).toBe(46550);
    expect(dateSerial("1900-03-01")).toBe(61);
  });
});
