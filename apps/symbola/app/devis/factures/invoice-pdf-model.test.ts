// DEV-04 — le PDF d'une facture porte les mentions de départ d'une facture
// à un particulier, depuis la copie figée ; filigrane pour un essai.
// Lot 17 (DEV-11, DEV-12) : encadré de règlement avec l'IBAN, apparence de la
// copie figée, reprise par l'avoir. Libellés des vrais fichiers de traduction.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import frMessages from "@symbola/i18n/messages/fr.json";
import type { CreditNoteView, InvoiceView } from "@/modules/quotes/service";
import { pdfSafe } from "@/lib/pdf-text";
import { QuotePdfDocument } from "../[quoteId]/quote-pdf";
import { invoicePdfLabels, type Translate } from "../document-labels";
import { buildCreditNotePdfModel, buildInvoicePdfModel } from "./invoice-pdf-model";

const t = createTranslator({ locale: "fr", messages: frMessages, namespace: "Documents" }) as unknown as Translate;
const tQuotes = createTranslator({ locale: "fr", messages: frMessages, namespace: "Quotes" }) as unknown as Translate;
const labels = invoicePdfLabels(t, tQuotes);
const DEFAULT_COLOR = "#3b3b3b";

const totals = { totalHtCents: 156333, vatByRate: [{ rateBasisPoints: 2000, baseCents: 156333, vatCents: 31267 }], totalVatCents: 31267, totalTtcCents: 187600 };

const balance: InvoiceView = {
  id: "i1",
  quoteId: "q1",
  quoteNumber: "D-2027-0001",
  kind: "balance",
  scheduleItemId: null,
  number: "F-2027-0002",
  isDemo: false,
  issuedOn: "2027-04-10",
  serviceDate: "2027-09-18",
  paymentDueOn: "2027-05-10",
  amountCents: 187600,
  vatRegime: "assujetti",
  vatApplicable: true,
  legalMention: "TVA 20.00 %",
  mentions: "Paiement à réception, par virement.",
  seller: {
    organizationName: "Atelier Lumière",
    address: "1 rue des Lilas, 69001 Lyon",
    siren: "123456789",
    logoKey: null,
    document: { color: "#2f4a66", font: "modern", iban: "FR7630006000011234567890189", bic: null, intro: "Merci pour votre confiance.", terms: null, footer: null },
  },
  buyers: [{ name: "Inès Martin", billingAddress: "3 place Bellecour, 69002 Lyon" }],
  lines: [{ label: "Coordination", description: null, unit: "forfait", quantityMilli: 1000, unitPriceCents: 223000, vatRateBasisPoints: 2000, discountBasisPoints: 0, netCents: 223000 }],
  depositLabel: null,
  advanceKind: null,
  quoteTotals: { subtotalCents: 223000, globalDiscountCents: 0, totalHtCents: 223000, vatByRate: [{ rateBasisPoints: 2000, baseCents: 223000, vatCents: 44600 }], totalVatCents: 44600, totalTtcCents: 267600 },
  deductions: [{ number: "F-2027-0001", amountCents: 80000 }],
  settlements: [],
  amountDueCents: 187600,
  totals,
  creditNotes: [],
  creditedCents: 0,
};

function invoiceModel(invoice: InvoiceView, watermark: string | null = null) {
  return pdfSafe(buildInvoicePdfModel({ invoice, labels, locale: "fr", logo: null, watermark, defaultColor: DEFAULT_COLOR }));
}

const creditNote: CreditNoteView = {
  id: "c1",
  invoiceId: "i1",
  invoiceNumber: "F-2027-0002",
  number: "A-2027-0001",
  isDemo: false,
  issuedOn: "2027-04-12",
  amountCents: 12000,
  reason: "Geste commercial",
  legalMention: "TVA 20.00 %",
  seller: balance.seller,
  buyers: balance.buyers,
  totals: { totalHtCents: 10000, vatByRate: [{ rateBasisPoints: 2000, baseCents: 10000, vatCents: 2000 }], totalVatCents: 2000, totalTtcCents: 12000 },
};

