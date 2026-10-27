"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
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

export type BudgetFormState = { error?: string };

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isBudgetModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function simulateEventBudgetAction(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const eventId = String(formData.get("eventId") ?? "");
  const totalAmount = Number(String(formData.get("totalAmount") ?? "").trim());
  const guestCount = Number(String(formData.get("guestCount") ?? "").trim());
  const allocationModelId = String(formData.get("allocationModelId") ?? "").trim();

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return { error: t("invalidTotalAmount") };
  if (!Number.isInteger(guestCount) || guestCount < 0) return { error: t("invalidGuestCount") };
  if (!allocationModelId) return { error: t("missingModel") };

  try {
    await simulateEventBudget({
      organizationId,
      eventId,
      totalAmountCents: Math.round(totalAmount * 100),
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
  const field = String(formData.get("field") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());

  if (field !== "planned" && field !== "actual") return { error: t("invalidAmount") };
  if (!Number.isFinite(amount) || amount < 0) return { error: t("invalidAmount") };

  try {
    await updateBudgetLine({
      organizationId,
      eventId,
      eventVendorSlotId,
      field,
      amountCents: Math.round(amount * 100),
      changedByUserId: auth.user.id,
    });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventVendorSlotNotFoundError) return { error: t("unknownVendorSlot") };
    throw error;
  }

  revalidatePath(`/budget/${eventId}`);
  return {};
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
  const amount = Number(String(formData.get("amount") ?? "").trim());

  if (!Number.isFinite(amount) || amount < 0) return { error: t("invalidAmount") };

  try {
    await adjustEventBudgetItem({
      organizationId,
      eventId,
      defaultVendorSlotId,
      amountCents: Math.round(amount * 100),
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
