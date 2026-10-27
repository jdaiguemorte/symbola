"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  PaymentMethodNotFoundError,
  QuoteNotFoundError,
  QuoteScheduleExceedsTotalError,
  QuoteVersionLockedError,
  ScheduleItemNotPayableError,
  addScheduleItem,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  removeScheduleItem,
  updateScheduleItem,
  type ScheduleItemInput,
} from "@/modules/quotes/service";
import { parseDecimal } from "../decimal-input";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";
import type { QuoteFormState } from "./actions";

type Translate = Awaited<ReturnType<typeof getTranslations<"Quotes">>>;

function errorState(error: unknown, t: Translate): QuoteFormState {
  if (error instanceof QuoteNotFoundError) return { error: t("quoteNotFound") };
  if (error instanceof QuoteVersionLockedError) return { error: t("versionLocked") };
  if (error instanceof QuoteScheduleExceedsTotalError) return { error: t("scheduleExceedsTotal") };
  if (error instanceof ScheduleItemNotPayableError) return { error: t("scheduleNotPayable") };
  if (error instanceof PaymentMethodNotFoundError) return { error: t("paymentMethodNotFound") };
  if (error instanceof RangeError) return { error: t("invalidScheduleItem") };
  throw error;
}

// Échéance lue du formulaire : intitulé, date, et montant (€) ou
// pourcentage du total TTC selon « kind ».
function readScheduleItem(formData: FormData): ScheduleItemInput | null {
  const kind = String(formData.get("kind") ?? "amount");
  const value = parseDecimal(String(formData.get("value") ?? ""), 2);
  if (value === null || (kind !== "amount" && kind !== "percent")) return null;
  return {
    label: String(formData.get("label") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    amountCents: kind === "amount" ? value : null,
    percentageBasisPoints: kind === "percent" ? value : null,
  };
}

async function run(
  formData: FormData,
  write: (organizationId: string, t: Translate) => Promise<QuoteFormState | void>,
): Promise<QuoteFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!isValidId(quoteId)) return { error: t("quoteNotFound") };
  try {
    const result = await write(planner.organizationId, t);
    if (result) return result;
  } catch (error) {
    return errorState(error, t);
  }
  revalidatePath(`/devis/${quoteId}`);
  revalidatePath("/devis/encaissements");
  return { success: true };
}

function readItemId(formData: FormData): string | null {
  const id = String(formData.get("scheduleItemId") ?? "");
  return isValidId(id) ? id : null;
}

export async function addScheduleItemAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, t) => {
    const item = readScheduleItem(formData);
    if (!item) return { error: t("invalidScheduleItem") };
    await addScheduleItem(organizationId, String(formData.get("quoteId")), item);
  });
}

export async function updateScheduleItemAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, t) => {
    const itemId = readItemId(formData);
    const item = readScheduleItem(formData);
    if (!itemId || !item) return { error: t("invalidScheduleItem") };
    await updateScheduleItem(organizationId, itemId, item);
  });
}

export async function removeScheduleItemAction(formData: FormData): Promise<void> {
  await run(formData, async (organizationId) => {
    const itemId = readItemId(formData);
    if (!itemId) return {};
    await removeScheduleItem(organizationId, itemId);
  });
}

// DEV-03 — marquer payée : date et mode de paiement obligatoires.
export async function markPaidAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, t) => {
    const itemId = readItemId(formData);
    const paymentMethodId = String(formData.get("paymentMethodId") ?? "");
    if (!itemId) return { error: t("quoteNotFound") };
    if (!isValidId(paymentMethodId)) return { error: t("paymentMethodNotFound") };
    await markScheduleItemPaid({
      organizationId,
      scheduleItemId: itemId,
      paidOn: String(formData.get("paidOn") ?? ""),
      paymentMethodId,
    });
  });
}

export async function markUnpaidAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, t) => {
    const itemId = readItemId(formData);
    if (!itemId) return { error: t("quoteNotFound") };
    await markScheduleItemUnpaid(organizationId, itemId);
  });
}
