import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { looksLikePdf, readPdfText } from "./pdf";

const encoder = new TextEncoder();

describe("IMP-08 — Lecture des fiches PDF (ADR 0034)", () => {
  it("un PDF est reconnu par son contenu (signature %PDF-), pas par son nom", () => {
    expect(looksLikePdf(readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf"))).toBe(true);
    expect(looksLikePdf(readImportCorpusFile("logiciel-tiers/prestataires.xlsx"))).toBe(false);
  });

  it("le texte est lu avec sa position, mesurée depuis le haut de la page", async () => {
    const result = await readPdfText(readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf"));
    if (!result.ok) throw new Error(result.reason);
    expect(result.pages).toHaveLength(1);
    const page = result.pages[0]!;
    expect(Math.round(page.width)).toBe(595);
    const title = page.items.find((item) => item.text.includes("&"));
    const footer = page.items.find((item) => item.text.startsWith("SAS Atelier Exemple"));
    expect(title!.y).toBeLessThan(150);
    expect(footer!.y).toBeGreaterThan(700);
  });

  it("un fichier qui n'est pas un PDF, trop gros ou qui a trop de pages est refusé avec un motif, sans être lu", async () => {
    expect(await readPdfText(encoder.encode("Nom;Ville\nA;B"))).toEqual({ ok: false, reason: "not_pdf" });
    const pdf = readImportCorpusFile("logiciel-tiers/fiche-evenement-complete.pdf");
    expect(await readPdfText(pdf, { maxBytes: 100, maxPages: 3, timeoutMs: 10_000 })).toEqual({ ok: false, reason: "too_large" });
    expect(await readPdfText(pdf, { maxBytes: 1_000_000, maxPages: 0, timeoutMs: 10_000 })).toEqual({ ok: false, reason: "too_many_pages" });
  });

  it("un PDF abîmé est refusé comme illisible, sans faire échouer l'appelant", async () => {
    const broken = encoder.encode("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer <<>>\n%%EOF");
    const result = await readPdfText(broken);
    expect(result.ok).toBe(false);
  });
});
