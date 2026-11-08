"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, formatAmountInput, type Locale } from "@symbola/i18n";
import { adjustEventBudgetItemAction, simulateEventBudgetAction, type BudgetFormState } from "./actions";
import type { AllocationModel, EventBudgetView } from "@/modules/budget/service";
import type { DefaultVendorSlot } from "@/modules/events/service";

export function BudgetSimulationForm({
  eventId,
  models,
  budget,
  locale,
  vendorSlots,
  wantedBudgetCents = null,
}: {
  eventId: string;
  models: AllocationModel[];
  budget: EventBudgetView | null;
  locale: Locale;
  vendorSlots: DefaultVendorSlot[];
  // Lot 14 (décision K) : budget souhaité des clients, proposé comme total.
  wantedBudgetCents?: number | null;
}) {
  const t = useTranslations("Budget");
  const initialState: BudgetFormState = {};
  const [simulateState, simulateAction, simulatePending] = useActionState(simulateEventBudgetAction, initialState);
  const [adjustState, adjustAction, adjustPending] = useActionState(adjustEventBudgetItemAction, initialState);

  return (
    <>
      <form action={simulateAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <h2>{t("simulationTitle")}</h2>
        <label>
          {t("totalAmount")}
          <input type="text" inputMode="decimal" name="totalAmount" defaultValue={formatAmountInput(budget ? budget.totalAmountCents : wantedBudgetCents, locale)} required />
        </label>
        <label>
          {t("guestCount")}
          <input type="number" name="guestCount" min={0} step={1} defaultValue={budget?.guestCount ?? ""} required />
        </label>
        <label>
          {t("allocationModel")}
          <select name="allocationModelId" defaultValue={budget?.allocationModelId ?? ""} required>
            <option value="" disabled>
              {t("chooseModel")}
            </option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={simulatePending || models.length === 0}>
          {t("simulate")}
        </button>
        {simulateState.error ? <p role="alert">{simulateState.error}</p> : null}
      </form>

      {budget ? (
        <section>
          <h2>{t("itemsTitle")}</h2>
          <ul>
            {budget.items.map((item) => {
              const slot = vendorSlots.find((candidate) => candidate.id === item.defaultVendorSlotId);
              return (
                <li key={item.defaultVendorSlotId}>
                  <form action={adjustAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="defaultVendorSlotId" value={item.defaultVendorSlotId} />
                    <label>
                      {slot?.label ?? item.defaultVendorSlotId}
                      <input type="text" inputMode="decimal" name="amount" defaultValue={formatAmountInput(item.amountCents, locale)} />
                    </label>
                    <span>{formatAmount(item.amountCents, locale)}</span>
                    <button type="submit" disabled={adjustPending}>
                      {t("adjust")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          {adjustState.error ? <p role="alert">{adjustState.error}</p> : null}
        </section>
      ) : null}
    </>
  );
}
