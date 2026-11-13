// Lot 31b (FAC-04, DOC-03 ; D9, partie N) — production des PDF du contrat : seul (téléchargement,
// signature du contrat seul), à la suite du devis (un envoi, une signature), et du dossier de
// preuve lisible. L'appelant a déjà vérifié la session et l'organisation, ou le lien du client.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { starterContractRules, starterDocumentStyle } from "@symbola/starter-templates";
import { currentQuoteSeller, type ContractEvidenceDocument, type ContractView, type QuoteDetail } from "@/modules/quotes/service";
import { loadDocumentLogo } from "@/lib/document-logo";
import { pdfSafe } from "@/lib/pdf-text";
import { contractPdfLabels, evidencePdfLabels, type Translate } from "../document-labels";
import { ContractPdfDocument, EvidencePdfDocument, QuoteAndContractPdfDocument } from "./contract-pdf";
import { buildContractPdfModel, buildEvidencePdfModel, type ContractPdfModel } from "./contract-pdf-model";
import { quotePdfModelFor } from "./render-quote-pdf";

async function contractModel(input: {
  organizationId: string;
  quote: QuoteDetail;
  contract: ContractView;
  signatureSlots?: { role: string; tag: string }[];
  withQuote?: boolean;
}): Promise<ContractPdfModel> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Contracts");
  const tDocuments = await getTranslations("Documents");
  const tQuotes = await getTranslations("Quotes");
  const version = input.quote.versions.find((candidate) => candidate.version === input.contract.quoteVersion) ?? input.quote.current;
  const seller = version.seller ?? (await currentQuoteSeller(input.organizationId));
  return buildContractPdfModel({
    quoteNumber: input.quote.number,
    contract: input.contract,
    seller,
    logo: await loadDocumentLogo(input.organizationId, seller.logoKey),
    labels: contractPdfLabels(t as unknown as Translate, tDocuments as unknown as Translate),
    locale,
    withdrawalDays: starterContractRules().withdrawal.periodDays,
    watermark: input.quote.isDemo ? tQuotes("demoWatermark") : null,
    defaultColor: starterDocumentStyle(locale).defaultColor,
    ...(input.signatureSlots ? { signatureSlots: input.signatureSlots } : {}),
    withQuote: input.withQuote ?? false,
  });
}

export async function renderContractPdf(input: { organizationId: string; quote: QuoteDetail; contract: ContractView; signatureSlots?: { role: string; tag: string }[] }): Promise<Buffer> {
  const model = await contractModel(input);
  return renderToBuffer(createElement(ContractPdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
}

// DOC-03 (D9) : le devis (sa version figée, sans zone de signature), puis le contrat qui porte la
// zone de signature de chaque signataire.
export async function renderQuoteAndContractPdf(input: { organizationId: string; quote: QuoteDetail; contract: ContractView; signatureSlots: { role: string; tag: string }[] }): Promise<Buffer> {
  const quote = await quotePdfModelFor({ organizationId: input.organizationId, quote: input.quote, version: input.quote.current });
  const contract = await contractModel({ ...input, withQuote: true });
  return renderToBuffer(createElement(QuoteAndContractPdfDocument, { quote: pdfSafe(quote), contract: pdfSafe(contract) }) as unknown as ReactElement<DocumentProps>);
}

export async function renderEvidencePdf(evidence: ContractEvidenceDocument & { sha256: string }): Promise<Buffer> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Contracts");
  const model = buildEvidencePdfModel(evidence, evidencePdfLabels(t as unknown as Translate), locale);
  return renderToBuffer(createElement(EvidencePdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
}
