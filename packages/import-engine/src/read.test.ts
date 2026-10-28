import { deflateRawSync } from "node:zlib";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { describe, expect, it } from "vitest";
import { readImportFile } from "./read";
import { buildXlsx, buildZip } from "./test-zip";
import type { ImportTable, ReadLimits, ReadResult } from "./types";

const LIMITS: ReadLimits = { maxBytes: 10 * 1024 * 1024, maxRows: 5000 };

function read(bytes: Uint8Array | string, limits: Partial<ReadLimits> = {}): ReadResult {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return readImportFile(data, { ...LIMITS, ...limits });
}

function table(bytes: Uint8Array | string, limits: Partial<ReadLimits> = {}): ImportTable {
  const result = read(bytes, limits);
  if (!result.ok) throw new Error(`lecture refusée : ${result.reason}`);
  return result.table;
}

describe("IMP-01 — Formats acceptés", () => {
  describe("Quand elle dépose un fichier CSV, Excel ou JSON, alors l'app détecte l'encodage, le séparateur et la ligne d'en-tête", () => {
    it.each([
      {
        file: "excel-fr-windows1252.csv",
        expected: { format: "csv", encoding: "windows-1252", delimiter: ";", headerRowIndex: 0, rowCount: 3 },
        header: "Prénom mariée",
        cell: [1, 5, "Domaine des Œillets"],
      },
      {
        file: "google-sheets-en.csv",
        expected: { format: "csv", encoding: "utf-8", delimiter: ",", headerRowIndex: 0, rowCount: 2 },
        header: "Bride first name",
        cell: [0, 4, 'Wants "rustic" theme\nCall back in May'],
      },
      {
        file: "excel-unicode-text.txt",
        expected: { format: "csv", encoding: "utf-16le", delimiter: "\t", headerRowIndex: 0, rowCount: 2 },
        header: "Intitulé",
        cell: [0, 2, "1 500,00"],
      },
      {
        file: "maison-titre-bom.csv",
        expected: { format: "csv", encoding: "utf-8", delimiter: ";", headerRowIndex: 2, rowCount: 2 },
        header: "Tâche",
        cell: [1, 1, "01.03.2027"],
      },
      {
        file: "desordre-lignes-inegales.csv",
        expected: { format: "csv", encoding: "utf-8", delimiter: ";", headerRowIndex: 0, rowCount: 3 },
        header: "Ville",
        cell: [2, 6, "colonne en trop"],
      },
      {
        file: "export.json",
        expected: { format: "json", headerRowIndex: 0, rowCount: 2 },
        header: "date",
        cell: [0, 3, "Élodie"],
      },
      {
        file: "excel-maison.xlsx",
        expected: { format: "xlsx", headerRowIndex: 2, rowCount: 2 },
        header: "Prénom mariée",
        cell: [0, 2, "2027-06-12"],
      },
      {
        file: "libreoffice.xlsx",
        expected: { format: "xlsx", headerRowIndex: 0, rowCount: 2 },
        header: "Poste",
        cell: [0, 3, "8720.4"],
      },
      {
        file: "mac-1904.xlsx",
        expected: { format: "xlsx", headerRowIndex: 0, rowCount: 1 },
        header: "Clients",
        cell: [0, 1, "2027-02-14"],
      },
    ] as const)("$file", ({ file, expected, header, cell }) => {
      const result = table(readImportCorpusFile(file));
      const { rowCount, ...format } = expected;
      expect(result).toMatchObject(format);
      expect(result.rows).toHaveLength(rowCount);
      expect(result.headers[0]).toBe(header);
      const [row, column, value] = cell;
      expect(result.rows[row]?.[column]).toBe(value);
      for (const line of result.rows) expect(line).toHaveLength(result.headers.length);
    });

    it("la feuille visible du classeur est lue, pas une feuille masquée qui la précède", () => {
      const result = table(readImportCorpusFile("excel-maison.xlsx"));
      expect(result.headers).toEqual(["Prénom mariée", "Prénom marié", "Date", "Budget", "Acompte versé"]);
      // Dernière valeur calculée de la formule =D4*0.3, sans recalcul.
      expect(result.rows[1]?.[4]).toBe("5550.15");
    });

    it("les heures d'un classeur sont lues au format HH:MM", () => {
      expect(table(readImportCorpusFile("mac-1904.xlsx")).rows[0]?.[2]).toBe("15:30");
    });

    it("le type est reconnu par le contenu, pas par l'extension", () => {
      // Le même contenu CSV lu sans nom de fichier ; un .xlsx renommé en .csv
      // resterait un classeur : la lecture ne reçoit jamais le nom.
      expect(table("a;b\n1;2\n").format).toBe("csv");
      expect(table(readImportCorpusFile("libreoffice.xlsx")).format).toBe("xlsx");
    });

    it("un fichier sans ligne d'en-tête reconnaissable garde ses colonnes, sans intitulé", () => {
      const result = table("12/06/2027;25000\n03/09/2027;18500\n");
      expect(result.headerRowIndex).toBe(-1);
      expect(result.headers).toEqual(["", ""]);
      expect(result.rows).toHaveLength(2);
    });

    it("les numéros de ligne d'origine sont conservés pour le rapport des écarts", () => {
      expect(table(readImportCorpusFile("desordre-lignes-inegales.csv")).sourceLineNumbers).toEqual([2, 3, 5]);
      // Retour à la ligne dans une cellule : la ligne suivante commence ligne 4.
      expect(table(readImportCorpusFile("google-sheets-en.csv")).sourceLineNumbers).toEqual([2, 4]);
    });
  });

  describe("Étant donné un fichier d'un autre format ou trop gros, alors il est refusé avec un motif clair", () => {
    it("ancien Excel (.xls) refusé avec une indication", () => {
      expect(read(readImportCorpusFile("libreoffice.xls"))).toEqual({ ok: false, reason: "unsupported_format", hint: "xls" });
    });

    it("tableur OpenDocument (.ods) refusé avec une indication", () => {
      expect(read(readImportCorpusFile("libreoffice.ods"))).toEqual({ ok: false, reason: "unsupported_format", hint: "ods" });
    });

    it.each([
      ["PDF", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])],
      ["PNG", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      ["binaire quelconque", new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x01, 0x02])],
    ])("%s refusé", (_, bytes) => {
      expect(read(bytes)).toEqual({ ok: false, reason: "unsupported_format", hint: "binary" });
    });

    it("une archive zip qui n'est pas un classeur est refusée", () => {
      expect(read(buildZip([{ name: "photo.txt", data: "bonjour" }]))).toEqual({ ok: false, reason: "unsupported_format" });
    });

    it("un classeur avec macros (.xlsm) est refusé avec une indication", () => {
      const xlsm = buildXlsx({
        sheetData: "",
        contentTypes: '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>',
      });
      expect(read(xlsm)).toEqual({ ok: false, reason: "unsupported_format", hint: "xlsm" });
    });

    it("une archive chiffrée est refusée avec une indication", () => {
      const encrypted = buildZip([{ name: "[Content_Types].xml", data: "x", flags: 0x0001 }]);
      expect(read(encrypted)).toEqual({ ok: false, reason: "unsupported_format", hint: "encrypted" });
    });

    it("un fichier plus gros que la limite est refusé avant toute lecture", () => {
      expect(read("a;b\n1;2\n", { maxBytes: 4 })).toEqual({ ok: false, reason: "too_large" });
    });

    it("un fichier qui dépasse le nombre de lignes autorisé est refusé", () => {
      const csv = `nom;date\n${Array.from({ length: 11 }, (_, i) => `n${i};2027-01-01`).join("\n")}`;
      expect(read(csv, { maxRows: 10 })).toEqual({ ok: false, reason: "too_many_rows" });
      expect(table(csv, { maxRows: 11 }).rows).toHaveLength(11);
    });

    it("un fichier qui dépasse le nombre de colonnes autorisé est refusé", () => {
      const header = Array.from({ length: 6 }, (_, i) => `c${i}`).join(";");
      expect(read(`${header}\n1;2;3;4;5;6\n`, { maxColumns: 5 })).toEqual({ ok: false, reason: "too_many_columns" });
    });
  });

  describe("Le contenu des cellules qui commencent par = + - ou @ est neutralisé", () => {
    it("formules neutralisées dès la lecture, nombres signés intacts", () => {
      const result = table(readImportCorpusFile("formules.csv"));
      expect(result.rows[0]).toEqual(['\'=HYPERLINK("http://example.invalid","clic")', "-12,50", "+33 6 12 34 56 78", "'@SUM(A1:A2)"]);
      expect(result.rows[1]).toEqual(["Fleurs", "+150", "0612345678", "'-2+3"]);
      expect(result.rows[2]).toEqual(["'=1+1", "1 234,56 €", "", "'=cmd"]);
      expect(result.neutralizedCells).toBe(5);
    });

    it("une formule dans une chaîne d'un classeur est neutralisée aussi", () => {
      const xlsx = buildXlsx({
        sharedStrings: ["Intitulé", "=cmd|' /C calc'!A0"],
        sheetData: '<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row>',
      });
      expect(table(xlsx).rows[0]?.[0]).toBe("'=cmd|' /C calc'!A0");
    });
  });

  describe("Cas limites", () => {
    it("fichier vide, blanc ou en-tête seul : refusé comme vide", () => {
      expect(read(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
      expect(read("  \n\n ")).toEqual({ ok: false, reason: "empty" });
      expect(read("nom;date\n")).toEqual({ ok: false, reason: "empty" });
      expect(read("[]")).toEqual({ ok: false, reason: "empty" });
    });

    it("lignes vides et lignes de séparateurs seuls ignorées", () => {
      expect(table("nom;date\n\n;;\nA;2027-01-01\n\r\n").rows).toEqual([["A", "2027-01-01"]]);
    });

    it("guillemets, séparateurs et retours à la ligne dans une cellule", () => {
      const result = table('nom,note\n"Dupont, Jean","ligne 1\r\nligne 2 ""citée"""\n');
      expect(result.rows[0]).toEqual(["Dupont, Jean", 'ligne 1\r\nligne 2 "citée"']);
    });

    it("fins de ligne CR seules (ancien Mac)", () => {
      expect(table("nom;ville\rA;Lyon\rB;Lille").rows).toEqual([
        ["A", "Lyon"],
        ["B", "Lille"],
      ]);
    });

    it("les virgules décimales ne trompent pas la détection du point-virgule", () => {
      const result = table("Intitulé;Prix\nFleurs;1 234,56\nDJ;800,00\nSalle;3 000\n");
      expect(result.delimiter).toBe(";");
      expect(result.rows[0]).toEqual(["Fleurs", "1 234,56"]);
    });

    it("UTF-8 invalide après un BOM : fichier corrompu", () => {
      expect(read(new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0xff, 0x62]))).toEqual({ ok: false, reason: "malformed" });
    });

    it("cellule démesurée refusée", () => {
      expect(read(`nom\n${"x".repeat(50)}\n`, { maxCellLength: 10 })).toEqual({ ok: false, reason: "malformed" });
    });

    it("classeur : chaînes partagées, texte en ligne, booléens, erreurs, dates et cellules fusionnées", () => {
      const xlsx = buildXlsx({
        sharedStrings: ["Nom", "Date", "Confirmé", "Fusion", "Dupont &amp; Fils"],
        sheetData:
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" s="1"><v>46550</v></c><c r="C2" t="b"><v>1</v></c><c r="D2" t="e"><v>#REF!</v></c></row>' +
          // Cellule fusionnée D3:E3 : seule D3 porte une valeur.
          '<row r="3"><c r="A3" t="inlineStr"><is><t>Martin</t></is></c><c r="B3" s="1"><v>59</v></c><c r="D3" t="str"><v>calculé</v></c><c r="E3"/></row>',
      });
      const result = table(xlsx);
      expect(result.rows).toEqual([
        ["Dupont & Fils", "2027-06-12", "TRUE", ""],
        ["Martin", "1900-02-28", "", "calculé"],
      ]);
    });

    it("classeur : nombres sans artefact binaire, notation scientifique développée", () => {
      const xlsx = buildXlsx({
        sharedStrings: ["Montant"],
        sheetData:
          '<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2"><v>1234.5599999999999</v></c></row>' +
          '<row r="3"><c r="A3"><v>1.5E3</v></c></row>',
      });
      expect(table(xlsx).rows).toEqual([["1234.56"], ["1500"]]);
    });

    it("classeur : une bombe zip est refusée sans être décompressée en entier", () => {
      // 50 Mo de « A » compressés en quelques dizaines de Ko.
      const bombSheet = deflateRawSync(Buffer.alloc(50 * 1024 * 1024, 0x41));
      const xlsx = buildXlsx({ sheetData: "", sheetEntry: { data: bombSheet, predeflated: true } });
      expect(xlsx.length).toBeLessThan(200 * 1024);
      expect(read(xlsx, { maxUncompressedBytes: 5 * 1024 * 1024 })).toEqual({ ok: false, reason: "malformed" });
    });

    it("classeur : une DTD (entités XML) est refusée", () => {
      const xlsx = buildXlsx({
        sheetData: '<row r="1"><c r="A1" t="s"><v>0</v></c></row>',
        sharedStringsXml: '<!DOCTYPE sst [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><sst><si><t>&xxe;</t></si></sst>',
      });
      expect(read(xlsx)).toEqual({ ok: false, reason: "malformed" });
    });

    it("classeur tronqué : refusé comme malformé", () => {
      const xlsx = readImportCorpusFile("libreoffice.xlsx");
      expect(read(xlsx.subarray(0, xlsx.length - 40))).toEqual({ ok: false, reason: "malformed" });
    });

    it("JSON trop profond ou invalide : refusé comme malformé", () => {
      expect(read(`${"[".repeat(30)}${"]".repeat(30)}`)).toEqual({ ok: false, reason: "malformed" });
      expect(read('[{"a": 1},')).toEqual({ ok: false, reason: "malformed" });
    });

    it("JSON qui n'est pas une liste d'objets : refusé", () => {
      expect(read("[1, 2, 3]")).toEqual({ ok: false, reason: "unsupported_format" });
      expect(read('{"total": 3}')).toEqual({ ok: false, reason: "unsupported_format" });
    });

    it("JSON : une clé __proto__ reste une colonne ordinaire", () => {
      const result = table('[{"__proto__": {"x": "1"}, "nom": "A"}]');
      expect(result.headers).toEqual(["__proto__.x", "nom"]);
      expect(({} as Record<string, unknown>).x).toBeUndefined();
    });
  });
});
