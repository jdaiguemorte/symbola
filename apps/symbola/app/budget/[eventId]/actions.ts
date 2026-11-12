"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { BUDGET_AMOUNT_FIELDS, type BudgetAmountField } from "@symbola/contracts";
import { parseAmountToCents } from "@symbola/i18n";
import {
  AlertThresholdInvalidError,
  BudgetLineDetailsInvalidError,
  BudgetLineNotFoundError,
  BudgetLinePaidFromPaymentsError,
  VendorPaymentInvalidError,
  VendorPaymentNotFoundError,
  addBudgetLine,
  addVendorPayment,
  removeBudgetLine,
  removeVendorPayment,
  setVendorPaymentPaid,
  updateBudgetLineDetails,
  setEventAlertThreshold,
  AllocationModelNotFoundError,
  BudgetSimulationMismatchError,
  DefaultVendorSlotNotFoundError,
  EventBudgetNotFoundError,
  EventNotFoundError,
  EventVendorSlotNotFoundError,
  adjustEventBudgetItem,
  confirmEventBudget,
  simulateEventBudget,
  updateBudgetLine,
} from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isBudgetModuleEnabled, isValidId } from "../module-access";
import { parseDecimal } from "@/app/devis/decimal-input";

export type BudgetFormState = { error?: string; success?: boolean };

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isBudgetModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

// Montant saisi en euros (« 2 929,50 », « 2929.50 ») vers des centimes, sans
// calcul à virgule flottante (CLAUDE.md §5). Un champ vide vaut 0 €, comme
// avant ; une saisie illisible rend undefined.
function amountCentsFrom(formData: FormData): number | undefined {
  const cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  return cents === null ? 0 : cents;
}

export async function simulateEventBudgetAction(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const eventId = String(formData.get("eventId") ?? "");
  const totalAmountCents = parseAmountToCents(String(formData.get("totalAmount") ?? ""));
  const guestCount = Number(String(formData.get("guestCount") ?? "").trim());
  const allocationModelId = String(formData.get("allocationModelId") ?? "").trim();

  if (!totalAmountCents) return { error: t("invalidTotalAmount") };
  if (!Number.isInteger(guestCount) || guestCount < 0) return { error: t("invalidGuestCount") };
  if (!allocationModelId) return { error: t("missingModel") };

  try {
    await simulateEventBudget({
      organizationId,
      eventId,
      totalAmountCents,
      guestCount,
      allocationModelId,
    });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof AllocationModelNotFoundError) return { error: t("missingModel") };
    throw error;
  }

  revalidatePath(`/budget/${eventId}`);
  return {};
}

export async function confirmEventBudgetAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;

  const eventId = String(formData.get("eventId") ?? "");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated") return;

  try {
    await confirmEventBudget({ organizationId, eventId, confirmedByUserId: auth.user.id });
  } catch (error) {
    if (error instanceof EventNotFoundError) return;
    if (error instanceof EventBudgetNotFoundError) return;
    if (error instanceof BudgetSimulationMismatchError) return;
    throw error;
  }

  revalidatePath(`/budget/${eventId}`);
  revalidatePath(`/events/${eventId}`);
}

