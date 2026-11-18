// Lot 41 (FAC-10, D4) — pièces de test de chaque cas du Factur-X : acompte, solde avec acomptes
// déduits, avoirs partiel et total, franchise et assujetti à plusieurs taux, particulier et
// professionnel, essai guidé (DEMO), arrhes en règlement. Données fictives (DAT-10) ; les montants
// sont calculés par les mêmes règles que l'émission (amounts.ts, invoicing.ts), jamais saisis à la
// main. Servent aux tests unitaires et au script des fichiers contrôlés par veraPDF et Mustang en CI.
import type { CreditNoteView, InvoiceBuyer, InvoiceReform, InvoiceView, LineNature, SellerSnapshot } from "@symbola/contracts";
import { computeQuoteTotals, lineAmounts } from "@/modules/quotes/amounts";
import { balanceTotals, prorateTotals } from "@/modules/quotes/invoicing";

type Line = { label: string; description: string | null; unit: string; quantityMilli: number; unitPriceCents: number; vatRateBasisPoints: number; discountBasisPoints: number; nature: LineNature };

const LINES: Line[] = [
  { label: "Coordination du jour J", description: "Présence de 10 h à 2 h", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 2000, discountBasisPoints: 0, nature: "service" },
  { label: "Décoration florale", description: null, unit: "lot", quantityMilli: 2000, unitPriceCents: 40000, vatRateBasisPoints: 1000, discountBasisPoints: 1000, nature: "goods" },
  { label: "Heures de préparation", description: null, unit: "heure", quantityMilli: 1500, unitPriceCents: 4533, vatRateBasisPoints: 2000, discountBasisPoints: 0, nature: "service" },
];

function seller(vat: boolean): SellerSnapshot {
  return {
    organizationName: "Atelier Fictif & Fils",
    address: "12 rue des Tilleuls",
    postalCode: "24200",
    city: "Sarlat-la-Canéda",
    countryCode: "FR",
    siren: "123456782",
    siret: "12345678200017",
    logoKey: null,
    legalForm: vat ? "sas" : "auto_entrepreneur",
    vatNumber: vat ? "FR40123456782" : null,
    registration: vat ? "RCS Bergerac 123 456 782" : null,
    shareCapitalCents: vat ? 100000 : null,
    contactEmail: "contact@atelier-fictif.example",
    contactPhone: null,
    website: null,
    document: { color: null, font: "modern", iban: "FR7630006000011234567890189", bic: "AGRIFRPP", intro: null, terms: null, footer: null },
  };
}

const PERSONS: InvoiceBuyer[] = [
  { name: "Inès Fictive", billingAddress: "3 place Bellecour, 69002 Lyon" },
  { name: "Sacha Fictif", billingAddress: "3 place Bellecour, 69002 Lyon" },
];

// SC-11 : Novaléa SAS (SIREN fictif), adresse de facturation distincte du lieu.
const COMPANY: InvoiceBuyer = {
  kind: "company",
  name: "Novaléa SAS <Événements & Co>",
  billingAddress: "8 avenue des Champs, 75008 Paris",
  siren: "552100554",
  vatNumber: "FR83552100554",
  address: { line: "8 avenue des Champs", postalCode: "75008", city: "Paris", countryCode: "FR" },
};

function reform(professional: boolean, overrides: Partial<InvoiceReform> = {}): InvoiceReform {
  return {
    format: "facturx",
    category: "mixed",
    vatOnDebits: professional,
    orderReference: professional ? "BC-2027-0142 \"urgent\" & <prioritaire>" : null,
    buyerReference: professional ? "Service achats 'Événements'" : null,
    deliveryAddress: professional ? { line: "Château des Essais, route du Lac", postalCode: "74000", city: "Annecy", countryCode: "FR" } : null,
    professionalTerms: professional ? { paymentTermDays: 30, endOfMonth: false, discountTerms: "Néant", latePenaltyRate: "three_times_legal" } : null,
    ...overrides,
  };
}

type CaseOptions = { vat: boolean; professional: boolean; isDemo?: boolean; withGlobalDiscount?: boolean };

function quote(options: CaseOptions) {
  const lines = LINES.map((line) => ({ ...line, netCents: lineAmounts(line).netCents }));
  const totals = computeQuoteTotals(lines, options.withGlobalDiscount === false ? { kind: "none" } : { kind: "percent", basisPoints: 500 }, options.vat);
  return { lines, totals };
}

function baseInvoice(options: CaseOptions): Omit<InvoiceView, "kind" | "number" | "amountCents" | "totals" | "lines" | "depositLabel" | "deductions" | "amountDueCents" | "scheduleItemId" | "serviceDate"> {
  const { totals } = quote(options);
  return {
    id: "00000000-0000-4000-8000-000000000001",
    quoteId: "00000000-0000-4000-8000-000000000002",
    quoteNumber: "D-2027-0007",
    isDemo: options.isDemo ?? false,
    issuedOn: "2027-04-10",
    paymentDueOn: "2027-05-10",
    vatRegime: options.vat ? "assujetti" : "franchise",
    vatApplicable: options.vat,
    legalMention: options.vat ? null : "TVA non applicable, art. 293 B du CGI",
    mentions: options.professional ? "Paiement par virement." : "Paiement à réception, par virement.",
    seller: seller(options.vat),
    buyers: options.professional ? [COMPANY] : PERSONS,
    advanceKind: "deposit",
    quoteTotals: totals,
    settlements: [],
    creditNotes: [],
    creditedCents: 0,
    reform: reform(options.professional),
  };
}

