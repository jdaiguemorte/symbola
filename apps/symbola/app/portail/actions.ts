"use server";

// Lot 26a (UX-11) — actions du portail d'un lien personnel : cocher une tâche
// « mariés » (rubrique Rétroplanning), fermer la session sur cet appareil.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { answerLinkDecision, DecisionInvalidError } from "@/modules/events/service";
import { cancelLinkVendorPaymentDeclaration, declareLinkVendorPayment, LinkBudgetAccessDeniedError, VendorPaymentDeclarationError } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { declarablePaymentMethods } from "./payment-methods";
import { closeLinkSession, LinkAccessDeniedError, setLinkTaskDone } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { clearLinkSessionCookie, currentLinkAccess, getLinkSessionToken } from "@/lib/link-session";
import { chooseQuoteOptions, ContractActNotAllowedError, ContractNotFoundError, QuoteNotFoundError, QuoteOptionsLockedError, recordSignerAct } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";

export async function toggleLinkTaskAction(formData: FormData): Promise<void> {
  const access = await currentLinkAccess();
  if (!access || !(await isEventsModuleEnabled(access.organizationId))) return;
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(taskId)) return;
  try {
    await setLinkTaskDone(access.organizationId, access.linkId, taskId, formData.get("done") === "true");
  } catch (error) {
    if (!(error instanceof LinkAccessDeniedError)) throw error;
  }
  revalidatePath("/portail");
}

// Lot 27a (SC-06 étape 5, décision D6) — « Je l'ai réglée » sur une échéance de
// ses catégories : date et moyen, confirmés ensuite par la planner. Le moyen
// est l'un de ceux de l'organisation.
export type DeclarationState = { error?: string; success?: boolean };

export async function declarePaymentAction(_prev: DeclarationState, formData: FormData): Promise<DeclarationState> {
  const t = await getTranslations("LinkPortal");
  const access = await currentLinkAccess();
  if (!access || !(await isBudgetModuleEnabled(access.organizationId))) return { error: t("declareErrorState") };
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!isValidId(paymentId)) return { error: t("declareErrorState") };
  const method = String(formData.get("method") ?? "");
  if (!(await declarablePaymentMethods(access.organizationId)).includes(method)) return { error: t("declareErrorMethod") };
  try {
    await declareLinkVendorPayment({ organizationId: access.organizationId, linkId: access.linkId, paymentId, paidOn: String(formData.get("paidOn") ?? ""), method });
  } catch (error) {
    if (error instanceof VendorPaymentDeclarationError) return { error: t(error.reason === "date" ? "declareErrorDate" : error.reason === "method" ? "declareErrorMethod" : "declareErrorState") };
    if (error instanceof LinkBudgetAccessDeniedError) return { error: t("declareErrorState") };
    throw error;
  }
  revalidatePath("/portail");
  return { success: true };
}

export async function cancelPaymentDeclarationAction(formData: FormData): Promise<void> {
  const access = await currentLinkAccess();
  if (!access || !(await isBudgetModuleEnabled(access.organizationId))) return;
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!isValidId(paymentId)) return;
  try {
    await cancelLinkVendorPaymentDeclaration({ organizationId: access.organizationId, linkId: access.linkId, paymentId });
  } catch (error) {
    if (!(error instanceof VendorPaymentDeclarationError) && !(error instanceof LinkBudgetAccessDeniedError)) throw error;
  }
  revalidatePath("/portail");
}

// Lot 27b (POR-03, BUD-07, décision D10) — réponse à une décision : la première
// réponse décide ; une option se choisit parmi celles figées à la demande.
export type DecisionAnswerState = { error?: string; success?: boolean };

