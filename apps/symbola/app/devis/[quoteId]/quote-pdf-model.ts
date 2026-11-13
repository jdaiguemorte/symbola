// DEV-01, lot 17 (DEV-07 à DEV-12, ADR 0046) — contenu du PDF d'un devis,
// séparé du rendu pour être testé et partagé avec l'aperçu de l'écran
// Documents : en-tête (logo, type, numéro), blocs « De » et « Pour », dates,
// introduction, lignes, totaux, échéancier et IBAN, mentions, conditions
// particulières, pied de page légal ; filigrane sur un devis d'essai.
// Un devis envoyé s'imprime depuis sa copie figée ; un brouillon, depuis les
// réglages courants.
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { DocumentSnapshot, QuoteDetail, QuoteVersionView, SellerSnapshot } from "@/modules/quotes/service";
import { documentAppearance, type DocumentAppearance } from "@/lib/documents/appearance";
import { sellerContactLine, sellerDisplayName, sellerLegalLine, type SellerLegalLabels } from "@/lib/documents/seller-lines";
import { formatRate } from "../quote-display";

export type QuotePdfLogo = { data: Buffer; format: "png" | "jpg" };

// Libellés communs aux devis, factures et avoirs.
export type DocumentCommonLabels = {
  sellerHeading: string;
  clientHeading: string;
  legal: SellerLegalLabels;
  // Gabarit « Page {page} / {total} », complété au rendu de chaque page.
  page: string;
  iban: (iban: string) => string;
  bic: (bic: string) => string;
  columns: { label: string; quantity: string; unitPrice: string; discount: string; vatRate: string; total: string };
  totalHt: string;
  vatAtRate: (rate: string) => string;
  totalTtc: string;
};

export type QuotePdfLabels = DocumentCommonLabels & {
  title: (number: string, version: number) => string;
  kind: string;
  version: (version: number) => string;
  draft: string;
  dates: { issuedOn: string; validUntil: string; eventDate: string };
  scheduleTitle: string;
  paymentTitle: string;
  scheduleLine: (label: string, date: string) => string;
  balance: string;
  subtotal: string;
  globalDiscount: string;
  signatureTitle: string;
  // Lot 31a (FAC-01, JUR-08, JUR-09).
  sectionSubtotal: (title: string) => string;
  optionChosen: string;
  optionNotChosen: string;
  scheduleTitleEarnest: string;
  scheduleTitleDeposit: string;
  insurance: (insurer: string, policy: string, coverage: string | null) => string;
  mediator: (name: string, url: string) => string;
  generalTermsTitle: string;
};

export type PaymentLine = { label: string; amount: string | null };

export type QuotePdfModel = {
  language: Locale;
  // Titre des propriétés du PDF.
  title: string;
  kind: string;
  number: string;
  subtitle: string | null;
  // Brouillon : la mention « non envoyé » (null une fois envoyé).
  status: string | null;
  appearance: DocumentAppearance;
  logo: QuotePdfLogo | null;
  seller: { heading: string; name: string; lines: string[] };
  client: { heading: string; lines: string[] };
  dates: { label: string; value: string }[];
  intro: string | null;
  columns: string[];
  // Lot 31a : une ligne, un titre de section ou le sous-total d'une section.
  rows: { cells: string[]; description: string | null; kind?: "section" | "subtotal" }[];
  // La dernière ligne forte est le bandeau du total.
  totals: { label: string; value: string; strong?: boolean }[];
  // Lignes de l'encadré de paiement, avec un montant aligné à droite ou non.
  payment: { title: string; lines: PaymentLine[] } | null;
  legalMention: string | null;
  terms: string | null;
  // Lot 31a (JUR-09) : assurance et médiateur, puis conditions générales de vente.
  professional: string[];
  generalTerms: { title: string; text: string } | null;
  footer: { text: string | null; legal: string; page: string };
  watermark: string | null;
  // DEV-02 : bloc « Bon pour accord » avec une balise de signature par
  // signataire, seulement dans le PDF envoyé en signature.
  signature: { title: string; slots: { role: string; tag: string }[] } | null;
};

function quantity(milli: number, unit: string, locale: Locale): string {
  return `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 3 }).format(milli / 1000)} ${unit}`;
}

