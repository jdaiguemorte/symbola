// Lot 31c (JUR-08 ; réponse 7 bis de l'expert-comptable, décision D21) — PDF du reçu d'arrhes : non
// fiscal, de sa propre série, il dit qu'il n'est pas une facture ; vendeur (« EI » compris) et
// clients figés, date et montant reçus, mode de paiement ; un encaissement annulé est marqué.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import frMessages from "@symbola/i18n/messages/fr.json";
import type { ReceiptView } from "@/modules/quotes/service";
import { pdfSafe } from "@/lib/pdf-text";
import { QuotePdfDocument } from "../[quoteId]/quote-pdf";
import { receiptPdfLabels, type Translate } from "../document-labels";
import { buildReceiptPdfModel } from "./receipt-pdf-model";

const t = createTranslator({ locale: "fr", messages: frMessages, namespace: "Documents" }) as unknown as Translate;
const tQuotes = createTranslator({ locale: "fr", messages: frMessages, namespace: "Quotes" }) as unknown as Translate;
const labels = receiptPdfLabels(t, tQuotes);

const receipt: ReceiptView = {
  id: "r1",
  quoteId: "q1",
  quoteNumber: "D-2027-0004",
  scheduleItemId: "s1",
  number: "R-2027-0001",
  isDemo: false,
  issuedOn: "2027-04-12",
  paidOn: "2027-04-11",
  amountCents: 50000,
  label: "Arrhes à la réservation",
  paymentMethodLabel: "Virement bancaire",
  seller: { organizationName: "Atelier Lumière", address: "1 rue des Lilas, 69001 Lyon", siren: "123456789", logoKey: null, legalForm: "auto_entrepreneur" },
  buyers: [
    { name: "Léa Martin", billingAddress: "4 rue des Lilas, 24200 Sarlat" },
    { name: "Maxime Dubois", billingAddress: "4 rue des Lilas, 24200 Sarlat" },
  ],
  cancelled: false,
};

const model = (view: ReceiptView, watermark: string | null = null) => pdfSafe(buildReceiptPdfModel({ receipt: view, labels, locale: "fr", logo: null, watermark, defaultColor: "#3b3b3b" }));

describe("JUR-08 — Reçu d'arrhes non fiscal (lot 31c, D21)", () => {
  it("numéro de sa série, dit qu'il n'est pas une facture ; vendeur avec « EI », clients, date et montant reçus, devis", () => {
    const pdf = model(receipt);
    expect(pdf.title).toBe("Reçu d'arrhes R-2027-0001");
    expect(pdf.number).toBe("R-2027-0001");
    expect(pdf.subtitle).toBe("Document non fiscal : ce reçu n'est pas une facture.");
    expect(pdf.seller.name).toBe("Atelier Lumière EI");
    expect(pdf.client.lines).toEqual(["Léa Martin", "4 rue des Lilas, 24200 Sarlat", "Maxime Dubois", "4 rue des Lilas, 24200 Sarlat"]);
    expect(pdf.dates).toEqual([
      { label: "Date du reçu", value: "12 avril 2027" },
      { label: "Arrhes reçues le", value: "11 avril 2027" },
    ]);
    expect(pdf.rows[0]?.cells[0]).toBe("Arrhes « Arrhes à la réservation » du devis D-2027-0004");
    expect(pdf.totals.map((row) => [row.label, row.value.replace(/\s/g, " "), row.strong ?? false])).toEqual([["Montant reçu", "500,00 €", true]]);
    expect(pdf.payment?.lines.map((line) => line.label)).toEqual(["Reçu par Virement bancaire"]);
    expect(pdf.legalMention).toBe("Reçu non fiscal. Ces arrhes viendront en règlement sur la facture de solde.");
    expect(pdf.status).toBeNull();
  });

  it("un encaissement annulé est marqué ; un reçu d'essai porte le filigrane ; le PDF se rend", async () => {
    const cancelled = model({ ...receipt, cancelled: true, isDemo: true, number: "DEMO-R-2027-0001" }, "Document fictif");
    expect(cancelled.status).toBe("Encaissement annulé");
    expect(cancelled.watermark).toBe("Document fictif");
    const pdf = await renderToBuffer(createElement(QuotePdfDocument, { model: cancelled }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
