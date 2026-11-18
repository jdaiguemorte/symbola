// Lot 41 (FAC-10, D2, ADR 0079) — le fichier structuré d'un Factur-X : syntaxe CII
// (CrossIndustryInvoice D16B), profil EN 16931. Écrit sans bibliothèque, par gabarits, chaque texte
// échappé ; une seconde fonction relit les montants du XML produit pour les comparer, au centime, à
// ceux du PDF (réponse 10 de l'expert-comptable). Fonctions pures, testées ; l'ordre des éléments
// suit le schéma XSD du profil, que Mustang contrôle en CI (D4, ADR 0080).
//
// Montants en centimes entiers, écrits avec deux décimales ; quantités en millièmes, trois
// décimales ; taux en points de base, deux décimales. Jamais de nombre à virgule flottante.

export type FxAddress = { line: string | null; postalCode: string | null; city: string | null; countryCode: string };
export type FxParty = {
  name: string;
  // SIREN (schéma 0002 de l'ISO 6523), numéro de TVA (« VA »), identifiant fiscal (« FC »).
  siren: string | null;
  vatNumber: string | null;
  fiscalId: string | null;
  address: FxAddress;
};
export type FxVatCategory = "S" | "E";
export type FxLine = {
  id: string;
  name: string;
  description: string | null;
  // Négative pour un acompte déduit d'une facture de solde (prix toujours positif, BR-27).
  quantityMilli: number;
  unitPriceCents: number;
  allowanceCents: number;
  netCents: number;
  category: FxVatCategory;
  rateBasisPoints: number;
};
export type FxAllowance = { amountCents: number; reason: string; category: FxVatCategory; rateBasisPoints: number };
export type FxVatBreakdown = {
  category: FxVatCategory;
  rateBasisPoints: number;
  baseCents: number;
  vatCents: number;
  exemptionReason: string | null;
  exemptionCode: string | null;
};
export type FxNote = { text: string; subject: "AAB" | "PMD" | "PMT" | "REG" | "AAI" | null };
export type FacturXDocument = {
  number: string;
  // Motif des remises de ligne (BT-140).
  lineAllowanceReason: string;
  // 380 facture, 386 facture d'acompte, 381 avoir (EC-1).
  typeCode: "380" | "386" | "381";
  issuedOn: string;
  // Cadre de facturation de la spécification française : S1 services, B1 biens, M1 mixte (EC-2).
  businessProcess: "S1" | "B1" | "M1";
  notes: FxNote[];
  seller: FxParty;
  buyer: FxParty;
  buyerReference: string | null;
  orderReference: string | null;
  delivery: { address: FxAddress | null; date: string | null };
  paymentReference: string;
  iban: string | null;
  bic: string | null;
  paymentTerms: string | null;
  dueOn: string | null;
  lines: FxLine[];
  allowances: FxAllowance[];
  vat: FxVatBreakdown[];
  // TVA exigible sur les débits (code 5, date de la facture ; EC-3).
  vatDueOnInvoiceDate: boolean;
  prepaidCents: number;
  precedingInvoice: { number: string; issuedOn: string } | null;
};

export type FxTotals = {
  lineTotalCents: number;
  allowanceTotalCents: number;
  taxBasisCents: number;
  taxTotalCents: number;
  grandTotalCents: number;
  prepaidCents: number;
  duePayableCents: number;
  vat: { category: string; rateBasisPoints: number; baseCents: number; vatCents: number }[];
};

// --- Écriture ---

// Caractères interdits par XML 1.0 (contrôles, demi-codets isolés, U+FFFE et U+FFFF).
const XML_FORBIDDEN = new RegExp("[^\\t\\n\\r\\u0020-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]", "gu");

