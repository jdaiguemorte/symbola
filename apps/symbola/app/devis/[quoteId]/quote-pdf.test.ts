// DEV-01 — PDF du devis : en-tête vendeur, numéro et version, validité,
// mention légale ; filigrane « Document fictif » pour un devis d'essai.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { QuoteDetail, QuoteVersionView } from "@/modules/quotes/service";
import { QuotePdfDocument } from "./quote-pdf";
import { buildQuotePdfModel, type QuotePdfLabels } from "./quote-pdf-model";

const labels: QuotePdfLabels = {
  title: (number, version) => `Devis ${number} — version ${version}`,
  draft: "Brouillon — non envoyé",
  issuedOn: (date) => `Émis le ${date}`,
  validUntil: (date) => `Valable jusqu'au ${date}`,
  siren: (siren) => `SIREN ${siren}`,
  client: (names) => `Pour : ${names}`,
  columns: { label: "Intitulé", quantity: "Quantité", unitPrice: "Prix", discount: "Remise", vatRate: "TVA", total: "Total HT" },
  subtotal: "Sous-total HT",
  globalDiscount: "Remise globale",
  totalHt: "Total HT",
  vatAtRate: (rate) => `TVA ${rate} %`,
  totalTtc: "Total TTC",
};

function version(overrides: Partial<QuoteVersionView> = {}): QuoteVersionView {
  return {
    id: "v1",
    version: 1,
    lines: [
      {
        id: "l1",
        catalogItemId: null,
        label: "Coordination jour J",
        description: "Présence de 8 h à 2 h",
        unit: "forfait",
        quantityMilli: 1000,
        unitPriceCents: 150000,
        vatRateBasisPoints: 2000,
        discountBasisPoints: 0,
        position: 0,
        netCents: 150000,
      },
    ],
    globalDiscount: { kind: "none" },
    totals: { subtotalCents: 150000, globalDiscountCents: 0, totalHtCents: 150000, vatByRate: [], totalVatCents: 0, totalTtcCents: 150000 },
    vatApplicable: false,
    vatRegime: "franchise",
    legalMention: "TVA non applicable, art. 293 B du CGI",
    seller: { organizationName: "Atelier Lumière", address: "1 rue des Lilas, 69001 Lyon", siren: "123456789", logoKey: null },
    validUntil: "2027-04-14",
    sentAt: "2027-03-15T10:00:00.000Z",
    ...overrides,
  };
}

function quote(current: QuoteVersionView, isDemo = false): QuoteDetail {
  return {
    id: "q1",
    eventId: "e1",
    number: isDemo ? "DEMO-D-2027-0001" : "D-2027-0001",
    status: current.sentAt ? "sent" : "draft",
    currentVersion: current.version,
    isDemo,
    totalTtcCents: current.totals.totalTtcCents,
    versions: [current],
    current,
    regimeChangedSinceSent: false,
  };
}

const draftSeller = { organizationName: "Nouveau nom", address: "Nouvelle adresse", siren: "999999999", logoKey: null };

function model(current: QuoteVersionView, isDemo = false) {
  return buildQuotePdfModel({
    quote: quote(current, isDemo),
    version: current,
    draftSeller,
    draftLegalMention: "Mention courante",
    clientNames: "Inès & Sacha",
    logo: null,
    labels,
    locale: "fr",
    watermark: isDemo ? "Document fictif" : null,
  });
}

describe("DEV-01 — PDF du devis", () => {
  it("une version envoyée porte l'en-tête vendeur figé, le numéro, la version, la validité et la mention de franchise, sans TVA", () => {
    const result = model(version());
    expect(result.title).toBe("Devis D-2027-0001 — version 1");
    expect(result.status).toBeNull();
    expect(result.seller).toEqual({ name: "Atelier Lumière", lines: ["1 rue des Lilas, 69001 Lyon", "SIREN 123456789"] });
    expect(result.dates).toEqual(["Émis le 15 mars 2027", "Valable jusqu'au 14 avril 2027"]);
    expect(result.legalMention).toBe("TVA non applicable, art. 293 B du CGI");
    expect(result.columns).not.toContain("TVA");
    expect(result.totals.map((total) => total.label)).toEqual(["Sous-total HT", "Total HT"]);
    expect(result.watermark).toBeNull();
  });

  it("assujettie : colonne de taux, TVA par taux et total TTC", () => {
    const result = model(
      version({
        vatApplicable: true,
        vatRegime: "assujetti",
        legalMention: null,
        totals: {
          subtotalCents: 150000,
          globalDiscountCents: 0,
          totalHtCents: 150000,
          vatByRate: [{ rateBasisPoints: 2000, baseCents: 150000, vatCents: 30000 }],
          totalVatCents: 30000,
          totalTtcCents: 180000,
        },
      }),
    );
    expect(result.columns).toContain("TVA");
    expect(result.rows[0]?.cells).toContain("20 %");
    expect(result.totals.map((total) => total.label)).toEqual(["Sous-total HT", "Total HT", "TVA 20 %", "Total TTC"]);
  });

  it("un brouillon est signalé comme tel et prend l'en-tête et la mention courants", () => {
    const result = model(version({ sentAt: null, validUntil: null, seller: null, legalMention: null }));
    expect(result.status).toBe("Brouillon — non envoyé");
    expect(result.seller.name).toBe("Nouveau nom");
    expect(result.legalMention).toBe("Mention courante");
    expect(result.dates).toEqual([]);
  });

  it("un devis d'essai porte le filigrane « Document fictif » et son numéro DEMO", () => {
    const result = model(version(), true);
    expect(result.watermark).toBe("Document fictif");
    expect(result.title).toContain("DEMO-D-2027-0001");
  });

  it("produit un PDF A4, sur plusieurs pages quand le devis est long", async () => {
    const long = version({ lines: Array.from({ length: 80 }, (_, index) => ({ ...version().lines[0]!, id: `l${index}` })) });
    const pdf = await renderToBuffer(
      createElement(QuotePdfDocument, { model: model(long, true) }) as unknown as ReactElement<DocumentProps>,
    );
    const text = pdf.toString("latin1");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(text).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});