// Lot 28a (BUD-01) : les quatre montants saisissables d'une ligne en un seul
// envoi ; un champ vide ou inchangé n'est pas écrit. Chaque montant écrit est
// historisé.
export async function updateBudgetLineAction(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated") return { error: t("unauthenticated") };

  const eventId = String(formData.get("eventId") ?? "");
  // Lot 28b (Q33) : la ligne visée ; à défaut (fiche de l'événement), la
  // première ligne de la catégorie.
  const lineId = String(formData.get("lineId") ?? "");
  const eventVendorSlotId = String(formData.get("eventVendorSlotId") ?? "");
  const target = isValidId(lineId) ? { lineId } : { eventVendorSlotId };
  const changes: { field: BudgetAmountField; amountCents: number }[] = [];
  for (const field of BUDGET_AMOUNT_FIELDS) {
    const raw = String(formData.get(`amount_${field}`) ?? "").trim();
    if (raw === "") continue;
    const amountCents = parseAmountToCents(raw);
    if (amountCents === null || amountCents === undefined || amountCents < 0) return { error: t("invalidAmount") };
    if (String(amountCents) === String(formData.get(`current_${field}`) ?? "")) continue;
    changes.push({ field, amountCents });
  }

  try {
    for (const change of changes) {
      await updateBudgetLine({ organizationId, eventId, ...target, field: change.field, amountCents: change.amountCents, changedByUserId: auth.user.id });
    }
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventVendorSlotNotFoundError || error instanceof BudgetLineNotFoundError) return { error: t("unknownVendorSlot") };
    if (error instanceof BudgetLinePaidFromPaymentsError) return { error: t("paidFromPayments") };
    throw error;
  }

  revalidatePath(`/budget/${eventId}`);
  // Lot 12 (L12-EVT-17) : l'estimé se saisit aussi depuis l'onglet Budget de la fiche.
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Lot 28a (BUD-02, décision D4) : seuil d'alerte propre à l'événement ; vide,
// l'événement reprend celui de l'organisation.
export async function setEventAlertThresholdAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const raw = String(formData.get("percent") ?? "").trim();
  const percent = raw === "" ? null : Number(raw);
  try {
    await setEventAlertThreshold(organizationId, eventId, percent);
  } catch (error) {
    if (error instanceof AlertThresholdInvalidError) return { error: t("thresholdInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/budget/${eventId}`);
  return { success: true };
}

export async function adjustEventBudgetItemAction(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const eventId = String(formData.get("eventId") ?? "");
  const defaultVendorSlotId = String(formData.get("defaultVendorSlotId") ?? "");
  const amountCents = amountCentsFrom(formData);

  if (amountCents === undefined) return { error: t("invalidAmount") };

  try {
    await adjustEventBudgetItem({
      organizationId,
      eventId,
      defaultVendorSlotId,
      amountCents,
    });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventBudgetNotFoundError) return { error: t("noSimulationYet") };
    if (error instanceof DefaultVendorSlotNotFoundError) return { error: t("unknownVendorSlot") };
    throw error;
  }

  revalidatePath(`/budget/${eventId}`);
  return {};
}

// —— Lot 28b (BUD-01, Q33) : lignes d'une catégorie ————————————————————————

async function plannerAccess(): Promise<{ organizationId: string; userId: string } | null> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return null;
  const auth = await getPlannerAuthContext();
  return auth.status === "authenticated" ? { organizationId, userId: auth.user.id } : null;
}

function refresh(eventId: string) {
  revalidatePath(`/budget/${eventId}`);
  revalidatePath(`/events/${eventId}`);
}

function lineDetailsError(t: Awaited<ReturnType<typeof getTranslations>>, error: unknown): BudgetFormState {
  if (error instanceof BudgetLineDetailsInvalidError) return { error: t(error.reason === "label" ? "lineLabelRequired" : error.reason === "vendor" ? "lineVendorInvalid" : "lineVatRateInvalid") };
  if (error instanceof BudgetLineNotFoundError || error instanceof EventVendorSlotNotFoundError) return { error: t("unknownVendorSlot") };
  if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
  throw error;
}

// Prestataire choisi dans la liste de la catégorie : vide = aucun.
function candidateFrom(formData: FormData): string | null | undefined {
  if (!formData.has("vendorCandidateId")) return undefined;
  const value = String(formData.get("vendorCandidateId") ?? "");
  return isValidId(value) ? value : null;
}

export async function addBudgetLineAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  if (!access) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const eventVendorSlotId = String(formData.get("eventVendorSlotId") ?? "");
  if (!isValidId(eventId) || !isValidId(eventVendorSlotId)) return { error: t("unknownVendorSlot") };
  try {
    await addBudgetLine({ organizationId: access.organizationId, eventId, eventVendorSlotId, label: String(formData.get("label") ?? ""), vendorCandidateId: candidateFrom(formData) ?? null });
  } catch (error) {
    return lineDetailsError(t, error);
  }
  refresh(eventId);
  return { success: true };
}

export async function updateBudgetLineDetailsAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  if (!access) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  if (!isValidId(eventId) || !isValidId(lineId)) return { error: t("unknownVendorSlot") };
  const vendorCandidateId = candidateFrom(formData);
  // Lot 28c (BUD-09) : taux saisi comme au catalogue (« 20 », « 5,5 »).
  const vatRateBasisPoints = formData.has("vatRate") ? parseDecimal(String(formData.get("vatRate") ?? ""), 2) : undefined;
  if (vatRateBasisPoints === null || (vatRateBasisPoints !== undefined && vatRateBasisPoints > 10000)) return { error: t("lineVatRateInvalid") };
  try {
    await updateBudgetLineDetails({
      organizationId: access.organizationId,
      eventId,
      lineId,
      label: String(formData.get("label") ?? ""),
      ...(vendorCandidateId !== undefined ? { vendorCandidateId } : {}),
      ...(vatRateBasisPoints !== undefined ? { vatRateBasisPoints } : {}),
    });
  } catch (error) {
    return lineDetailsError(t, error);
  }
  refresh(eventId);
  return { success: true };
}

export async function removeBudgetLineAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(lineId)) return;
  await removeBudgetLine(access.organizationId, eventId, lineId).catch((error: unknown) => {
    if (!(error instanceof BudgetLineNotFoundError)) throw error;
  });
  refresh(eventId);
}

// —— Lot 28b (BUD-03, D12, D13) : échéances des prestataires ———————————————

// « 30 », « 12,5 » ou « 33.33 » % vers des points de base, sans calcul à
// virgule flottante (CLAUDE.md § 5) ; undefined si illisible.
function basisPointsFrom(raw: string): number | undefined {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(raw.trim().replace(/\s*%$/, ""));
  if (!match) return undefined;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export async function addVendorPaymentAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  if (!access) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  if (!isValidId(eventId) || !isValidId(lineId)) return { error: t("unknownVendorSlot") };
  const mode = String(formData.get("mode") ?? "amount");
  const raw = String(formData.get("value") ?? "");
  const fixedAmountCents = mode === "amount" ? parseAmountToCents(raw) : null;
  const percentageBasisPoints = mode === "percent" ? basisPointsFrom(raw) : null;
  if (fixedAmountCents === undefined || percentageBasisPoints === undefined || (fixedAmountCents === null && percentageBasisPoints === null)) return { error: t("paymentAmountInvalid") };
  try {
    await addVendorPayment({
      organizationId: access.organizationId,
      eventId,
      lineId,
      label: String(formData.get("label") ?? ""),
      fixedAmountCents,
      percentageBasisPoints,
      dueOn: String(formData.get("dueOn") ?? ""),
      changedByUserId: access.userId,
    });
  } catch (error) {
    if (error instanceof VendorPaymentInvalidError) return { error: t(error.reason === "label" ? "paymentLabelRequired" : error.reason === "date" ? "paymentDateInvalid" : "paymentAmountInvalid") };
    if (error instanceof BudgetLineNotFoundError) return { error: t("unknownVendorSlot") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}

// Payée ce jour (date saisie) ; date vide : le paiement est annulé.
export async function setVendorPaymentPaidAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return;
  const paidOn = String(formData.get("paidOn") ?? "").trim() || null;
  await setVendorPaymentPaid({ organizationId: access.organizationId, eventId, paymentId, paidOn, changedByUserId: access.userId }).catch((error: unknown) => {
    if (!(error instanceof VendorPaymentNotFoundError) && !(error instanceof VendorPaymentInvalidError)) throw error;
  });
  refresh(eventId);
}

export async function removeVendorPaymentAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return;
  await removeVendorPayment({ organizationId: access.organizationId, eventId, paymentId, changedByUserId: access.userId }).catch((error: unknown) => {
    if (!(error instanceof VendorPaymentNotFoundError)) throw error;
  });
  refresh(eventId);
}