// Échappement XML de tout texte venu d'une saisie (bon de commande, libellés…), et retrait des
// caractères interdits par XML 1.0.
export function escapeXml(value: string): string {
  return value
    .replace(XML_FORBIDDEN, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decimal(value: number, scale: number): string {
  if (!Number.isInteger(value)) throw new RangeError("montant non entier");
  const negative = value < 0;
  const digits = String(Math.abs(value)).padStart(scale + 1, "0");
  const text = `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  return negative ? `-${text}` : text;
}

export const amount = (cents: number) => decimal(cents, 2);
const quantity = (milli: number) => decimal(milli, 3);
const percent = (basisPoints: number) => decimal(basisPoints, 2);
const date102 = (isoDate: string) => isoDate.replaceAll("-", "");

function element(name: string, content: string | null | undefined, attributes = ""): string {
  if (content === null || content === undefined || content === "") return "";
  return `<${name}${attributes}>${content}</${name}>`;
}

const text = (name: string, value: string | null | undefined) => element(name, value ? escapeXml(value) : null);

function address(value: FxAddress): string {
  return element(
    "ram:PostalTradeAddress",
    [text("ram:PostcodeCode", value.postalCode), text("ram:LineOne", value.line), text("ram:CityName", value.city), text("ram:CountryID", value.countryCode)].join(""),
  );
}

function party(name: string, value: FxParty): string {
  const legal = value.siren ? element("ram:SpecifiedLegalOrganization", element("ram:ID", escapeXml(value.siren), ' schemeID="0002"')) : "";
  const registrations = [
    value.vatNumber ? element("ram:SpecifiedTaxRegistration", element("ram:ID", escapeXml(value.vatNumber), ' schemeID="VA"')) : "",
    value.fiscalId ? element("ram:SpecifiedTaxRegistration", element("ram:ID", escapeXml(value.fiscalId), ' schemeID="FC"')) : "",
  ].join("");
  return element(name, [text("ram:Name", value.name), legal, address(value.address), registrations].join(""));
}

function dateTime(name: string, isoDate: string, qualified = false): string {
  const prefix = qualified ? "qdt" : "udt";
  return element(name, element(`${prefix}:DateTimeString`, date102(isoDate), ' format="102"'));
}

function tradeTax(category: FxVatCategory, rateBasisPoints: number): string {
  return [element("ram:TypeCode", "VAT"), element("ram:CategoryCode", category), element("ram:RateApplicablePercent", percent(rateBasisPoints))].join("");
}

function line(value: FxLine, allowanceReason: string): string {
  const allowance =
    value.allowanceCents > 0
      ? element(
          "ram:SpecifiedTradeAllowanceCharge",
          [element("ram:ChargeIndicator", element("udt:Indicator", "false")), element("ram:ActualAmount", amount(value.allowanceCents)), text("ram:Reason", allowanceReason)].join(""),
        )
      : "";
  return element(
    "ram:IncludedSupplyChainTradeLineItem",
    [
      element("ram:AssociatedDocumentLineDocument", element("ram:LineID", escapeXml(value.id))),
      element("ram:SpecifiedTradeProduct", [text("ram:Name", value.name), text("ram:Description", value.description)].join("")),
      element("ram:SpecifiedLineTradeAgreement", element("ram:NetPriceProductTradePrice", element("ram:ChargeAmount", amount(value.unitPriceCents)))),
      element("ram:SpecifiedLineTradeDelivery", element("ram:BilledQuantity", quantity(value.quantityMilli), ' unitCode="C62"')),
      element(
        "ram:SpecifiedLineTradeSettlement",
        [
          element("ram:ApplicableTradeTax", tradeTax(value.category, value.rateBasisPoints)),
          allowance,
          element("ram:SpecifiedTradeSettlementLineMonetarySummation", element("ram:LineTotalAmount", amount(value.netCents))),
        ].join(""),
      ),
    ].join(""),
  );
}

export function facturXTotals(document: FacturXDocument): FxTotals {
  const lineTotalCents = document.lines.reduce((sum, item) => sum + item.netCents, 0);
  const allowanceTotalCents = document.allowances.reduce((sum, item) => sum + item.amountCents, 0);
  const taxTotalCents = document.vat.reduce((sum, item) => sum + item.vatCents, 0);
  const taxBasisCents = lineTotalCents - allowanceTotalCents;
  const grandTotalCents = taxBasisCents + taxTotalCents;
  return {
    lineTotalCents,
    allowanceTotalCents,
    taxBasisCents,
    taxTotalCents,
    grandTotalCents,
    prepaidCents: document.prepaidCents,
    duePayableCents: grandTotalCents - document.prepaidCents,
    vat: document.vat.map((item) => ({ category: item.category, rateBasisPoints: item.rateBasisPoints, baseCents: item.baseCents, vatCents: item.vatCents })),
  };
}

export function buildCii(document: FacturXDocument): string {
  const totals = facturXTotals(document);
  const notes = document.notes
    .filter((note) => note.text.trim() !== "")
    .map((note) => element("ram:IncludedNote", [text("ram:Content", note.text), element("ram:SubjectCode", note.subject)].join("")))
    .join("");
  const agreement = element(
    "ram:ApplicableHeaderTradeAgreement",
    [
      text("ram:BuyerReference", document.buyerReference),
      party("ram:SellerTradeParty", document.seller),
      party("ram:BuyerTradeParty", document.buyer),
      document.orderReference ? element("ram:BuyerOrderReferencedDocument", text("ram:IssuerAssignedID", document.orderReference)) : "",
    ].join(""),
  );
  const delivery = element(
    "ram:ApplicableHeaderTradeDelivery",
    [
      document.delivery.address ? element("ram:ShipToTradeParty", address(document.delivery.address)) : "",
      document.delivery.date ? element("ram:ActualDeliverySupplyChainEvent", dateTime("ram:OccurrenceDateTime", document.delivery.date)) : "",
    ].join(""),
  ) || "<ram:ApplicableHeaderTradeDelivery/>";
  const paymentMeans = document.iban
    ? element(
        "ram:SpecifiedTradeSettlementPaymentMeans",
        [
          element("ram:TypeCode", "58"),
          element("ram:PayeePartyCreditorFinancialAccount", text("ram:IBANID", document.iban.replace(/\s/g, ""))),
          document.bic ? element("ram:PayeeSpecifiedCreditorFinancialInstitution", text("ram:BICID", document.bic.replace(/\s/g, ""))) : "",
        ].join(""),
      )
    : "";
  const taxes = document.vat
    .map((item) =>
      element(
        "ram:ApplicableTradeTax",
        [
          element("ram:CalculatedAmount", amount(item.vatCents)),
          element("ram:TypeCode", "VAT"),
          text("ram:ExemptionReason", item.exemptionReason),
          element("ram:BasisAmount", amount(item.baseCents)),
          element("ram:CategoryCode", item.category),
          text("ram:ExemptionReasonCode", item.exemptionCode),
          document.vatDueOnInvoiceDate && item.category === "S" ? element("ram:DueDateTypeCode", "5") : "",
          element("ram:RateApplicablePercent", percent(item.rateBasisPoints)),
        ].join(""),
      ),
    )
    .join("");
  const allowances = document.allowances
    .map((item) =>
      element(
        "ram:SpecifiedTradeAllowanceCharge",
        [
          element("ram:ChargeIndicator", element("udt:Indicator", "false")),
          element("ram:ActualAmount", amount(item.amountCents)),
          text("ram:Reason", item.reason),
          element("ram:CategoryTradeTax", tradeTax(item.category, item.rateBasisPoints)),
        ].join(""),
      ),
    )
    .join("");
  const terms =
    document.paymentTerms || document.dueOn
      ? element("ram:SpecifiedTradePaymentTerms", [text("ram:Description", document.paymentTerms), document.dueOn ? dateTime("ram:DueDateDateTime", document.dueOn) : ""].join(""))
      : "";
  const summation = element(
    "ram:SpecifiedTradeSettlementHeaderMonetarySummation",
    [
      element("ram:LineTotalAmount", amount(totals.lineTotalCents)),
      element("ram:ChargeTotalAmount", amount(0)),
      element("ram:AllowanceTotalAmount", amount(totals.allowanceTotalCents)),
      element("ram:TaxBasisTotalAmount", amount(totals.taxBasisCents)),
      element("ram:TaxTotalAmount", amount(totals.taxTotalCents), ' currencyID="EUR"'),
      element("ram:GrandTotalAmount", amount(totals.grandTotalCents)),
      element("ram:TotalPrepaidAmount", amount(totals.prepaidCents)),
      element("ram:DuePayableAmount", amount(totals.duePayableCents)),
    ].join(""),
  );
  const preceding = document.precedingInvoice
    ? element(
        "ram:InvoiceReferencedDocument",
        [text("ram:IssuerAssignedID", document.precedingInvoice.number), dateTime("ram:FormattedIssueDateTime", document.precedingInvoice.issuedOn, true)].join(""),
      )
    : "";
  const settlement = element(
    "ram:ApplicableHeaderTradeSettlement",
    [text("ram:PaymentReference", document.paymentReference), element("ram:InvoiceCurrencyCode", "EUR"), paymentMeans, taxes, allowances, terms, summation, preceding].join(""),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">`,
    element(
      "rsm:ExchangedDocumentContext",
      [
        element("ram:BusinessProcessSpecifiedDocumentContextParameter", element("ram:ID", document.businessProcess)),
        element("ram:GuidelineSpecifiedDocumentContextParameter", element("ram:ID", "urn:cen.eu:en16931:2017")),
      ].join(""),
    ),
    element(
      "rsm:ExchangedDocument",
      [text("ram:ID", document.number), element("ram:TypeCode", document.typeCode), dateTime("ram:IssueDateTime", document.issuedOn), notes].join(""),
    ),
    element("rsm:SupplyChainTradeTransaction", [document.lines.map((item) => line(item, document.lineAllowanceReason)).join(""), agreement, delivery, settlement].join("")),
    `</rsm:CrossIndustryInvoice>`,
    "",
  ].join("\n");
}

// --- Relecture ---

function readAmount(value: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`montant illisible : ${value}`);
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -cents : cents;
}

