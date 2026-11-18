// Lot 41 (FAC-10, JUR-02, JUR-12, JUR-13 ; D1, D2, D6 à D11) — du modèle figé d'une pièce émise
// (InvoiceView, CreditNoteView : les mêmes copies que le PDF) au modèle du fichier structuré.
// Fonctions pures ; les textes (libellés, conditions, mentions) sont donnés par l'appelant dans la
// langue de la pièce. Points à confirmer par l'expert-comptable (fiche, questions 12 à 18) :
// codes de type (EC-1), cadre de facturation (EC-2), débits (EC-3), acomptes déduits par lignes
// négatives (EC-4, défaut prudent : comme le PDF depuis le lot 31c), franchise (EC-6).
import type { CreditNoteView, InvoiceBuyer, InvoiceTotalsView, InvoiceView, OperationCategory, SellerSnapshot } from "@symbola/contracts";
import { lineAmounts } from "../amounts";
import { buildCii, facturXTotals, readCiiTotals, type FacturXDocument, type FxLine, type FxParty, type FxTotals, type FxVatBreakdown } from "./cii";

export type FacturXTexts = {
  depositLine: (label: string, quoteNumber: string) => string;
  deductionLine: (invoiceNumber: string) => string;
  creditNoteLine: (invoiceNumber: string) => string;
  globalDiscount: string;
  lineDiscount: string;
  // Conditions de paiement (BT-20), phrase des pénalités, escompte, mention de l'option sur les débits.
  paymentTerms: string | null;
  penalties: string | null;
  recovery: string | null;
  discount: string | null;
  vatOnDebits: string | null;
  // Mention de franchise (art. 293 B du CGI), motif d'exonération du fichier.
  franchiseReason: string;
};

// Code de motif d'exonération de la franchise en base (liste VATEX ; à confirmer, EC-6).
export const FRANCHISE_EXEMPTION_CODE = "VATEX-FR-FRANCHISE";
const DEFAULT_COUNTRY = "FR";

const BUSINESS_PROCESS: Record<OperationCategory, FacturXDocument["businessProcess"]> = { services: "S1", goods: "B1", mixed: "M1" };
const businessProcessOf = (category: OperationCategory | undefined): FacturXDocument["businessProcess"] => BUSINESS_PROCESS[category ?? "services"] ?? "S1";

export class FacturXTotalsMismatchError extends Error {
  constructor(readonly field: string) {
    super(`totaux du fichier structuré différents de ceux du PDF : ${field}`);
    this.name = "FacturXTotalsMismatchError";
  }
}

function sirenOf(seller: Pick<SellerSnapshot, "siren" | "siret">): string | null {
  const value = seller.siren?.replace(/\s/g, "") || seller.siret?.replace(/\s/g, "").slice(0, 9) || null;
  return value || null;
}

function sellerParty(seller: SellerSnapshot, vatApplicable: boolean): FxParty {
  const siren = sirenOf(seller);
  const vatNumber = seller.vatNumber?.replace(/\s/g, "") || null;
  return {
    name: seller.organizationName,
    siren,
    vatNumber,
    // Franchise sans numéro de TVA : l'identifiant fiscal exigé par la règle BR-E-02 (EC-6).
    fiscalId: !vatApplicable && !vatNumber ? siren : null,
    address: { line: seller.address ?? null, postalCode: seller.postalCode ?? null, city: seller.city ?? null, countryCode: seller.countryCode ?? DEFAULT_COUNTRY },
  };
}

function buyerParty(buyers: InvoiceBuyer[]): FxParty {
  const company = buyers.find((buyer) => buyer.kind === "company");
  if (company) {
    return {
      name: company.name,
      siren: company.siren ?? null,
      vatNumber: company.vatNumber ?? null,
      fiscalId: null,
      address: company.address
        ? { line: company.address.line, postalCode: company.address.postalCode, city: company.address.city, countryCode: company.address.countryCode }
        : { line: company.billingAddress || null, postalCode: null, city: null, countryCode: DEFAULT_COUNTRY },
    };
  }
  // Particuliers : leurs noms, l'adresse de facturation saisie (texte libre) en première ligne.
  return {
    name: buyers.map((buyer) => buyer.name).join(", "),
    siren: null,
    vatNumber: null,
    fiscalId: null,
    address: { line: buyers.find((buyer) => buyer.billingAddress)?.billingAddress ?? null, postalCode: null, city: null, countryCode: DEFAULT_COUNTRY },
  };
}

function breakdown(totals: InvoiceTotalsView, vatApplicable: boolean, texts: FacturXTexts): FxVatBreakdown[] {
  if (!vatApplicable) {
    return [{ category: "E", rateBasisPoints: 0, baseCents: totals.totalHtCents, vatCents: 0, exemptionReason: texts.franchiseReason, exemptionCode: FRANCHISE_EXEMPTION_CODE }];
  }
  return totals.vatByRate.map((line) => ({ category: "S", rateBasisPoints: line.rateBasisPoints, baseCents: line.baseCents, vatCents: line.vatCents, exemptionReason: null, exemptionCode: null }));
}

