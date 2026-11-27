// Lot 71a (SEC-21, HUB-14 ; spécification du lot 71, § 6, critère 10 du paquet 71a) — test d'abus :
// un texte lu dans le PDF d'un programme ou des prestataires retenus qui commence par =, +, - ou @
// ressort neutralisé, comme une cellule de tableur, avant d'être gardé (base, écran, exports).
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { DEFAULT_PDF_LIMITS, readPdfText, type PdfPage } from "../pdf";
import { parseEventVendorsExport } from "./event-vendors-export";
import { parseProgramExport } from "./program-export";

const profile = planningSoftwareProfile();
const calendar = { weekdays: profile.eventSheet.weekdays, months: profile.eventSheet.months };
const FORMULA = '=HYPERLINK("http://exemple.test/?x","Brunch")';

async function pagesOf(name: string): Promise<PdfPage[]> {
  const read = await readPdfText(readImportCorpusFile(`logiciel-tiers/${name}`), { ...DEFAULT_PDF_LIMITS, maxPages: 30 });
  if (!read.ok) throw new Error(read.reason);
  return read.pages;
}

// Le texte d'un élément du PDF remplacé, comme si le fichier le portait.
function inject(pages: PdfPage[], from: string, to: string): PdfPage[] {
  let found = false;
  const changed = pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (item.text.trim() !== from) return item;
      found = true;
      return { ...item, text: to };
    }),
  }));
  if (!found) throw new Error(`texte introuvable : ${from}`);
  return changed;
}

describe("SEC-21 — Textes des PDF repris neutralisés (lot 71a)", () => {
  it("une cellule « =HYPERLINK(…) » lue dans un PDF de programme est neutralisée", async () => {
    const pages = inject(await pagesOf("programme-jour-j.pdf"), "Brunch", FORMULA);
    const result = parseProgramExport(pages, profile.programExport, calendar);
    if (!result.ok) throw new Error(result.reason);
    const titles = result.program.rows.map((row) => row.title);
    expect(titles).toContain(`'${FORMULA}`);
    expect(titles.some((title) => title.startsWith("="))).toBe(false);
  });

  it("un nom « =… » lu dans le PDF des prestataires retenus est neutralisé ; l'Instagram « @compte », jamais gardé tel quel, reste à valider par l'appelant", async () => {
    const original = parseEventVendorsExport(await pagesOf("prestataires-evenement.pdf"), profile.eventVendorsExport, {
      calendar,
      footerPrefix: profile.programExport.footerPrefix,
      plannerRoles: profile.programExport.plannerRoles,
    });
    if (!original.ok) throw new Error(original.reason);
    const first = original.export.rows[0]!;
    const pages = inject(await pagesOf("prestataires-evenement.pdf"), first.name, "=1+1");
    const result = parseEventVendorsExport(pages, profile.eventVendorsExport, {
      calendar,
      footerPrefix: profile.programExport.footerPrefix,
      plannerRoles: profile.programExport.plannerRoles,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.export.rows[0]!.name).toBe("'=1+1");
    for (const row of result.export.rows) {
      for (const value of [row.name, row.contact, row.email, row.type]) expect(value ?? "").not.toMatch(/^[=+\-@]/);
      if (row.instagram) expect(row.instagram).toMatch(/^@?[\w.]+$/);
    }
  });
});
