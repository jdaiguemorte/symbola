import { getLocale, getTranslations } from "next-intl/server";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { getBudgetAlertSettings, listAllocationModels } from "@/modules/budget/service";
import { requirePlanner } from "@/lib/guards";
import { PageTour } from "@/app/page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { isBudgetModuleEnabled } from "../module-access";
import { AllocationModelForm } from "./allocation-model-form";
import { AlertThresholdForm } from "./alert-threshold-form";
import { removeAllocationModelAction } from "./actions";

export default async function BudgetSettingsPage({ searchParams }: { searchParams: Promise<{ visite?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Budget");
  const tHelp = await getTranslations("Help");

  if (!(await isBudgetModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const percent = new Intl.NumberFormat((await getLocale()) === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 2 });
  const [models, vendorSlots, alertSettings] = await Promise.all([
    listAllocationModels(organizationId),
    listDefaultVendorSlots(organizationId),
    getBudgetAlertSettings(organizationId),
  ]);

  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <PageTour
        {...await loadPageTour(auth.user.id, "budget", (await searchParams).visite)}
        helpTitle={tHelp("budgetSettings.title")}
        helpBody={tHelp("budgetSettings.body")}
      />

      {/* Lot 28a (BUD-02) : seuil d'alerte de l'enveloppe. Lot 62b (UX-12) : une carte par sujet. */}
      <section className="card" aria-labelledby="budget-threshold">
        <h2 id="budget-threshold">{t("thresholdTitle")}</h2>
        <p className="field-hint">{t("thresholdIntro")}</p>
        <AlertThresholdForm percent={alertSettings.organizationPercent} />
      </section>
      <section className="card" aria-labelledby="budget-models">
        <h2 id="budget-models" data-tour="budget-models">
          {t("modelsTitle")}
        </h2>
        {models.length === 0 ? (
          <p>{t("noModels")}</p>
        ) : (
          <div className="edit-list-scroll settings-list">
            <ul className="edit-list model-list">
              {models.map((model) => (
                <li key={model.id} className="edit-row">
                  <strong className="edit-cell-name">{model.name}</strong>
                  <span className="edit-cell-meta">
                    {model.items
                      .map((item) => {
                        const slot = vendorSlots.find((candidate) => candidate.id === item.defaultVendorSlotId);
                        return `${slot?.label ?? item.defaultVendorSlotId} ${percent.format(item.percentageBasisPoints / 100)} %`;
                      })
                      .join(" · ")}
                  </span>
                  <span className="row-actions">
                    <form action={removeAllocationModelAction}>
                      <input type="hidden" name="modelId" value={model.id} />
                      <button type="submit" className="button-ghost" aria-label={t("removeModel", { name: model.name })}>
                        {t("removeModelShort")}
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {vendorSlots.length === 0 ? (
        <p role="status">{t("noVendorSlotsYet")}</p>
      ) : (
        <AllocationModelForm vendorSlots={vendorSlots} />
      )}
    </main>
  );
}
