"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  QuoteEmptyError,
  QuoteNotFoundError,
  QuoteNotSentError,
  QuoteScheduleExceedsTotalError,
  QuoteVatRegimeRequiredError,
  QuoteVersionLockedError,
  SignatureAlreadyRequestedError,
  SignatureLinksNotMailedError,
  SignatureUnavailableError,
  ContractNotFoundError,
  ContractOutdatedError,
  SignersWithoutPortalError,
  getQuote,
  listQuoteContracts,
  sendQuote,
  sendQuoteForSignature,
  signatureSlots,
  type SignerInput,
} from "@/modules/quotes/service";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";
import type { QuoteFormState } from "./actions";
import { renderQuotePdf } from "./render-quote-pdf";
import { renderQuoteAndContractPdf } from "./render-contract-pdf";

const MAX_SIGNER_ROWS = 4;

// Lignes de signataires du formulaire : signer_<i>_name/email/address
// (et le marié d'origine) ; une ligne entièrement vide est ignorée.
function readSigners(formData: FormData): SignerInput[] {
  const signers: SignerInput[] = [];
  for (let index = 0; index < MAX_SIGNER_ROWS; index++) {
    const value = (field: string) => String(formData.get(`signer_${index}_${field}`) ?? "").trim();
    const [name, email, billingAddress, eventClientId] = [value("name"), value("email"), value("address"), value("clientId")];
    if (!name && !email && !billingAddress) continue;
    signers.push({ name, email, billingAddress, eventClientId: isValidId(eventClientId) ? eventClientId : null });
  }
  return signers;
}

// DEV-02 — envoi en signature : un brouillon est d'abord envoyé (version
// figée), puis le PDF de la version figée part chez le fournisseur avec une
// zone de signature par signataire.
export async function sendForSignatureAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!isValidId(quoteId)) return { error: t("quoteNotFound") };
  const signers = readSigners(formData);
  if (signers.length === 0) return { error: t("missingSigners") };
  const { organizationId } = planner;

  // Lot 31b (DOC-03, D9) : avec un contrat, un seul PDF (le devis puis le contrat).
  const contractId = String(formData.get("contractId") ?? "");
  try {
    let quote = await getQuote(organizationId, quoteId);
    if (quote.status === "draft") quote = await sendQuote({ organizationId, quoteId });
    const contract = isValidId(contractId) ? (await listQuoteContracts(organizationId, quoteId)).find((candidate) => candidate.id === contractId) : undefined;
    if (isValidId(contractId) && !contract) throw new ContractNotFoundError();
    const slots = signatureSlots(signers.length);
    const documentPdf = contract
      ? await renderQuoteAndContractPdf({ organizationId, quote, contract, signatureSlots: slots })
      : await renderQuotePdf({ organizationId, quote, version: quote.current, signatureSlots: slots });
    await sendQuoteForSignature({
      organizationId,
      quoteId,
      signers,
      documentPdf,
      locale: (await getLocale()) === "en" ? "en" : "fr",
      contractId: contract?.id ?? null,
    });
  } catch (error) {
    if (error instanceof ContractOutdatedError) return { error: (await getTranslations("Contracts"))("contractOutdatedBeforeSignature") };
    if (error instanceof SignersWithoutPortalError) return { error: (await getTranslations("Contracts"))("signersWithoutPortal", { names: error.names.join(", ") }) };
    if (error instanceof ContractNotFoundError) return { error: (await getTranslations("Contracts"))("contractNotFound") };
    if (error instanceof QuoteNotFoundError) return { error: t("quoteNotFound") };
    if (error instanceof QuoteNotSentError || error instanceof QuoteVersionLockedError) return { error: t("signatureNotSendable") };
    if (error instanceof SignatureAlreadyRequestedError) return { error: t("signatureAlreadyRequested") };
    if (error instanceof SignatureUnavailableError) return { error: t("signatureUnavailable") };
    if (error instanceof QuoteEmptyError) return { error: t("quoteEmpty") };
    if (error instanceof QuoteScheduleExceedsTotalError) return { error: t("scheduleExceedsTotal") };
    if (error instanceof QuoteVatRegimeRequiredError) return { error: t("vatRegimeRequired"), vatRegimeRequired: true };
    if (error instanceof RangeError) return { error: t("invalidSigners") };
    // La demande est enregistrée ; ses liens sont sur le devis (signingLinksHint).
    if (error instanceof SignatureLinksNotMailedError) {
      revalidatePath(`/devis/${quoteId}`);
      return { error: t("signatureLinksNotMailed", { count: error.count }) };
    }
    // Service de signature injoignable ou en erreur : message clair, jamais
    // une page d'erreur (CLAUDE.md §2.3). Nom et message seulement au journal
    // (l'adaptateur n'y met aucune donnée personnelle).
    console.error("envoi en signature échoué", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return { error: t("signatureServiceDown") };
  }
  revalidatePath(`/devis/${quoteId}`);
  return { success: true };
}
