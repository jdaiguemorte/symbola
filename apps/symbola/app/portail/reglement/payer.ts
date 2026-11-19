// Lot 43 (BUD-06, D8) — le lien du payeur désigné d'une échéance de la planner (module Budget) : lui
// seul la déclare. Sans le module Budget, personne n'est désigné.
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { getInstalmentPayerLinkId } from "@/modules/budget/service";

export async function designatedPayerLink(organizationId: string, eventId: string, scheduleItemId: string): Promise<string | null> {
  if (!(await isBudgetModuleEnabled(organizationId))) return null;
  return getInstalmentPayerLinkId(organizationId, eventId, scheduleItemId);
}