export async function answerDecisionAction(_prev: DecisionAnswerState, formData: FormData): Promise<DecisionAnswerState> {
  const t = await getTranslations("Decisions");
  const access = await currentLinkAccess();
  if (!access || !(await isEventsModuleEnabled(access.organizationId))) return { error: t("answerGone") };
  const decisionId = String(formData.get("decisionId") ?? "");
  const answer = String(formData.get("answer") ?? "");
  if (!isValidId(decisionId) || (answer !== "approved" && answer !== "declined")) return { error: t("answerGone") };
  const choice = String(formData.get("choiceId") ?? "");
  try {
    await answerLinkDecision({
      organizationId: access.organizationId,
      linkId: access.linkId,
      decisionId,
      answer,
      // « Aucune ne me convient » ne garde pas d'option cochée.
      choiceId: answer === "approved" && isValidId(choice) ? choice : null,
      comment: String(formData.get("comment") ?? ""),
    });
  } catch (error) {
    if (error instanceof DecisionInvalidError) return { error: t(error.reason === "choice" ? "answerChoiceMissing" : error.reason === "comment" ? "answerCommentTooLong" : "answerGone") };
    if (error instanceof LinkAccessDeniedError) return { error: t("answerGone") };
    throw error;
  }
  revalidatePath("/portail");
  return { success: true };
}

// Ferme la session de lien de ce navigateur ; le lien lui-même reste valable.
export async function closeLinkSessionAction(): Promise<void> {
  const token = await getLinkSessionToken();
  if (token) await closeLinkSession(token);
  await clearLinkSessionCookie();
  redirect("/lien?ferme=1");
}

// Lot 31a (FAC-01, décision D2 ; SC-02 étape 5) — le client choisit ses options sur son
// portail, avant de signer : seulement un lien client qui ouvre la rubrique devis, pour un
// devis de son événement ; le choix est daté et porte le nom de la personne du lien.
export type QuoteOptionsState = { error?: string; success?: boolean };

export async function chooseLinkQuoteOptionsAction(_prev: QuoteOptionsState, formData: FormData): Promise<QuoteOptionsState> {
  const t = await getTranslations("ClientSpace");
  const access = await currentLinkAccess();
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !(await isQuotesModuleEnabled(access.organizationId))) {
    return { error: t("optionsError") };
  }
  const quoteId = String(formData.get("quoteId") ?? "");
  const chosenLineIds = formData.getAll("optionLineIds").map(String);
  if (!isValidId(quoteId) || !chosenLineIds.every(isValidId)) return { error: t("optionsError") };
  try {
    await chooseQuoteOptions({ organizationId: access.organizationId, quoteId, eventId: access.eventId, chosenLineIds, chosenBy: access.personName, byKind: "client" });
  } catch (error) {
    if (error instanceof QuoteOptionsLockedError) return { error: t("optionsLocked") };
    if (error instanceof QuoteNotFoundError) return { error: t("optionsError") };
    throw error;
  }
  revalidatePath("/portail");
  return { success: true };
}

// Lot 31b (JUR-07 ; réponse 1 de l'avocat, D13) — actes du client sur son portail, avant de
// signer : commande avec obligation de paiement (contrat à distance), demande d'exécution avant
// la fin du délai de rétractation (case distincte de la signature). Seulement un lien client qui
// ouvre la rubrique devis, pour un contrat de son événement, dont il est signataire.
export type ContractActState = { error?: string; success?: boolean };

async function contractAct(formData: FormData, kind: "order" | "early_execution"): Promise<ContractActState> {
  const t = await getTranslations("ClientSpace");
  const access = await currentLinkAccess();
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !(await isQuotesModuleEnabled(access.organizationId))) {
    return { error: t("contractActError") };
  }
  const contractId = String(formData.get("contractId") ?? "");
  if (!isValidId(contractId)) return { error: t("contractActError") };
  if (kind === "early_execution" && formData.get("confirm") !== "on") return { error: t("earlyExecutionConfirmRequired") };
  try {
    await recordSignerAct({ organizationId: access.organizationId, eventId: access.eventId, clientEmail: access.email, contractId, kind, orderText: t("orderButton") });
  } catch (error) {
    if (error instanceof ContractNotFoundError || error instanceof ContractActNotAllowedError) return { error: t("contractActError") };
    throw error;
  }
  revalidatePath("/portail");
  return { success: true };
}

export async function orderContractAction(_prev: ContractActState, formData: FormData): Promise<ContractActState> {
  return contractAct(formData, "order");
}

export async function requestEarlyExecutionAction(_prev: ContractActState, formData: FormData): Promise<ContractActState> {
  return contractAct(formData, "early_execution");
}
