"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { BUDGET_AMOUNT_FIELDS, type BudgetAmountField } from "@symbola/contracts";
import { parseAmountToCents } from "@symbola/i18n";
import {
  AlertThresholdInvalidError,
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
import { isBudgetModuleEnabled } from "../module-access";

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
  const eventVendorSlotId = String(formData.get("eventVendorSlotId") ?? "");
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
      await updateBudgetLine({ organizationId, eventId, eventVendorSlotId, field: change.field, amountCents: change.amountCents, changedByUserId: auth.user.id });
    }
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventVendorSlotNotFoundError) return { error: t("unknownVendorSlot") };
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