// Une ligne par taux pour un montant déjà ventilé (acompte, avoir, acompte déduit).
function linesByRate(totals: InvoiceTotalsView, vatApplicable: boolean, name: string, sign: 1 | -1, firstId: number): FxLine[] {
  const parts = vatApplicable ? totals.vatByRate.map((line) => ({ rate: line.rateBasisPoints, base: line.baseCents })) : [{ rate: 0, base: totals.totalHtCents }];
  return parts
    .filter((part) => part.base !== 0)
    .map((part, index) => ({
      id: String(firstId + index),
      name,
      description: null,
      quantityMilli: 1000 * sign,
      unitPriceCents: part.base,
      allowanceCents: 0,
      netCents: part.base * sign,
      category: vatApplicable ? "S" : "E",
      rateBasisPoints: part.rate,
    }));
}

function notes(texts: FacturXTexts, extra: (string | null)[]): FacturXDocument["notes"] {
  return [
    ...extra.filter((value): value is string => Boolean(value)).map((value) => ({ text: value, subject: null })),
    ...(texts.vatOnDebits ? [{ text: texts.vatOnDebits, subject: "REG" as const }] : []),
    ...(texts.penalties ? [{ text: texts.penalties, subject: "PMD" as const }] : []),
    ...(texts.recovery ? [{ text: texts.recovery, subject: "PMT" as const }] : []),
    ...(texts.discount ? [{ text: texts.discount, subject: "AAB" as const }] : []),
  ];
}

export function invoiceFacturX(invoice: InvoiceView, texts: FacturXTexts): FacturXDocument {
  const vat = invoice.vatApplicable;
  const reform = invoice.reform;
  const category = vat ? "S" : "E";
  let lines: FxLine[];
  const allowances: FacturXDocument["allowances"] = [];
  if (invoice.kind === "deposit") {
    lines = linesByRate(invoice.totals, vat, texts.depositLine(invoice.depositLabel ?? "", invoice.quoteNumber), 1, 1);
  } else {
    lines = invoice.lines.map((line, index) => {
      const { grossCents, netCents } = lineAmounts(line);
      const priceCents = line.unitPriceCents;
      return {
        id: String(index + 1),
        name: line.label,
        description: line.description,
        quantityMilli: line.quantityMilli,
        unitPriceCents: priceCents,
        allowanceCents: grossCents - netCents,
        netCents: line.netCents,
        category,
        rateBasisPoints: vat ? line.vatRateBasisPoints : 0,
      };
    });
    // Remise globale du devis, répartie entre les taux comme au total du devis (ADR 0059).
    if (invoice.quoteTotals.globalDiscountCents > 0) {
      if (vat) {
        for (const rate of invoice.quoteTotals.vatByRate) {
          const linesAtRate = lines.filter((line) => line.rateBasisPoints === rate.rateBasisPoints).reduce((sum, line) => sum + line.netCents, 0);
          const share = linesAtRate - rate.baseCents;
          if (share > 0) allowances.push({ amountCents: share, reason: texts.globalDiscount, category: "S", rateBasisPoints: rate.rateBasisPoints });
        }
      } else {
        allowances.push({ amountCents: invoice.quoteTotals.globalDiscountCents, reason: texts.globalDiscount, category: "E", rateBasisPoints: 0 });
      }
    }
    // Acomptes déjà facturés, déduits taux par taux (EC-4 : comme le PDF depuis le lot 31c).
    for (const deduction of invoice.deductions) {
      const deducted = deduction.totals ?? { totalHtCents: deduction.amountCents, vatByRate: [], totalVatCents: 0, totalTtcCents: deduction.amountCents };
      lines = [...lines, ...linesByRate(deducted, vat, texts.deductionLine(deduction.number), -1, lines.length + 1)];
    }
  }
  return {
    number: invoice.number,
    lineAllowanceReason: texts.lineDiscount,
    typeCode: invoice.kind === "deposit" ? "386" : "380",
    issuedOn: invoice.issuedOn,
    businessProcess: businessProcessOf(reform?.category),
    notes: notes(texts, []),
    seller: sellerParty(invoice.seller, vat),
    buyer: buyerParty(invoice.buyers),
    buyerReference: reform?.buyerReference ?? null,
    orderReference: reform?.orderReference ?? null,
    delivery: { address: reform?.deliveryAddress ?? null, date: invoice.kind === "balance" ? invoice.serviceDate : null },
    paymentReference: invoice.number,
    iban: invoice.seller.document?.iban ?? null,
    bic: invoice.seller.document?.bic ?? null,
    paymentTerms: texts.paymentTerms,
    dueOn: invoice.paymentDueOn,
    lines,
    allowances,
    vat: breakdown(invoice.totals, vat, texts),
    vatDueOnInvoiceDate: Boolean(reform?.vatOnDebits) && vat,
    prepaidCents: invoice.settlements.reduce((sum, settlement) => sum + settlement.amountCents, 0),
    precedingInvoice: null,
  };
}

