// Lot 28a (BUD-02) — la répartition du budget. Lot 74g (§ 7.1) : avec le module Évènements, elle est le
// second bloc de « Budget : postes de départ et répartition » (/events/parametres#repartition), où cette
// adresse mène ; sans lui, elle reste la rubrique, sous le même titre.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { PageTour } from "@/app/page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { BUDGET_ALLOCATION_ANCHOR } from "@/app/settings-menu";
import { isBudgetModuleEnabled } from "../module-access";
import { AllocationBlock } from "./allocation-block";

export default async function BudgetSettingsPage({ searchParams }: { searchParams: Promise<{ visite?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Budget");
  const tHelp = await getTranslations("Help");
  const tMenu = await getTranslations("SettingsMenu");
  const title = tMenu("rubrics.budget.label");

  if (!(await isBudgetModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{title}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const { visite } = await searchParams;
  if (await isEventsModuleEnabled(organizationId)) redirect(`/events/parametres${visite ? `?visite=${encodeURIComponent(visite)}` : ""}#${BUDGET_ALLOCATION_ANCHOR}`);

  return (
    <main>
      <h1>{title}</h1>
      <PageTour {...await loadPageTour(auth.user.id, "budget", visite)} helpTitle={title} helpBody={tHelp("budgetSettings.body")} />
      <div id={BUDGET_ALLOCATION_ANCHOR} className="settings-fused-block">
        <AllocationBlock organizationId={organizationId} heading="h2" />
      </div>
    </main>
  );
}
