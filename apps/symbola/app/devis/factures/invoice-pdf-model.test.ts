// DEV-04 — le PDF d'une facture porte les mentions de départ d'une facture
// à un particulier, depuis la copie figée ; filigrane pour un essai.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/modules/quotes/service";
import { QuotePdfDocument } from "../[quoteId]/quote-pdf";
import { buildCreditNotePdfModel, buildInvoicePdfModel, type InvoicePdfLabels } from "./invoice-pdf-model";

const labels: InvoicePdfLabels = {
  invoiceTitle: (number) => `Facture ${number}`,
  depositInvoice: "Facture d'acompte",
  balanceInvoice: "Facture de solde",
  creditNoteTitle: (number) => `Avoir ${number}`,
  creditNoteFor: (number) => `Avoir sur la facture ${number}`,
  reason: (reason) => `Motif : ${reason}`,
  issuedOn: (date) => `Émise le ${date}`,
  serviceDate: (date) => `Date de la prestation : ${date}`,
  depositDate: (date) => `Date de l'acompte : ${date}`,
  dueOn: (date) => `Échéance de paiement : ${date}`,
  siren: (siren) => `SIREN ${siren}`,
  buyers: (lines) => `Facturé à :\n${lines}`,
  depositLine: (label, number) => `Acompte « ${label} » sur le devis ${number}`,
  creditNoteLine: (number) => `Avoir sur la facture ${number}`,
  columns: { label: "Désignation", quantity: "Quantité", unitPrice: "Prix HT", discount: "Remise", vatRate: "TVA", total: "Total HT" },
  totalHt: "Total HT",
  vatAtRate: (rate) => `TVA ${rate} %`,
  totalTtc: "Total TTC",
  quoteTotalTtc: "Total TTC du devis",
  deduction: (number) => `Acompte déjà facturé (${number})`,
  amountDue: "Reste à payer",
};

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
  seller: { organizationName: "Atelier Lumière", address: "1 rue des Lilas, 69001 Lyon", siren: "123456789", logoKey: null },
  buyers: [{ name: "Inès Martin", billingAddress: "3 place Bellecour, 69002 Lyon" }],
  lines: [{ label: "Coordination", description: null, unit: "forfait", quantityMilli: 1000, unitPriceCents: 223000, vatRateBasisPoints: 2000, discountBasisPoints: 0, netCents: 223000 }],
  depositLabel: null,
  quoteTotals: { subtotalCents: 223000, globalDiscountCents: 0, totalHtCents: 223000, vatByRate: [{ rateBasisPoints: 2000, baseCents: 223000, vatCents: 44600 }], totalVatCents: 44600, totalTtcCents: 267600 },
  deductions: [{ number: "F-2027-0001", amountCents: 80000 }],
  totals,
  creditNotes: [],
  creditedCents: 0,
};

describe("DEV-04 — PDF de facture et d'avoir", () => {
  it("la facture de solde porte numéro, dates, vendeur et SIREN, acheteur, lignes, TVA, acomptes déduits et reste à payer", () => {
    const model = buildInvoicePdfModel({ invoice: balance, labels, locale: "fr", logo: null, watermark: null });
    expect(model.title).toBe("Facture F-2027-0002");
    expect(model.status).toBe("Facture de solde");
    expect(model.seller).toEqual({ name: "Atelier Lumière", lines: ["1 rue des Lilas, 69001 Lyon", "SIREN 123456789"] });
    expect(model.client).toBe("Facturé à :\nInès Martin, 3 place Bellecour, 69002 Lyon");
    expect(model.dates).toEqual(["Émise le 10 avril 2027", "Date de la prestation : 18 septembre 2027", "Échéance de paiement : 10 mai 2027"]);
    expect(model.totals.map((row) => row.label)).toEqual([
      "Total TTC du devis",
      "Acompte déjà facturé (F-2027-0001)",
      "Total HT",
      "TVA 20 %",
      "Total TTC",
      "Reste à payer",
    ]);
    expect(model.legalMention).toBe("TVA 20.00 %\nPaiement à réception, par virement.");
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
    const model = buildInvoicePdfModel({ invoice: deposit, labels, locale: "fr", logo: null, watermark: "Document fictif" });
    expect(model.columns).not.toContain("TVA");
    expect(model.rows[0]?.cells[0]).toBe("Acompte « Acompte à la signature » sur le devis D-2027-0001");
    expect(model.dates[1]).toBe("Date de l'acompte : 18 septembre 2027");
    expect(model.legalMention).toBe("TVA non applicable, art. 293 B du CGI");
    expect(model.watermark).toBe("Document fictif");
  });

  it("l'avoir référence la facture corrigée et son motif, et produit un PDF A4", async () => {
    const model = buildCreditNotePdfModel({
      creditNote: {
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
      },
      vatApplicable: true,
      labels,
      locale: "fr",
      logo: null,
      watermark: null,
    });
    expect(model.title).toBe("Avoir A-2027-0001");
    expect(model.status).toBe("Avoir sur la facture F-2027-0002");
    expect(model.dates).toContain("Motif : Geste commercial");
    const pdf = await renderToBuffer(createElement(QuotePdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