export function depositInvoiceCase(options: CaseOptions): InvoiceView {
  const base = baseInvoice(options);
  const amountCents = Math.round((base.quoteTotals.totalTtcCents * 3000) / 10000);
  const totals = prorateTotals(base.quoteTotals, amountCents);
  return {
    ...base,
    kind: "deposit",
    scheduleItemId: "00000000-0000-4000-8000-000000000003",
    number: options.isDemo ? "DEMO-F-2027-0001" : "F-2027-0001",
    serviceDate: "2027-04-15",
    amountCents,
    lines: [],
    depositLabel: "Acompte à la signature",
    deductions: [],
    totals,
    amountDueCents: amountCents,
  };
}

export function balanceInvoiceCase(options: CaseOptions): InvoiceView {
  const base = baseInvoice(options);
  const deposit = depositInvoiceCase(options);
  const totals = balanceTotals(base.quoteTotals, [deposit.totals]);
  return {
    ...base,
    kind: "balance",
    scheduleItemId: null,
    number: "F-2027-0002",
    issuedOn: "2027-09-19",
    serviceDate: "2027-09-18",
    paymentDueOn: "2027-10-19",
    amountCents: totals.totalTtcCents,
    lines: quote(options).lines,
    depositLabel: null,
    deductions: [{ number: deposit.number, amountCents: deposit.amountCents, totals: deposit.totals }],
    totals,
    amountDueCents: totals.totalTtcCents,
  };
}

// Devis à arrhes (lot 31c, D21) : solde au prix total, arrhes reçues en règlement.
export function earnestBalanceCase(options: CaseOptions): InvoiceView {
  const balance = balanceInvoiceCase(options);
  const settlements = [{ label: "Arrhes", paidOn: "2027-04-12", amountCents: 50000 }];
  return {
    ...balance,
    advanceKind: "earnest",
    deductions: [],
    totals: { totalHtCents: balance.quoteTotals.totalHtCents, vatByRate: balance.quoteTotals.vatByRate, totalVatCents: balance.quoteTotals.totalVatCents, totalTtcCents: balance.quoteTotals.totalTtcCents },
    amountCents: balance.quoteTotals.totalTtcCents,
    settlements,
    amountDueCents: balance.quoteTotals.totalTtcCents - 50000,
  };
}

export function creditNoteCase(options: CaseOptions & { total: boolean }): { creditNote: CreditNoteView; vatApplicable: boolean } {
  const invoice = depositInvoiceCase(options);
  const amountCents = options.total ? invoice.amountCents : 10000;
  const totals = prorateTotals({ subtotalCents: invoice.totals.totalHtCents, globalDiscountCents: 0, ...invoice.totals }, amountCents);
  return {
    vatApplicable: options.vat,
    creditNote: {
      id: "00000000-0000-4000-8000-000000000004",
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      number: options.total ? "A-2027-0002" : "A-2027-0001",
      isDemo: false,
      issuedOn: "2027-05-02",
      amountCents,
      reason: "Geste commercial <après échange>",
      legalMention: invoice.legalMention,
      seller: invoice.seller,
      buyers: invoice.buyers,
      totals,
      reform: { ...reform(options.professional), invoiceIssuedOn: invoice.issuedOn },
    },
  };
}

export type FacturXCase =
  | { name: string; kind: "invoice"; invoice: InvoiceView }
  | { name: string; kind: "credit_note"; creditNote: CreditNoteView; vatApplicable: boolean };

export function facturXCases(): FacturXCase[] {
  return [
    { name: "acompte-assujetti-particulier", kind: "invoice", invoice: depositInvoiceCase({ vat: true, professional: false }) },
    { name: "acompte-franchise-particulier", kind: "invoice", invoice: depositInvoiceCase({ vat: false, professional: false }) },
    { name: "acompte-assujetti-professionnel", kind: "invoice", invoice: depositInvoiceCase({ vat: true, professional: true }) },
    { name: "solde-assujetti-particulier", kind: "invoice", invoice: balanceInvoiceCase({ vat: true, professional: false }) },
    { name: "solde-assujetti-professionnel", kind: "invoice", invoice: balanceInvoiceCase({ vat: true, professional: true }) },
    { name: "solde-franchise-particulier", kind: "invoice", invoice: balanceInvoiceCase({ vat: false, professional: false }) },
    { name: "solde-franchise-professionnel", kind: "invoice", invoice: balanceInvoiceCase({ vat: false, professional: true, withGlobalDiscount: false }) },
    { name: "solde-arrhes-assujetti", kind: "invoice", invoice: earnestBalanceCase({ vat: true, professional: false }) },
    { name: "acompte-essai-guide", kind: "invoice", invoice: depositInvoiceCase({ vat: true, professional: false, isDemo: true }) },
    { name: "avoir-partiel-assujetti", kind: "credit_note", ...creditNoteCase({ vat: true, professional: true, total: false }) },
    { name: "avoir-total-franchise", kind: "credit_note", ...creditNoteCase({ vat: false, professional: false, total: true }) },
  ];
}
