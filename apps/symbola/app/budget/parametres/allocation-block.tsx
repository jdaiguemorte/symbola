// Lot 28a (BUD-02) — le seuil d'alerte de l'enveloppe et les modèles de répartition. Lot 74g (§ 7.1) : le
// second bloc de la rubrique « Budget : postes de départ et répartition » (/events/parametres#repartition,
// ou /budget/parametres sans le module Évènements), formulaires inchangés.
import { getLocale, getTranslations } from "next-intl/server";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { getBudgetAlertSettings, listAllocationModels } from "@/modules/budget/service";
import { AllocationModelForm } from "./allocation-model-form";
import { AlertThresholdForm } from "./alert-threshold-form";
import { removeAllocationModelAction } from "./actions";

export async function AllocationBlock({ organizationId, heading }: { organizationId: string; heading: "h2" | "h3" }) {
  const t = await getTranslations("Budget");
  const Heading = heading;
  const percent = new Intl.NumberFormat((await getLocale()) === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 2 });
  const [models, vendorSlots, alertSettings] = await Promise.all([listAllocationModels(organizationId), listDefaultVendorSlots(organizationId), getBudgetAlertSettings(organizationId)]);

  return (
    <>
      {/* Lot 28a (BUD-02) : seuil d'alerte de l'enveloppe. Lot 62b (UX-12) : une carte par sujet. */}
      <section className="card" aria-labelledby="budget-threshold">
        <Heading id="budget-threshold" data-tour="budget-threshold">
          {t("thresholdTitle")}
        </Heading>
        <p className="field-hint">{t("thresholdIntro")}</p>
        <AlertThresholdForm percent={alertSettings.organizationPercent} />
      </section>
      <section className="card" aria-labelledby="budget-models">
        <Heading id="budget-models" data-tour="budget-models">
          {t("modelsTitle")}
        </Heading>
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
                        return `${slot?.label ?? item.defaultVendorSlotId} ${percent.format(item.percentageBasisPoints / 100)} %`;
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
      {vendorSlots.length === 0 ? <p role="status">{t("noVendorSlotsYet")}</p> : <AllocationModelForm vendorSlots={vendorSlots} />}
    </>
  );
}
