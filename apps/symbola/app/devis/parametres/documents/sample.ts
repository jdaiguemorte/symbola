// Lot 17 (DEV-09, ADR 0046) — devis et facture d'exemple de l'écran
// Documents : mêmes constructeurs que les vrais PDF, données fictives tirées
// des fichiers de traduction, réglages de l'organisation. Partagé par
// l'aperçu (client) et par « Télécharger un exemple en PDF » (serveur) ; rien
// n'est enregistré, aucun rang de numérotation n'est consommé.
import type { Locale } from "@symbola/i18n";
import type { InvoiceView, QuoteDetail, QuoteLine, QuoteVersionView, SellerSnapshot } from "@/modules/quotes/service";
import { invoicePdfLabels, quotePdfLabels, type Translate } from "../../document-labels";
import { buildInvoicePdfModel } from "../../factures/invoice-pdf-model";
import { buildQuotePdfModel, type QuotePdfLogo, type QuotePdfModel } from "../../[quoteId]/quote-pdf-model";

// Ce que le serveur sait de l'organisation, sérialisable vers le client.
export type SampleContext = {
  // Date du jour à Paris (AAAA-MM-JJ) : la même au serveur et au client.
  today: string;
  quoteNumber: string;
  depositNumber: string;
  invoiceNumber: string;
  validityDays: number;
  paymentTermDays: number;
  // null : franchise de TVA.
  vatRateBasisPoints: number | null;
  legalMention: string | null;
};

export type SampleInput = {
  kind: "quote" | "invoice";
  seller: SellerSnapshot;
  context: SampleContext;
  // t : section « Documents » ; tQuotes : section « Quotes ».
  t: Translate;
  tQuotes: Translate;
  locale: Locale;
  defaultColor: string;
  logo: QuotePdfLogo | null;
  watermark: string | null;
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function sampleLines(t: Translate, vatRate: number): QuoteLine[] {
  const line = (index: number, label: string, description: string | null, unit: string, quantityMilli: number, unitPriceCents: number, discountBasisPoints: number) => ({
    id: `sample-${index}`,
    catalogItemId: null,
    label,
    description,
    unit,
    quantityMilli,
    unitPriceCents,
    vatRateBasisPoints: vatRate,
    discountBasisPoints,
    position: index,
    netCents: Math.round(((unitPriceCents * quantityMilli) / 1000) * (1 - discountBasisPoints / 10000)),
  });
  return [
    line(0, t("sampleLine1"), t("sampleLine1Description"), t("sampleUnitPackage"), 1000, 450000, 0),
    line(1, t("sampleLine2"), null, t("sampleUnitTables"), 12000, 8500, 0),
    line(2, t("sampleLine3"), null, t("sampleUnitPackage"), 1000, 65000, 1000),
  ];
}

function sampleVersion(input: SampleInput): QuoteVersionView {
  const { context, t } = input;
  const vatRate = context.vatRateBasisPoints ?? 0;
  const vat = context.vatRateBasisPoints !== null;
  const lines = sampleLines(t, vatRate);
  const totalHtCents = lines.reduce((sum, line) => sum + line.netCents, 0);
  const vatCents = vat ? Math.round((totalHtCents * vatRate) / 10000) : 0;
  const totalTtcCents = totalHtCents + vatCents;
  const depositCents = Math.round(totalTtcCents * 0.3);
  return {
    id: "sample-version",
    version: 1,
    lines,
    globalDiscount: { kind: "none" },
    totals: {
      subtotalCents: totalHtCents,
      globalDiscountCents: 0,
      totalHtCents,
      vatByRate: vat ? [{ rateBasisPoints: vatRate, baseCents: totalHtCents, vatCents }] : [],
      totalVatCents: vatCents,
      totalTtcCents,
    },
    vatApplicable: vat,
    vatRegime: vat ? "assujetti" : "franchise",
    legalMention: context.legalMention,
    seller: input.seller,
    validUntil: addDays(context.today, context.validityDays),
    sentAt: `${context.today}T10:00:00.000Z`,
    schedule: {
      items: [
        {
          id: "sample-deposit",
          label: t("sampleDeposit"),
          dueDate: addDays(context.today, 7),
          fixedAmountCents: null,
          percentageBasisPoints: 3000,
          amountCents: depositCents,
          paidOn: null,
          paymentMethodId: null,
          paymentMethodLabel: null,
          overdue: false,
          position: 0,
          payments: [],
        },
      ],
      scheduledCents: depositCents,
      balanceCents: totalTtcCents - depositCents,
      exceedsTotal: false,
    },
  };
}

export function sampleDocumentModel(input: SampleInput): QuotePdfModel {
  const { context, t, tQuotes, locale } = input;
  const version = sampleVersion(input);
  const eventDate = addDays(context.today, 210);

  if (input.kind === "quote") {
    const quote: QuoteDetail = {
      id: "sample-quote",
      eventId: "sample-event",
      number: context.quoteNumber,
      status: "sent",
      currentVersion: 1,
      isDemo: false,
      clientKind: "individual",
      totalTtcCents: version.totals.totalTtcCents,
      versions: [version],
      current: version,
      regimeChangedSinceSent: false,
      signature: null,
    };
    return buildQuotePdfModel({
      quote,
      version,
      draftSeller: input.seller,
      draftLegalMention: context.legalMention,
      clientNames: t("sampleClients"),
      eventDate,
      logo: input.logo,
      labels: quotePdfLabels(t, tQuotes),
      locale,
      watermark: input.watermark,
      defaultColor: input.defaultColor,
    });
  }

  // Facture de solde : l'acompte de l'échéancier, déjà facturé, est déduit.
  const deposit = version.schedule.items[0]?.amountCents ?? 0;
  const amountCents = version.totals.totalTtcCents - deposit;
  const totalHtCents = Math.round((version.totals.totalHtCents * amountCents) / version.totals.totalTtcCents);
  const vatCents = amountCents - totalHtCents;
  const buyerAddress = t("sampleBuyerAddress");
  const invoice: InvoiceView = {
    id: "sample-invoice",
    quoteId: "sample-quote",
    quoteNumber: context.quoteNumber,
    kind: "balance",
    scheduleItemId: null,
    number: context.invoiceNumber,
    isDemo: false,
    issuedOn: context.today,
    serviceDate: eventDate,
    paymentDueOn: addDays(context.today, context.paymentTermDays),
    amountCents,
    vatRegime: version.vatApplicable ? "assujetti" : "franchise",
    vatApplicable: version.vatApplicable,
    legalMention: context.legalMention,
    // Les conditions de paiement de l'exemple : celles des réglages en cours.
    mentions: input.seller.document?.terms ?? null,
    seller: input.seller,
    buyers: [
      { name: t("sampleBuyer1"), billingAddress: buyerAddress },
      { name: t("sampleBuyer2"), billingAddress: buyerAddress },
    ],
    lines: version.lines,
    depositLabel: null,
    quoteTotals: version.totals,
    deductions: [{ number: context.depositNumber, amountCents: deposit }],
    totals: {
      totalHtCents,
      vatByRate: version.vatApplicable ? [{ rateBasisPoints: context.vatRateBasisPoints ?? 0, baseCents: totalHtCents, vatCents }] : [],
      totalVatCents: version.vatApplicable ? vatCents : 0,
      totalTtcCents: amountCents,
    },
    creditNotes: [],
    creditedCents: 0,
  };
  return buildInvoicePdfModel({
    invoice,
    labels: invoicePdfLabels(t, tQuotes),
    locale,
    logo: input.logo,
    watermark: input.watermark,
    defaultColor: input.defaultColor,
  });
}