// Affichage par groupes de quatre caractères (FR76 3000 6000 …).
export function groupIban(iban: string): string {
  return iban.replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

export function sellerBlock(seller: SellerSnapshot, labels: DocumentCommonLabels): QuotePdfModel["seller"] {
  return {
    heading: labels.sellerHeading,
    name: sellerDisplayName(seller, labels.legal),
    lines: [seller.address, sellerContactLine(seller)].filter((line): line is string => Boolean(line)),
  };
}

export function documentFooter(seller: SellerSnapshot, labels: DocumentCommonLabels, locale: Locale): QuotePdfModel["footer"] {
  return { text: seller.document?.footer ?? null, legal: sellerLegalLine(seller, labels.legal, locale), page: labels.page };
}

export function bankLines(document: DocumentSnapshot | undefined, labels: DocumentCommonLabels): PaymentLine[] {
  if (!document?.iban) return [];
  return [labels.iban(groupIban(document.iban)), ...(document.bic ? [labels.bic(document.bic)] : [])].map((label) => ({ label, amount: null }));
}

export function appearanceOf(seller: SellerSnapshot, defaultColor: string): DocumentAppearance {
  return documentAppearance(seller.document?.color, seller.document?.font, defaultColor);
}

export function lineCells(
  line: { label: string; quantityMilli: number; unit: string; unitPriceCents: number; discountBasisPoints: number; vatRateBasisPoints: number; netCents: number },
  vat: boolean,
  locale: Locale,
): string[] {
  const cells = [
    line.label,
    quantity(line.quantityMilli, line.unit, locale),
    formatAmount(line.unitPriceCents, locale),
    line.discountBasisPoints > 0 ? `${formatRate(line.discountBasisPoints, locale)} %` : "—",
  ];
  if (vat) cells.push(`${formatRate(line.vatRateBasisPoints, locale)} %`);
  cells.push(formatAmount(line.netCents, locale));
  return cells;
}

export function columnsFor(vat: boolean, labels: DocumentCommonLabels): string[] {
  const columns = [labels.columns.label, labels.columns.quantity, labels.columns.unitPrice, labels.columns.discount];
  if (vat) columns.push(labels.columns.vatRate);
  columns.push(labels.columns.total);
  return columns;
}

// Lot 31a (FAC-01, D2) : lignes hors section, puis chaque section (titre, lignes, sous-total) ;
// une option est marquée retenue ou non retenue (hors du total).
function quoteRows(version: QuoteVersionView, labels: QuotePdfLabels, vat: boolean, locale: Locale): QuotePdfModel["rows"] {
  const width = columnsFor(vat, labels).length;
  const line = (entry: QuoteVersionView["lines"][number]) => {
    const cells = lineCells(entry, vat, locale);
    if (entry.isOption) cells[0] = `${cells[0]} (${entry.optionChosen ? labels.optionChosen : labels.optionNotChosen})`;
    return { cells, description: entry.description };
  };
  const known = new Set(version.sections.map((section) => section.id));
  const rows: QuotePdfModel["rows"] = version.lines.filter((entry) => entry.sectionId === null || !known.has(entry.sectionId)).map(line);
  for (const section of version.sections) {
    const own = version.lines.filter((entry) => entry.sectionId === section.id);
    rows.push({ cells: [section.title], description: null, kind: "section" });
    rows.push(...own.map(line));
    rows.push({ cells: [labels.sectionSubtotal(section.title), ...Array<string>(Math.max(0, width - 2)).fill(""), formatAmount(section.subtotalCents, locale)], description: null, kind: "subtotal" });
  }
  return rows;
}

function professionalLines(seller: SellerSnapshot, labels: QuotePdfLabels): string[] {
  const lines: string[] = [];
  if (seller.insurer && seller.insurancePolicy) lines.push(labels.insurance(seller.insurer, seller.insurancePolicy, seller.insuranceCoverage ?? null));
  if (seller.mediatorName && seller.mediatorUrl) lines.push(labels.mediator(seller.mediatorName, seller.mediatorUrl));
  return lines;
}

export function buildQuotePdfModel(input: {
  quote: QuoteDetail;
  version: QuoteVersionView;
  // Brouillon : vendeur, apparence et mention courants ; envoyé : copies figées.
  draftSeller: SellerSnapshot;
  draftLegalMention: string | null;
  clientNames: string;
  eventDate?: string | null;
  logo: QuotePdfLogo | null;
  labels: QuotePdfLabels;
  locale: Locale;
  watermark: string | null;
  defaultColor: string;
  signatureSlots?: { role: string; tag: string }[];
}): QuotePdfModel {
  const { version, labels, locale } = input;
  const sent = version.sentAt !== null;
  const seller = sent && version.seller ? version.seller : input.draftSeller;
  const document = seller.document;
  const vat = version.vatApplicable;

  const { totals } = version;
  const totalRows: QuotePdfModel["totals"] = [{ label: labels.subtotal, value: formatAmount(totals.subtotalCents, locale) }];
  if (totals.globalDiscountCents > 0) {
    totalRows.push({ label: labels.globalDiscount, value: `− ${formatAmount(totals.globalDiscountCents, locale)}` });
  }
  totalRows.push({ label: labels.totalHt, value: formatAmount(totals.totalHtCents, locale), strong: !vat });
  if (vat) {
    for (const line of totals.vatByRate) {
      totalRows.push({ label: labels.vatAtRate(formatRate(line.rateBasisPoints, locale)), value: formatAmount(line.vatCents, locale) });
    }
    totalRows.push({ label: labels.totalTtc, value: formatAmount(totals.totalTtcCents, locale), strong: true });
  }

  const dates: QuotePdfModel["dates"] = [];
  if (version.sentAt) dates.push({ label: labels.dates.issuedOn, value: formatCalendarDate(version.sentAt.slice(0, 10), locale) });
  if (input.eventDate) dates.push({ label: labels.dates.eventDate, value: formatCalendarDate(input.eventDate, locale) });
  if (version.validUntil) dates.push({ label: labels.dates.validUntil, value: formatCalendarDate(version.validUntil, locale) });

  // DEV-11 : échéancier des acomptes et solde, puis l'IBAN s'il est renseigné.
  const { schedule } = version;
  const scheduleLines: PaymentLine[] = schedule.items.map((item) => ({
    label: labels.scheduleLine(item.label, formatCalendarDate(item.dueDate, locale)),
    amount: formatAmount(item.amountCents, locale),
  }));
  if (scheduleLines.length > 0 && schedule.balanceCents > 0) scheduleLines.push({ label: labels.balance, amount: formatAmount(schedule.balanceCents, locale) });
  const bank = bankLines(document, labels);
  const payment =
    scheduleLines.length > 0
      ? {
          title: version.advanceKind === "earnest" ? labels.scheduleTitleEarnest : version.advanceKind === "deposit" ? labels.scheduleTitleDeposit : labels.scheduleTitle,
          lines: [...scheduleLines, ...bank],
        }
      : bank.length > 0
        ? { title: labels.paymentTitle, lines: bank }
        : null;

  return {
    language: locale,
    title: labels.title(input.quote.number, version.version),
    kind: labels.kind,
    number: input.quote.number,
    subtitle: [labels.version(version.version), sent ? null : labels.draft].filter(Boolean).join(" · "),
    status: sent ? null : labels.draft,
    appearance: appearanceOf(seller, input.defaultColor),
    logo: input.logo,
    seller: sellerBlock(seller, labels),
    client: { heading: labels.clientHeading, lines: [input.clientNames] },
    dates,
    intro: document?.intro ?? null,
    columns: columnsFor(vat, labels),
    rows: quoteRows(version, labels, vat, locale),
    totals: totalRows,
    payment,
    legalMention: sent ? version.legalMention : input.draftLegalMention,
    terms: document?.terms ?? null,
    professional: professionalLines(seller, labels),
    generalTerms: seller.generalTerms ? { title: labels.generalTermsTitle, text: seller.generalTerms } : null,
    footer: documentFooter(seller, labels, locale),
    watermark: input.watermark,
    signature: input.signatureSlots && input.signatureSlots.length > 0 ? { title: labels.signatureTitle, slots: input.signatureSlots } : null,
  };
}
