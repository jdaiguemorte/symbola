"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  CreditNoteExceedsInvoiceError,
  InvoiceAlreadyIssuedError,
  InvoiceNotFoundError,
  ProfessionalInvoiceNotSupportedError,
  QuoteNotFoundError,
  QuoteNotSignedError,
  QuoteVersionLockedError,
  issueBalanceInvoice,
  issueCreditNote,
  issueDepositInvoice,
  setQuoteClientKind,
} from "@/modules/quotes/service";
import { parseDecimal } from "../decimal-input";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";
import type { QuoteFormState } from "./actions";

type Translate = Awaited<ReturnType<typeof getTranslations<"Quotes">>>;

function errorState(error: unknown, t: Translate): QuoteFormState {
  if (error instanceof QuoteNotFoundError || error instanceof InvoiceNotFoundError) return { error: t("invoiceNotFound") };
  if (error instanceof QuoteNotSignedError) return { error: t("quoteNotSigned") };
  if (error instanceof InvoiceAlreadyIssuedError || error instanceof QuoteVersionLockedError) return { error: t("invoiceAlreadyIssued") };
  if (error instanceof ProfessionalInvoiceNotSupportedError) return { error: t("professionalInvoiceNotSupported") };
  if (error instanceof CreditNoteExceedsInvoiceError) return { error: t("creditNoteExceedsInvoice") };
  if (error instanceof RangeError) return { error: t("invalidCreditNote") };
  throw error;
}

async function run(
  formData: FormData,
  write: (organizationId: string, quoteId: string, t: Translate) => Promise<QuoteFormState | void>,
): Promise<QuoteFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!isValidId(quoteId)) return { error: t("quoteNotFound") };
  try {
    const result = await write(planner.organizationId, quoteId, t);
    if (result) return result;
  } catch (error) {
    return errorState(error, t);
  }
  revalidatePath(`/devis/${quoteId}`);
  revalidatePath("/devis/e-reporting");
  return { success: true };
}

export async function setClientKindAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId) => {
    const kind = formData.get("clientKind") === "professional" ? "professional" : "individual";
    await setQuoteClientKind(organizationId, quoteId, kind);
  });
}

export async function issueDepositInvoiceAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, _quoteId, t) => {
    const scheduleItemId = String(formData.get("scheduleItemId") ?? "");
    if (!isValidId(scheduleItemId)) return { error: t("invoiceNotFound") };
    await issueDepositInvoice({ organizationId, scheduleItemId });
  });
}

export async function issueBalanceInvoiceAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId) => {
    await issueBalanceInvoice({ organizationId, quoteId });
  });
}

// DEV-04 — correction d'une facture émise : un avoir, jamais une modification.
export async function issueCreditNoteAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, _quoteId, t) => {
    const invoiceId = String(formData.get("invoiceId") ?? "");
    if (!isValidId(invoiceId)) return { error: t("invoiceNotFound") };
    const amountCents = parseDecimal(String(formData.get("amount") ?? ""), 2);
    if (!amountCents) return { error: t("invalidCreditNote") };
    await issueCreditNote({ organizationId, invoiceId, amountCents, reason: String(formData.get("reason") ?? "") });
  });
}
