"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  CatalogItemNotFoundError,
  archiveCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  type CatalogItemInput,
} from "@/modules/quotes/service";
import { parseDecimal } from "../decimal-input";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";

export type CatalogFormState = { error?: string; success?: boolean };

function readItem(formData: FormData): CatalogItemInput | "invalid_price" | "invalid_rate" | "missing_label" {
  const label = String(formData.get("label") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  if (!label || !unit) return "missing_label";
  const unitPriceCents = parseDecimal(String(formData.get("unitPrice") ?? ""), 2);
  if (unitPriceCents === null) return "invalid_price";
  const vatRateBasisPoints = parseDecimal(String(formData.get("vatRate") ?? "0"), 2);
  if (vatRateBasisPoints === null || vatRateBasisPoints > 10000) return "invalid_rate";
  return {
    label,
    unit,
    unitPriceCents,
    vatRateBasisPoints,
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
  };
}

const ERROR_KEYS = {
  invalid_price: "invalidPrice",
  invalid_rate: "invalidVatRate",
  missing_label: "missingLabelOrUnit",
} as const;

export async function saveCatalogItemAction(_prevState: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };

  const item = readItem(formData);
  if (typeof item === "string") return { error: t(ERROR_KEYS[item]) };

  const itemId = String(formData.get("itemId") ?? "");
  try {
    if (itemId) {
      if (!isValidId(itemId)) return { error: t("catalogItemNotFound") };
      await updateCatalogItem(planner.organizationId, itemId, item);
    } else {
      await createCatalogItem(planner.organizationId, item);
    }
  } catch (error) {
    if (error instanceof CatalogItemNotFoundError) return { error: t("catalogItemNotFound") };
    if (error instanceof RangeError) return { error: t("invalidPrice") };
    throw error;
  }
  revalidatePath("/devis/catalogue");
  return { success: true };
}

export async function archiveCatalogItemAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(itemId)) return;
  await archiveCatalogItem(planner.organizationId, itemId);
  revalidatePath("/devis/catalogue");
}
