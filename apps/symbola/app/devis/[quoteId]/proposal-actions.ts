"use server";

// Lot 43 (FAC-02, FAC-15, FAC-09 ; D1, D2, D7) — actions de la planner sur la proposition d'un devis :
// mot d'accueil du brouillon, annonce par e-mail, prolongation de la validité, suspension et reprise
// des relances d'une échéance (motif). Session planner, organisation et module contrôlés côté serveur.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  extendQuoteValidity,
  getQuote,
  notifyProposalSent,
  ProposalTemplateInvalidError,
  QuoteNotFoundError,
  QuoteVersionLockedError,
  resumePaymentReminders,
  setQuoteProposalGreeting,
  suspendPaymentReminders,
  ValidityExtensionError,
} from "@/modules/quotes/service";
import { pendingPreparedEmailIds, withPreparer } from "@/lib/prepared-emails";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";
import type { QuoteFormState } from "./actions";

async function run(formData: FormData, write: (planner: { organizationId: string; userId: string }, quoteId: string) => Promise<QuoteFormState | void>): Promise<QuoteFormState> {
  const t = await getTranslations("QuoteProposal");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("errors.unauthenticated") };
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!isValidId(quoteId)) return { error: t("errors.notFound") };
  try {
    const result = await write(planner, quoteId);
    if (result) return result;
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return { error: t("errors.notFound") };
    if (error instanceof QuoteVersionLockedError) return { error: t("errors.locked") };
    if (error instanceof ProposalTemplateInvalidError) return { error: t("errors.greeting") };
    if (error instanceof ValidityExtensionError) return { error: t(error.reason === "date" ? "errors.validityDate" : "errors.validityClosed") };
    if (error instanceof RangeError) return { error: t("errors.reason") };
    throw error;
  }
  revalidatePath(`/devis/${quoteId}`);
  return { success: true };
}

export async function setGreetingAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async ({ organizationId }, quoteId) => {
    await setQuoteProposalGreeting(organizationId, quoteId, String(formData.get("greeting") ?? ""));
  });
}

export async function notifyProposalAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const t = await getTranslations("QuoteProposal");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return run(formData, async ({ organizationId }, quoteId) => {
    const sent = await notifyProposalSent(organizationId, quoteId, locale);
    if (sent === 0) return { error: t("errors.noRecipient") };
    // Lot 65d (ADR 0110) : préparée pour la messagerie de la planner, la fenêtre s'ouvre aussitôt.
    const quote = await getQuote(organizationId, quoteId);
    const prepared = await pendingPreparedEmailIds(organizationId, { eventId: quote.eventId, kinds: ["proposal_sent"], ref: { quoteId } });
    if (prepared.length > 0) redirect(withPreparer(`/devis/${quoteId}`, prepared));
  });
}

export async function extendValidityAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async ({ organizationId }, quoteId) => {
    await extendQuoteValidity(organizationId, quoteId, String(formData.get("validUntil") ?? ""));
  });
}

export async function suspendRemindersAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const t = await getTranslations("QuoteProposal");
  return run(formData, async ({ organizationId, userId }) => {
    const scheduleItemId = String(formData.get("scheduleItemId") ?? "");
    if (!isValidId(scheduleItemId)) return { error: t("errors.notFound") };
    await suspendPaymentReminders(organizationId, { scheduleItemId, reason: String(formData.get("reason") ?? ""), userId });
  });
}

export async function resumeRemindersAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const t = await getTranslations("QuoteProposal");
  return run(formData, async ({ organizationId }) => {
    const scheduleItemId = String(formData.get("scheduleItemId") ?? "");
    if (!isValidId(scheduleItemId)) return { error: t("errors.notFound") };
    await resumePaymentReminders(organizationId, scheduleItemId);
  });
}
