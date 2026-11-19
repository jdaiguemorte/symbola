"use server";

// Lot 48b (BUD-08 ; D6, ADR 0093) — « Ajouter les honoraires au devis » : la ligne d'honoraires, au
// montant calculé depuis le budget de l'évènement, sur le brouillon. Session, organisation, module.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addPlannerFeeLine, getPlannerFeeTerms, getQuote } from "@/modules/quotes/service";
import { plannerFeeAmount } from "@/lib/money/planner-fees";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";

export async function addPlannerFeeLineAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!planner || !isValidId(quoteId)) return;
  const quote = await getQuote(planner.organizationId, quoteId).catch(() => null);
  const terms = quote ? await getPlannerFeeTerms(planner.organizationId, quote.eventId) : null;
  if (!quote || !terms) return;
  const t = await getTranslations("PlannerMoney");
  const amountCents = await plannerFeeAmount(planner.organizationId, quote.eventId, terms);
  if (amountCents <= 0) return;
  await addPlannerFeeLine(planner.organizationId, quoteId, { label: t("feeLineLabel"), amountCents });
  revalidatePath(`/devis/${quoteId}`);
}
