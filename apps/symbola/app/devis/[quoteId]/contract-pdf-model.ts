// Lot 31b (FAC-04, DOC-03, JUR-07 ; D9, D11, partie N) — contenu du PDF d'un contrat généré, sans
// rendu : titre, articles (clauses figées), régime de conclusion, version et date de revue du
// modèle, bloc de signature quand il part en signature. Et le dossier de preuve, lisible.
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import type { ContractEvidenceDocument, ContractView, SellerSnapshot } from "@/modules/quotes/service";
import { documentAppearance, type DocumentAppearance } from "@/lib/documents/appearance";
import type { QuotePdfLogo } from "./quote-pdf-model";

export type ContractPdfLabels = {
  kind: string;
  subtitle: (contractVersion: number, quoteNumber: string, quoteVersion: number) => string;
  article: (index: number, title: string) => string;
  regimeTitle: string;
  channel: Record<ContractView["conclusionChannel"], string>;
  category: Record<ContractView["clientCategory"], string>;
  withdrawalApplies: (days: number) => string;
  withdrawalNotApplies: string;
  noPaymentBefore: (days: number) => string;
  templateInfo: (version: number, reviewedOn: string | null) => string;
  signatureTitleWithQuote: string;
  signatureTitle: string;
  page: string;
};

export type ContractPdfModel = {
  language: Locale;
  title: string;
  kind: string;
  number: string;
  subtitle: string;
  appearance: DocumentAppearance;
  logo: QuotePdfLogo | null;
  sellerName: string;
  heading: string;
  articles: { heading: string; body: string }[];
  regime: { title: string; lines: string[] };
  template: string;
  page: string;
  watermark: string | null;
  signature: { title: string; slots: { role: string; tag: string }[] } | null;
};

export function buildContractPdfModel(input: {
  quoteNumber: string;
  contract: ContractView;
  seller: SellerSnapshot;
  logo: QuotePdfLogo | null;
  labels: ContractPdfLabels;
  locale: Locale;
  withdrawalDays: number;
  watermark: string | null;
  defaultColor: string;
  // Le PDF qui part en signature : avec le devis (D9) ou seul.
  signatureSlots?: { role: string; tag: string }[];
  withQuote?: boolean;
}): ContractPdfModel {
  const { contract, labels, locale } = input;
  const regime = [
    labels.channel[contract.conclusionChannel],
    labels.category[contract.clientCategory],
    contract.regime.withdrawalApplies ? labels.withdrawalApplies(input.withdrawalDays) : labels.withdrawalNotApplies,
  ];
  if (contract.regime.noPaymentDays !== null) regime.push(labels.noPaymentBefore(contract.regime.noPaymentDays));
  const reviewed = contract.templateReviewedOn ? formatCalendarDate(contract.templateReviewedOn, locale) : null;
  return {
    language: locale,
    title: `${contract.title} — ${input.quoteNumber}`,
    kind: labels.kind,
    number: input.quoteNumber,
    subtitle: labels.subtitle(contract.version, input.quoteNumber, contract.quoteVersion),
    appearance: documentAppearance(input.seller.document?.color, input.seller.document?.font, input.defaultColor),
    logo: input.logo,
    sellerName: input.seller.organizationName,
    heading: contract.title,
    articles: contract.clauses.map((clause, index) => ({ heading: labels.article(index + 1, clause.title), body: clause.body })),
    regime: { title: labels.regimeTitle, lines: regime },
    template: labels.templateInfo(contract.templateVersion, reviewed),
    page: labels.page,
    watermark: input.watermark,
    signature:
      input.signatureSlots && input.signatureSlots.length > 0
        ? { title: input.withQuote ? labels.signatureTitleWithQuote : labels.signatureTitle, slots: input.signatureSlots }
        : null,
  };
}

export type EvidencePdfLabels = {
  title: string;
  intro: string;
  sections: { contract: string; signature: string; signers: string; acts: string; fingerprints: string };
  field: (label: string, value: string) => string;
  names: {
    quote: string;
    contract: string;
    template: string;
    channel: string;
    category: string;
    withdrawal: string;
    level: string;
    generatedAt: string;
    provider: string;
    requestedAt: string;
    completedAt: string;
    signedDocument: string;
    certificate: string;
    evidence: string;
    writtenAt: string;
  };
  channel: ContractPdfLabels["channel"];
  category: ContractPdfLabels["category"];
  yes: string;
  no: string;
  act: Record<"order" | "early_execution", string>;
  signer: (name: string, email: string, signedAt: string | null) => string;
  actLine: (name: string, kind: string, at: string) => string;
  presented: (text: string) => string;
};

export type EvidencePdfModel = { language: Locale; title: string; intro: string; sections: { title: string; lines: string[] }[] };

// Dossier de preuve, lisible : il reprend le JSON scellé et son empreinte, sans rien y ajouter.
export function buildEvidencePdfModel(evidence: ContractEvidenceDocument & { sha256: string }, labels: EvidencePdfLabels, locale: Locale): EvidencePdfModel {
  const at = (iso: string) => formatDateTime(new Date(iso), locale);
  const { names, field } = labels;
  const contract = evidence.contract;
  return {
    language: locale,
    title: labels.title,
    intro: labels.intro,
    sections: [
      {
        title: labels.sections.contract,
        lines: [
          field(names.quote, `${evidence.quote.number} V${evidence.quote.version}`),
          field(names.contract, `${contract.title} V${contract.version}`),
          field(names.template, `${contract.templateVersion}${contract.templateReviewedOn ? ` — ${formatCalendarDate(contract.templateReviewedOn, locale)}` : ""}`),
          field(names.channel, labels.channel[contract.conclusionChannel]),
          field(names.category, labels.category[contract.clientCategory]),
          field(names.withdrawal, contract.withdrawalApplies ? labels.yes : labels.no),
          field(names.level, contract.signatureLevel),
          field(names.generatedAt, at(contract.generatedAt)),
        ],
      },
      {
        title: labels.sections.signature,
        lines: [
          field(names.provider, `${evidence.request.provider} — ${evidence.request.externalId}`),
          field(names.requestedAt, at(evidence.request.createdAt)),
          field(names.completedAt, at(evidence.request.completedAt)),
        ],
      },
      { title: labels.sections.signers, lines: evidence.signers.map((signer) => labels.signer(signer.name, signer.email, signer.signedAt ? at(signer.signedAt) : null)) },
      {
        title: labels.sections.acts,
        lines: evidence.acts.flatMap((act) => [labels.actLine(act.signerName, labels.act[act.kind], at(act.actedAt)), labels.presented(act.presentedText)]),
      },
      {
        title: labels.sections.fingerprints,
        lines: [
          field(names.signedDocument, evidence.documents.signedDocumentSha256),
          field(names.certificate, evidence.documents.auditCertificateSha256),
          field(names.evidence, evidence.sha256),
          field(names.writtenAt, at(evidence.writtenAt)),
        ],
      },
    ],
  };
}
