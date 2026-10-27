// DEV-01 — contenu du PDF d'un devis, séparé du rendu pour être testé :
// en-tête vendeur (logo, coordonnées, SIREN), numéro et version, validité,
// lignes, totaux, mention légale ; filigrane sur un devis d'essai.
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { QuoteDetail, QuoteVersionView, SellerSnapshot } from "@/modules/quotes/service";
import { formatRate } from "../quote-display";

export type QuotePdfLogo = { data: Buffer; format: "png" | "jpg" };

export type QuotePdfLabels = {
  title: (number: string, version: number) => string;
  draft: string;
  issuedOn: (date: string) => string;
  validUntil: (date: string) => string;
  siren: (siren: string) => string;
  client: (names: string) => string;
  columns: { label: string; quantity: string; unitPrice: string; discount: string; vatRate: string; total: string };
  subtotal: string;
  globalDiscount: string;
  totalHt: string;
  vatAtRate: (rate: string) => string;
  totalTtc: string;
  signatureTitle: string;
};

export type QuotePdfModel = {
  language: Locale;
  title: string;
  status: string | null;
  seller: { name: string; lines: string[] };
  logo: QuotePdfLogo | null;
  client: string;
  dates: string[];
  columns: string[];
  rows: { cells: string[]; description: string | null }[];
  totals: { label: string; value: string; strong?: boolean }[];
  legalMention: string | null;
  watermark: string | null;
  // DEV-02 : bloc « Bon pour accord » avec une balise de signature par
  // signataire, seulement dans le PDF envoyé en signature.
  signature: { title: string; slots: { role: string; tag: string }[] } | null;
};

function quantity(milli: number, unit: string, locale: Locale): string {
  return `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 3 }).format(milli / 1000)} ${unit}`;
}

export function buildQuotePdfModel(input: {
  quote: QuoteDetail;
  version: QuoteVersionView;
  // Brouillon : en-tête et mention courants ; envoyé : copies figées.
  draftSeller: SellerSnapshot;
  draftLegalMention: string | null;
  clientNames: string;
  logo: QuotePdfLogo | null;
  labels: QuotePdfLabels;
  locale: Locale;
  watermark: string | null;
  signatureSlots?: { role: string; tag: string }[];
}): QuotePdfModel {
  const { version, labels, locale } = input;
  const sent = version.sentAt !== null;
  const seller = sent && version.seller ? version.seller : input.draftSeller;
  const vat = version.vatApplicable;

  const columns = [labels.columns.label, labels.columns.quantity, labels.columns.unitPrice, labels.columns.discount];
  if (vat) columns.push(labels.columns.vatRate);
  columns.push(labels.columns.total);

  const rows = version.lines.map((line) => {
    const cells = [
      line.label,
      quantity(line.quantityMilli, line.unit, locale),
      formatAmount(line.unitPriceCents, locale),
      line.discountBasisPoints > 0 ? `${formatRate(line.discountBasisPoints, locale)} %` : "—",
    ];
    if (vat) cells.push(`${formatRate(line.vatRateBasisPoints, locale)} %`);
    cells.push(formatAmount(line.netCents, locale));
    return { cells, description: line.description };
  });

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

  const dates: string[] = [];
  if (version.sentAt) dates.push(labels.issuedOn(formatCalendarDate(version.sentAt.slice(0, 10), locale)));
  if (version.validUntil) dates.push(labels.validUntil(formatCalendarDate(version.validUntil, locale)));

  return {
    language: locale,
    title: labels.title(input.quote.number, version.version),
    status: sent ? null : labels.draft,
    seller: {
      name: seller.organizationName,
      lines: [seller.address, seller.siren ? labels.siren(seller.siren) : null].filter((line): line is string => Boolean(line)),
    },
    logo: input.logo,
    client: labels.client(input.clientNames),
    dates,
    columns,
    rows,
    totals: totalRows,
    legalMention: sent ? version.legalMention : input.draftLegalMention,
    watermark: input.watermark,
    signature: input.signatureSlots && input.signatureSlots.length > 0 ? { title: labels.signatureTitle, slots: input.signatureSlots } : null,
  };
}
