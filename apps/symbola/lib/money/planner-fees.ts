// Lot 48b (BUD-08 ; D6, ADR 0093) — montant des honoraires de la planner pour un évènement : ses termes
// (module des devis) appliqués aux totaux du budget (module Budget), estimé ou engagé. Orchestration par
// les service.ts (ADR 0011) : le module Budget lit déjà celui des devis. Budget fermé : base nulle.
import { listBudgetLines } from "@/modules/budget/service";
import { plannerFeeCents, type PlannerFeeTerms } from "@/modules/quotes/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";

export async function plannerFeeAmount(organizationId: string, eventId: string, terms: PlannerFeeTerms): Promise<number> {
  const budget = (await isBudgetModuleEnabled(organizationId)) ? await listBudgetLines(organizationId, eventId) : null;
  return plannerFeeCents(terms, { estimatedCents: budget?.totalEstimatedCents ?? 0, committedCents: budget?.totalCommittedCents ?? 0 });
}
