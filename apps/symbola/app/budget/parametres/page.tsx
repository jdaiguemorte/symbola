import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { listAllocationModels } from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isBudgetModuleEnabled } from "../module-access";
import { AllocationModelForm } from "./allocation-model-form";
import { removeAllocationModelAction } from "./actions";

export default async function BudgetSettingsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
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

  const [models, vendorSlots] = await Promise.all([
    listAllocationModels(organizationId),
    listDefaultVendorSlots(organizationId),
  ]);

  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <HelpButton title={tHelp("budgetSettings.title")} body={tHelp("budgetSettings.body")} />

      <h2>{t("modelsTitle")}</h2>
      {models.length === 0 ? <p>{t("noModels")}</p> : null}
      <ul>
        {models.map((model) => (
          <li key={model.id}>
            <strong>{model.name}</strong>
            <ul>
              {model.items.map((item) => {
                const slot = vendorSlots.find((candidate) => candidate.id === item.defaultVendorSlotId);
                return (
                  <li key={item.id}>
                    {slot?.label ?? item.defaultVendorSlotId} — {(item.percentageBasisPoints / 100).toFixed(2)} %
                  </li>
                );
              })}
            </ul>
            <form action={removeAllocationModelAction}>
              <input type="hidden" name="modelId" value={model.id} />
              <button type="submit">{t("removeModel", { name: model.name })}</button>
            </form>
          </li>
        ))}
      </ul>

      {vendorSlots.length === 0 ? (
        <p role="status">{t("noVendorSlotsYet")}</p>
      ) : (
        <AllocationModelForm vendorSlots={vendorSlots} />
      )}
    </main>
  );
}
