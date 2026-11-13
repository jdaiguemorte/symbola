"use server";

// Lot 31b (FAC-04, DOC-02, DOC-03, JUR-07 ; D7, D9, D11 à D13) — génération du contrat d'un devis
// envoyé (canal, clauses facultatives, avertissement accepté ; chaque problème nommé) et
// signature du contrat seul, généré après la signature du devis. Session planner vérifiée.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ContractNotFoundError,
  ContractNotGeneratableError,
  ContractOutdatedError,
  ContractSigningInProgressError,
  ContractTemplateNotFoundError,
  generateContract,
  getQuote,
  listQuoteContracts,
  QuoteNotFoundError,
  QuoteNotSignedError,
  sendContractForSignature,
  SignatureAlreadyRequestedError,
  SignatureLinksNotMailedError,
  SignatureUnavailableError,
  SignersWithoutPortalError,
  signatureSlots,
  type ConclusionChannel,
  type ContractProblem,
} from "@/modules/quotes/service";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";
import { renderContractPdf } from "./render-contract-pdf";

// values : ce que la planner a saisi, remis dans le formulaire après un refus (React le vide).
export type ContractFormState = {
  error?: string;
  success?: boolean;
  problems?: ContractProblem[];
  values?: { channel: string; clauseIds: string[]; smallBusiness: boolean; acceptWarning: boolean };
};

const CHANNELS: ConclusionChannel[] = ["on_premises", "distance", "off_premises", "fair"];

export async function generateContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const t = await getTranslations("Contracts");
  const auth = await authorizedPlanner();
  if (!auth) return { error: t("unauthenticated") };
  const quoteId = String(formData.get("quoteId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const channel = String(formData.get("channel") ?? "");
  const values = {
    channel,
    clauseIds: formData.getAll("clause").map(String).filter(isValidId),
    smallBusiness: formData.get("smallBusiness") === "on",
    acceptWarning: formData.get("acceptWarning") === "on",
  };
  if (!isValidId(quoteId) || !isValidId(templateId)) return { error: t("templateNotFound"), values };
  if (!(CHANNELS as string[]).includes(channel)) return { error: t("channelRequired"), values };
  try {
    await generateContract({
      organizationId: auth.organizationId,
      quoteId,
      templateId,
      optionalClauseIds: values.clauseIds,
      channel: channel as ConclusionChannel,
      smallBusinessConfirmed: values.smallBusiness,
      acceptWarning: values.acceptWarning,
      userId: auth.userId,
      locale: (await getLocale()) === "en" ? "en" : "fr",
    });
  } catch (error) {
    if (error instanceof ContractNotGeneratableError) return { error: t("generationRefused"), problems: error.problems, values };
    if (error instanceof ContractTemplateNotFoundError) return { error: t("templateNotFound"), values };
    if (error instanceof ContractSigningInProgressError) return { error: t("signingInProgress"), values };
    if (error instanceof QuoteNotFoundError) return { error: t("quoteNotFound"), values };
    throw error;
  }
  revalidatePath(`/devis/${quoteId}`);
  return { success: true };
}

// DOC-03 (D9) : contrat généré après la signature du devis, signé seul par les mêmes signataires.
export async function sendContractAloneAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const t = await getTranslations("Contracts");
  const tQuotes = await getTranslations("Quotes");
  const auth = await authorizedPlanner();
  if (!auth) return { error: t("unauthenticated") };
  const quoteId = String(formData.get("quoteId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  if (!isValidId(quoteId) || !isValidId(contractId)) return { error: t("contractNotFound") };
  try {
    const quote = await getQuote(auth.organizationId, quoteId);
    const contract = (await listQuoteContracts(auth.organizationId, quoteId)).find((candidate) => candidate.id === contractId);
    if (!contract) return { error: t("contractNotFound") };
    const slots = signatureSlots(quote.signature?.signers.length ?? 0);
    const documentPdf = await renderContractPdf({ organizationId: auth.organizationId, quote, contract, signatureSlots: slots });
    await sendContractForSignature({ organizationId: auth.organizationId, quoteId, contractId, documentPdf, locale: (await getLocale()) === "en" ? "en" : "fr" });
  } catch (error) {
    if (error instanceof ContractNotFoundError || error instanceof QuoteNotFoundError) return { error: t("contractNotFound") };
    if (error instanceof ContractOutdatedError) return { error: t("contractOutdated") };
    if (error instanceof SignersWithoutPortalError) return { error: t("signersWithoutPortal", { names: error.names.join(", ") }) };
    if (error instanceof QuoteNotSignedError) return { error: t("quoteNotSignedYet") };
    if (error instanceof SignatureAlreadyRequestedError) return { error: tQuotes("signatureAlreadyRequested") };
    if (error instanceof SignatureUnavailableError) return { error: tQuotes("signatureUnavailable") };
    if (error instanceof SignatureLinksNotMailedError) {
      revalidatePath(`/devis/${quoteId}`);
      return { error: tQuotes("signatureLinksNotMailed", { count: error.count }) };
    }
    console.error("envoi du contrat en signature échoué", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return { error: tQuotes("signatureServiceDown") };
  }
  revalidatePath(`/devis/${quoteId}`);
  return { success: true };
}