function first(xml: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(xml);
  if (!match) throw new RangeError(`élément absent : ${name}`);
  return match[1] ?? "";
}

// Les montants que porte le XML, relus depuis le texte produit (pas depuis le modèle) : c'est ce
// qu'une plateforme lira.
export function readCiiTotals(xml: string): FxTotals {
  const summation = /<ram:SpecifiedTradeSettlementHeaderMonetarySummation>([\s\S]*?)<\/ram:SpecifiedTradeSettlementHeaderMonetarySummation>/.exec(xml)?.[1];
  if (!summation) throw new RangeError("totaux absents");
  const settlement = /<ram:ApplicableHeaderTradeSettlement>([\s\S]*)<\/ram:ApplicableHeaderTradeSettlement>/.exec(xml)?.[1] ?? "";
  const vat = [...settlement.matchAll(/<ram:ApplicableTradeTax>([\s\S]*?)<\/ram:ApplicableTradeTax>/g)].map((match) => {
    const block = match[1] ?? "";
    return {
      category: first(block, "ram:CategoryCode"),
      rateBasisPoints: readAmount(first(block, "ram:RateApplicablePercent")),
      baseCents: readAmount(first(block, "ram:BasisAmount")),
      vatCents: readAmount(first(block, "ram:CalculatedAmount")),
    };
  });
  return {
    lineTotalCents: readAmount(first(summation, "ram:LineTotalAmount")),
    allowanceTotalCents: readAmount(first(summation, "ram:AllowanceTotalAmount")),
    taxBasisCents: readAmount(first(summation, "ram:TaxBasisTotalAmount")),
    taxTotalCents: readAmount(first(summation, "ram:TaxTotalAmount")),
    grandTotalCents: readAmount(first(summation, "ram:GrandTotalAmount")),
    prepaidCents: readAmount(first(summation, "ram:TotalPrepaidAmount")),
    duePayableCents: readAmount(first(summation, "ram:DuePayableAmount")),
    vat,
  };
}
