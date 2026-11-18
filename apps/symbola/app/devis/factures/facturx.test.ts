// Lot 41 (FAC-10, D1 à D5 ; ADR 0078, 0079) — le Factur-X de chaque cas, rendu comme à l'émission :
// PDF de l'app aux polices incorporées, fichier structuré relu, PDF/A-3. Les montants du XML égalent
// ceux du PDF au centime (réponse 10 de l'expert-comptable). Avec FACTURX_SAMPLES_DIR, les fichiers
// sont écrits pour veraPDF et Mustang (job « Factur-X » de la CI, rejeu local) :
//   pnpm --filter @symbola/app facturx:samples
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { formatAmount } from "@symbola/i18n";
import { facturXCases, type FacturXCase } from "@/lib/test-fixtures/facturx-cases";
import { creditNoteFacturXFile, extractFacturXml, invoiceFacturXFile } from "@/modules/quotes/service";
import { readCiiTotals } from "@/modules/quotes/facturx/cii";
import { invoicePdfLabels, type Translate } from "../document-labels";
import { buildCreditNotePdfModel, buildInvoicePdfModel } from "./invoice-pdf-model";
import { renderCreditNotePdf, renderInvoicePdf } from "./render-invoice-pdf";

const SAMPLES_DIR = process.env.FACTURX_SAMPLES_DIR ? resolve(process.env.FACTURX_SAMPLES_DIR) : null;

function labelsFor(locale: "fr" | "en") {
  const messages = locale === "en" ? enMessages : frMessages;
  return invoicePdfLabels(
    createTranslator({ locale, messages, namespace: "Documents" }) as unknown as Translate,
    createTranslator({ locale, messages, namespace: "Quotes" }) as unknown as Translate,
  );
}

async function produce(sample: FacturXCase, locale: "fr" | "en"): Promise<Buffer> {
  if (sample.kind === "invoice") return invoiceFacturXFile(sample.invoice, await renderInvoicePdf("echantillon", sample.invoice, locale), locale);
  return creditNoteFacturXFile(sample.creditNote, sample.vatApplicable, await renderCreditNotePdf("echantillon", sample.creditNote, sample.vatApplicable, locale), locale);
}

// Les montants du bandeau et des totaux tels que le PDF les imprime.
function printedTotals(sample: FacturXCase, locale: "fr" | "en"): string[] {
  const common = { labels: labelsFor(locale), locale, logo: null, watermark: null, defaultColor: "#3b3b3b" };
  const model =
    sample.kind === "invoice"
      ? buildInvoicePdfModel({ ...common, invoice: sample.invoice })
      : buildCreditNotePdfModel({ ...common, creditNote: sample.creditNote, vatApplicable: sample.vatApplicable });
  return model.totals.map((row) => row.value);
}

describe("FAC-10 — Facture au format Factur-X ; connecteur vers une plateforme agréée", () => {
  if (SAMPLES_DIR) mkdirSync(SAMPLES_DIR, { recursive: true });

  for (const sample of facturXCases()) {
    it(`${sample.name} : un PDF/A-3 porte factur-x.xml, dont les totaux relus égalent ceux du PDF au centime`, async () => {
      for (const locale of ["fr", "en"] as const) {
        const file = await produce(sample, locale);
        const text = file.toString("latin1");
        expect(text.startsWith("%PDF-")).toBe(true);
        expect(text).toContain("<pdfaid:part>3</pdfaid:part>");
        expect(text).toContain("/AFRelationship /Alternative");
        expect(text).toContain("/OutputIntents [");
        // D5 : polices incorporées (Liberation), aucune police standard non incorporée.
        expect(text).toMatch(/\/FontFile2 \d+ 0 R/);
        if (SAMPLES_DIR) writeFileSync(join(SAMPLES_DIR, `${sample.name}-${locale}.pdf`), file);
        expect(text).not.toMatch(/\/BaseFont \/(Helvetica|Times)/);
        const xml = extractFacturXml(file);
        expect(xml).not.toBeNull();
        const totals = readCiiTotals(xml!);
        const printed = printedTotals(sample, locale);
        expect(printed).toContain(formatAmount(sample.kind === "invoice" ? sample.invoice.amountDueCents : sample.creditNote.amountCents, locale));
        expect(printed).toContain(formatAmount(totals.duePayableCents, locale));
        if (sample.kind === "invoice") {
          expect(totals.grandTotalCents).toBe(sample.invoice.totals.totalTtcCents);
          expect(totals.taxTotalCents).toBe(sample.invoice.totals.totalVatCents);
          expect(totals.duePayableCents).toBe(sample.invoice.amountDueCents);
        } else {
          expect(totals.grandTotalCents).toBe(sample.creditNote.totals.totalTtcCents);
          expect(totals.duePayableCents).toBe(sample.creditNote.amountCents);
        }
        if (SAMPLES_DIR) writeFileSync(join(SAMPLES_DIR, `${sample.name}-${locale}.pdf`), file);
      }
    });
  }
});
