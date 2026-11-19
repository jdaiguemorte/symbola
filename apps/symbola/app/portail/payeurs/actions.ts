"use server";

// Lot 43 (BUD-06, D8) — un des mariés règle ce que voit un payeur, depuis son lien (contrôle par le
// module : lien d'un client de l'évènement, rubrique « Budget », payeur du même évènement).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { currentLinkAccess } from "@/lib/link-session";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isValidId } from "@/app/devis/module-access";
import { EventPayerInvalidError, EventPayerNotFoundError, LinkBudgetAccessDeniedError, setLinkPayerVisibility } from "@/modules/budget/service";

export type PayerVisibilityState = { error?: string; success?: boolean };

export async function setPayerVisibilityAction(_prev: PayerVisibilityState, formData: FormData): Promise<PayerVisibilityState> {
  const t = await getTranslations("Payers");
  const access = await currentLinkAccess();
  if (!access || !(await isBudgetModuleEnabled(access.organizationId))) return { error: t("visibilityError") };
  const payerId = String(formData.get("payerId") ?? "");
  const visibility = String(formData.get("visibility") ?? "");
  if (!isValidId(payerId) || (visibility !== "share" && visibility !== "all")) return { error: t("visibilityError") };
  try {
    await setLinkPayerVisibility(access.organizationId, { linkId: access.linkId, payerId, ownShareOnly: visibility === "share" });
  } catch (error) {
    if (error instanceof LinkBudgetAccessDeniedError || error instanceof EventPayerNotFoundError || error instanceof EventPayerInvalidError) return { error: t("visibilityError") };
    throw error;
  }
  revalidatePath("/portail", "layout");
  return { success: true };
}