export function creditNoteFacturX(creditNote: CreditNoteView, vatApplicable: boolean, texts: FacturXTexts): FacturXDocument {
  const reform = creditNote.reform;
  return {
    number: creditNote.number,
    lineAllowanceReason: texts.lineDiscount,
    typeCode: "381",
    issuedOn: creditNote.issuedOn,
    businessProcess: businessProcessOf(reform?.category),
    notes: notes(texts, [creditNote.reason]),
    seller: sellerParty(creditNote.seller, vatApplicable),
    buyer: buyerParty(creditNote.buyers),
    buyerReference: reform?.buyerReference ?? null,
    orderReference: reform?.orderReference ?? null,
    delivery: { address: reform?.deliveryAddress ?? null, date: null },
    paymentReference: creditNote.number,
    iban: null,
    bic: null,
    paymentTerms: null,
    dueOn: creditNote.issuedOn,
    lines: linesByRate(creditNote.totals, vatApplicable, texts.creditNoteLine(creditNote.invoiceNumber), 1, 1),
    allowances: [],
    vat: breakdown(creditNote.totals, vatApplicable, texts),
    vatDueOnInvoiceDate: Boolean(reform?.vatOnDebits) && vatApplicable,
    prepaidCents: 0,
    precedingInvoice: reform?.invoiceIssuedOn ? { number: creditNote.invoiceNumber, issuedOn: reform.invoiceIssuedOn } : null,
  };
}

// Ce que le PDF imprime (mêmes copies figées) : total HT, TVA par taux, TTC, reste à payer.
export type PrintedAmounts = { totalHtCents: number; totalVatCents: number; totalTtcCents: number; amountDueCents: number; vatByRate: { rateBasisPoints: number; baseCents: number; vatCents: number }[] };

export function printedInvoiceAmounts(invoice: InvoiceView): PrintedAmounts {
  return {
    totalHtCents: invoice.totals.totalHtCents,
    totalVatCents: invoice.totals.totalVatCents,
    totalTtcCents: invoice.totals.totalTtcCents,
    amountDueCents: invoice.amountDueCents,
    vatByRate: invoice.vatApplicable ? invoice.totals.vatByRate : [],
  };
}

export function printedCreditNoteAmounts(creditNote: CreditNoteView, vatApplicable: boolean): PrintedAmounts {
  return {
    totalHtCents: creditNote.totals.totalHtCents,
    totalVatCents: creditNote.totals.totalVatCents,
    totalTtcCents: creditNote.totals.totalTtcCents,
    amountDueCents: creditNote.amountCents,
    vatByRate: vatApplicable ? creditNote.totals.vatByRate : [],
  };
}

// Réponse 10 de l'expert-comptable : les totaux relus du XML égalent ceux du PDF, au centime ; sinon
// l'émission s'arrête (dans la transaction du numéro, qui n'est donc pas consommé).
export function assertSameTotals(xmlTotals: FxTotals, printed: PrintedAmounts): void {
  const checks: [string, number, number][] = [
    ["TaxBasisTotalAmount", xmlTotals.taxBasisCents, printed.totalHtCents],
    ["TaxTotalAmount", xmlTotals.taxTotalCents, printed.totalVatCents],
    ["GrandTotalAmount", xmlTotals.grandTotalCents, printed.totalTtcCents],
    ["DuePayableAmount", xmlTotals.duePayableCents, printed.amountDueCents],
    ["LineTotalAmount", xmlTotals.lineTotalCents - xmlTotals.allowanceTotalCents, printed.totalHtCents],
  ];
  for (const [field, actual, expected] of checks) if (actual !== expected) throw new FacturXTotalsMismatchError(field);
  for (const rate of printed.vatByRate) {
    const found = xmlTotals.vat.find((line) => line.category === "S" && line.rateBasisPoints === rate.rateBasisPoints);
    if (!found || found.baseCents !== rate.baseCents || found.vatCents !== rate.vatCents) throw new FacturXTotalsMismatchError(`ApplicableTradeTax ${rate.rateBasisPoints}`);
  }
  if (printed.vatByRate.length > 0 && xmlTotals.vat.length !== printed.vatByRate.length) throw new FacturXTotalsMismatchError("ApplicableTradeTax");
}

// Le XML d'une pièce et le contrôle de ses totaux, relus du texte produit.
export function checkedCii(document: FacturXDocument, printed: PrintedAmounts): { xml: string; totals: FxTotals } {
  const xml = buildCii(document);
  const totals = readCiiTotals(xml);
  // Le modèle et sa relecture concordent (aucun montant perdu à l'écriture).
  const modelTotals = facturXTotals(document);
  if (modelTotals.grandTotalCents !== totals.grandTotalCents) throw new FacturXTotalsMismatchError("relecture");
  assertSameTotals(totals, printed);
  return { xml, totals };
}
