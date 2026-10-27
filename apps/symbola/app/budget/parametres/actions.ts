"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { listDefaultVendorSlots } from "@/modules/events/service";
import {
  AllocationModelTotalInvalidError,
  DefaultVendorSlotNotFoundError,
  createAllocationModel,
  removeAllocationModel,
} from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isBudgetModuleEnabled } from "../module-access";

export type AllocationModelFormState = { error?: string; success?: boolean };

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isBudgetModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

// BUD-01 — le pourcentage de chaque poste arrive en champ texte
// "<defaultVendorSlotId>" ; un champ vide ou à 0 exclut le poste du
// modèle (pas d'erreur, simplement pas d'item créé pour ce poste).
export async function createAllocationModelAction(
  _prevState: AllocationModelFormState,
  formData: FormData,
): Promise<AllocationModelFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingName") };

  const slots = await listDefaultVendorSlots(organizationId);
  const items = slots
    .map((slot) => {
      const raw = String(formData.get(`percentage_${slot.id}`) ?? "").trim();
      const percent = raw ? Number(raw) : 0;
      return { defaultVendorSlotId: slot.id, percentageBasisPoints: Math.round(percent * 100) };
    })
    .filter((item) => item.percentageBasisPoints > 0);

  if (items.length === 0) return { error: t("missingItems") };

  try {
    await createAllocationModel({ organizationId, name, items });
  } catch (error) {
    if (error instanceof AllocationModelTotalInvalidError) return { error: t("totalNot100") };
    if (error instanceof DefaultVendorSlotNotFoundError) return { error: t("unknownVendorSlot") };
    throw error;
  }

  revalidatePath("/budget/parametres");
  return { success: true };
}

export async function removeAllocationModelAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;

  const modelId = String(formData.get("modelId") ?? "");
  await removeAllocationModel(organizationId, modelId);
  revalidatePath("/budget/parametres");
}