describe("DEV-04 — PDF de facture et d'avoir", () => {
  it("la facture de solde porte numéro, dates, vendeur et SIREN, acheteur, lignes, TVA, acomptes déduits et reste à payer", () => {
    const model = invoiceModel(balance);
    expect(model.title).toBe("Facture F-2027-0002");
    expect(model.kind).toBe("Facture");
    expect(model.number).toBe("F-2027-0002");
    expect(model.subtitle).toBe("Facture de solde");
    expect(model.seller).toEqual({ heading: "De", name: "Atelier Lumière", lines: ["1 rue des Lilas, 69001 Lyon"] });
    expect(model.footer.legal).toBe("Atelier Lumière · SIREN 123456789");
    expect(model.client).toEqual({ heading: "Pour", lines: ["Inès Martin", "3 place Bellecour, 69002 Lyon"] });
    expect(model.dates).toEqual([
      { label: "Date d'émission", value: "10 avril 2027" },
      { label: "Prestation", value: "18 septembre 2027" },
      { label: "Échéance", value: "10 mai 2027" },
    ]);
    expect(model.totals.map((row) => row.label)).toEqual([
      "Total TTC du devis",
      "Acompte déjà facturé (F-2027-0001)",
      "Total HT",
      "TVA 20 %",
      "Total TTC",
      "Reste à payer",
    ]);
    expect(model.legalMention).toBe("TVA 20.00 %");
    expect(model.terms).toBe("Paiement à réception, par virement.");
  });

  it("une facture d'acompte en franchise porte la mention et aucune colonne de TVA ; un essai porte le filigrane", () => {
    const deposit: InvoiceView = {
      ...balance,
      kind: "deposit",
      number: "DEMO-F-2027-0001",
      isDemo: true,
      depositLabel: "Acompte à la signature",
      vatRegime: "franchise",
      vatApplicable: false,
      legalMention: "TVA non applicable, art. 293 B du CGI",
      mentions: null,
      lines: [],
      deductions: [],
      totals: { totalHtCents: 90000, vatByRate: [], totalVatCents: 0, totalTtcCents: 90000 },
      amountCents: 90000,
    };
    const model = invoiceModel(deposit, "Document fictif");
    expect(model.columns).not.toContain(tQuotes("itemVatRate"));
    expect(model.rows[0]?.cells[0]).toBe(tQuotes("pdfDepositLine", { label: "Acompte à la signature", number: "D-2027-0001" }));
    expect(model.dates[1]).toEqual({ label: "Acompte", value: "18 septembre 2027" });
    expect(model.legalMention).toBe("TVA non applicable, art. 293 B du CGI");
    expect(model.terms).toBeNull();
    expect(model.watermark).toBe("Document fictif");
  });

  it("l'avoir référence la facture corrigée et son motif, et produit un PDF A4", async () => {
    const model = pdfSafe(
      buildCreditNotePdfModel({ creditNote, vatApplicable: true, labels, locale: "fr", logo: null, watermark: null, defaultColor: DEFAULT_COLOR }),
    );
    expect(model.title).toBe("Avoir A-2027-0001");
    expect(model.kind).toBe("Avoir");
    expect(model.subtitle).toBe("Avoir sur la facture F-2027-0002");
    expect(model.intro).toBe("Motif : Geste commercial");
    expect(model.payment).toBeNull();
    const pdf = await renderToBuffer(createElement(QuotePdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("DEV-11 — Paiement : IBAN, échéance, échéancier", () => {
  it("une facture émise avec un IBAN porte l'encadré « Règlement » : échéance, IBAN, référence à indiquer", () => {
    expect(invoiceModel(balance).payment).toEqual({
      title: "Règlement",
      lines: [
        { label: "À régler avant le 10 mai 2027, par virement.", amount: null },
        { label: "IBAN FR76 3000 6000 0112 3456 7890 189", amount: null },
        { label: "Référence à rappeler : F-2027-0002", amount: null },
      ],
    });
  });

  it("sans IBAN, l'encadré n'affiche que l'échéance et la référence, sans ligne vide", () => {
    const withoutIban = { ...balance, seller: { ...balance.seller, document: { ...balance.seller.document!, iban: null } } };
    expect(invoiceModel(withoutIban).payment).toEqual({
      title: "Règlement",
      lines: [
        { label: "À régler avant le 10 mai 2027.", amount: null },
        { label: "Référence à rappeler : F-2027-0002", amount: null },
      ],
    });
  });
});

describe("DEV-12 — Nouvelle mise en page, figée à l'émission", () => {
  it("la facture imprime l'apparence et l'introduction de sa copie figée ; l'avoir reprend la même apparence", () => {
    const model = invoiceModel(balance);
    expect(model.appearance).toMatchObject({ accent: "#2f4a66", font: "modern" });
    expect(model.intro).toBe("Merci pour votre confiance.");
    const note = buildCreditNotePdfModel({ creditNote, vatApplicable: true, labels, locale: "fr", logo: null, watermark: null, defaultColor: DEFAULT_COLOR });
    expect(note.appearance).toEqual(model.appearance);
  });

  it("une facture émise avant le lot 17 s'imprime avec l'apparence neutre", () => {
    const legacy = { ...balance, seller: { organizationName: "Atelier Lumière", address: null, siren: "123456789", logoKey: null } };
    const model = invoiceModel(legacy);
    expect(model.appearance).toMatchObject({ accent: DEFAULT_COLOR, font: "modern" });
    expect(model.intro).toBeNull();
  });
});

// Lot 23b (DOC-08, ADR 0061) — « Une facture émise d'une page pèse moins de
// 150 Ko ». Avec un logo JPEG courant (44 Ko). Un logo très lourd (jusqu'à
// 2 Mo acceptés à l'envoi) dépasserait : sa réduction à l'envoi relève de DOC-09.
describe("DOC-08 — Poids de l'original d'une facture", () => {
  it("une facture d'une page, avec logo, pèse moins de 150 Ko", async () => {
    const logo = { data: readFileSync(new URL("../../../public/aide/captures/search.jpg", import.meta.url)), format: "jpg" as const };
    const model = pdfSafe(buildInvoicePdfModel({ invoice: balance, labels, locale: "fr", logo, watermark: null, defaultColor: DEFAULT_COLOR }));
    const pdf = await renderToBuffer(createElement(QuotePdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.byteLength).toBeLessThan(150 * 1024);
  });
});

// Lot 31c (FAC-05, JUR-08 ; réponses 7 et 7 bis de l'expert-comptable, D20 et D21).
const spaced = (rows: { label: string; value: string; strong?: boolean }[]) => rows.map((row) => [row.label, row.value.replace(/\s/g, " "), row.strong ?? false]);

describe("FAC-05 — Solde par taux, arrhes en règlement (lot 31c, D20, D21)", () => {
  it("le solde montre le devis par taux, chaque acompte déduit en HT et en TVA, puis le solde par taux et le reste à payer", () => {
    const quoteTotals = {
      subtotalCents: 230000,
      globalDiscountCents: 0,
      totalHtCents: 230000,
      vatByRate: [
        { rateBasisPoints: 1000, baseCents: 80000, vatCents: 8000 },
        { rateBasisPoints: 2000, baseCents: 150000, vatCents: 30000 },
      ],
      totalVatCents: 38000,
      totalTtcCents: 268000,
    };
    const deposit = { totalHtCents: 69000, vatByRate: [{ rateBasisPoints: 1000, baseCents: 24000, vatCents: 2400 }, { rateBasisPoints: 2000, baseCents: 45000, vatCents: 9000 }], totalVatCents: 11400, totalTtcCents: 80400 };
    const rest = { totalHtCents: 161000, vatByRate: [{ rateBasisPoints: 1000, baseCents: 56000, vatCents: 5600 }, { rateBasisPoints: 2000, baseCents: 105000, vatCents: 21000 }], totalVatCents: 26600, totalTtcCents: 187600 };
    const model = invoiceModel({ ...balance, quoteTotals, deductions: [{ number: "F-2027-0001", amountCents: 80400, totals: deposit }], totals: rest, amountCents: 187600, amountDueCents: 187600 });
    expect(spaced(model.totals)).toEqual([
      ["Total HT du devis", "2 300,00 €", false],
      ["TVA 10 % du devis", "80,00 €", false],
      ["TVA 20 % du devis", "300,00 €", false],
      ["Total TTC du devis", "2 680,00 €", false],
      ["Acompte F-2027-0001 déduit, HT", "− 690,00 €", false],
      ["Acompte F-2027-0001 déduit, TVA 10 %", "− 24,00 €", false],
      ["Acompte F-2027-0001 déduit, TVA 20 %", "− 90,00 €", false],
      ["Solde HT", "1 610,00 €", false],
      ["Solde, TVA 10 %", "56,00 €", false],
      ["Solde, TVA 20 %", "210,00 €", false],
      ["Reste à payer", "1 876,00 €", true],
    ]);
  });

  it("devis à arrhes : le prix total, puis les arrhes reçues en règlement, puis le reste à payer ; jamais « facture d'arrhes »", () => {
    const full = { totalHtCents: 223000, vatByRate: [{ rateBasisPoints: 2000, baseCents: 223000, vatCents: 44600 }], totalVatCents: 44600, totalTtcCents: 267600 };
    const model = invoiceModel({
      ...balance,
      advanceKind: "earnest",
      deductions: [],
      totals: full,
      amountCents: 267600,
      settlements: [{ label: "Arrhes à la réservation", paidOn: "2027-01-05", amountCents: 80000 }],
      amountDueCents: 187600,
    });
    expect(model.subtitle).toBe("Facture de solde");
    expect(spaced(model.totals)).toEqual([
      ["Total HT", "2 230,00 €", false],
      ["TVA 20 %", "446,00 €", false],
      ["Total TTC", "2 676,00 €", true],
      ["Arrhes reçues le 5 janvier 2027 (Arrhes à la réservation)", "− 800,00 €", false],
      ["Reste à payer", "1 876,00 €", true],
    ]);
  });
});
