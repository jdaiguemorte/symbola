// PRD-EVT-03 / L12-EVT-17, refait au lot 13 (L13-HUB-16) — rubrique « Lignes du budget »
// des Paramètres : tableau aligné (icône, ligne, actions) ; ajouter ou
// modifier une ligne ouvre le panneau latéral (?ligne=nouvelle ou ?ligne=id).
// Lot 74g (§ 7.1) : « Budget : postes de départ et répartition », une rubrique, deux blocs : les postes de
// chaque nouveau mariage (module Évènements, la titulaire les change) et, avec le module Budget, leur
// part dans l'enveloppe (#repartition), où mène /budget/parametres. Le patron vient au lot 74i.
import { ScreenMain } from "@/app/ui/screen-main";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../module-access";
import { LoadStarterVendorSlotsForm } from "./default-vendor-slot-forms";
import { AddBudgetLineForm, EditBudgetLineForm } from "./budget-line-panel-forms";
import { SortableBudgetLines } from "./sortable-budget-lines";
import { SidePanel } from "@/app/ui/side-panel";
import { PageTour } from "@/app/page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { BUDGET_ALLOCATION_ANCHOR } from "@/app/settings-menu";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { AllocationBlock } from "@/app/budget/parametres/allocation-block";

const BASE = "/events/parametres";

export default async function EventsSettingsPage({ searchParams }: { searchParams: Promise<{ ligne?: string; visite?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  const tMenu = await getTranslations("SettingsMenu");
  const tBudget = await getTranslations("Budget");
  const title = tMenu("rubrics.budget.label");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <ScreenMain>
        <h1>{title}</h1>
        <p>{t("moduleUnavailable")}</p>
      </ScreenMain>
    );
  }
  const { ligne, visite } = await searchParams;
  const budget = await isBudgetModuleEnabled(organizationId);
  const lines = await listDefaultVendorSlots(organizationId);
  const isOwner = auth.user.role === "owner";
  const editing = isOwner && ligne && ligne !== "nouvelle" ? lines.find((line) => line.id === ligne) : undefined;
  const adding = ligne === "nouvelle";

  return (
    <ScreenMain>
      <h1>{title}</h1>
      {/* Avec le module Budget, la visite guidée de la répartition (lot 63f) porte aussi l'aide de l'écran. */}
      {budget ? (
        <PageTour {...await loadPageTour(auth.user.id, "budget", visite)} helpTitle={tHelp("eventsSettings.title")} helpBody={`${tHelp("eventsSettings.body")} ${tHelp("budgetSettings.body")}`} />
      ) : (
        <ScreenHelp title={tHelp("eventsSettings.title")} body={tHelp("eventsSettings.body")} />
      )}
      <section aria-labelledby="postes-title" className="settings-block">
      <div className="section-head">
        <h2 id="postes-title">{t("defaultVendorSlotsTitle")}</h2>
        <Link href={`${BASE}?ligne=nouvelle`} scroll={false} className="button-link button-link-primary">
          {t("addBudgetLineButton")}
        </Link>
      </div>
      <p>{t("defaultVendorSlotsIntro")}</p>
      {lines.length > 1 ? <p className="muted">{t("defaultVendorSlotsReorderHint")}</p> : null}

      {lines.length === 0 ? (
        <p>{t("noDefaultVendorSlots")}</p>
      ) : (
        <SortableBudgetLines
          lines={lines.map((line) => ({ id: line.id, label: line.label, icon: line.icon }))}
          isOwner={isOwner}
          base={BASE}
          editingId={editing?.id ?? null}
        />
      )}
      {/* Toujours au même endroit : son message de succès survit à l'apparition du tableau. */}
      <LoadStarterVendorSlotsForm />
      </section>
      {budget ? (
        <section id={BUDGET_ALLOCATION_ANCHOR} aria-labelledby="repartition-title" className="settings-block">
          <h2 id="repartition-title">{tBudget("settingsTitle")}</h2>
          <AllocationBlock organizationId={organizationId} heading="h3" />
        </section>
      ) : null}

      {editing ? (
        <SidePanel title={t("editBudgetLine", { label: editing.label })} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <EditBudgetLineForm key={editing.id} line={editing} />
        </SidePanel>
      ) : null}
      {adding ? (
        <SidePanel title={t("addBudgetLineTitle")} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <AddBudgetLineForm />
        </SidePanel>
      ) : null}
    </ScreenMain>
  );
}
