"use client";

// PRD-BUD-01 — simulation du budget et répartition par poste. Lot 62c (UX-12, UX-13 ; décision D1) :
// la simulation est un formulaire en grille ; la répartition est une liste éditable (un poste par
// ligne, son montant à droite) avec un seul « Enregistrer la répartition », qui dit le nombre de
// postes modifiés, et « Annuler les modifications ». Plus de liste à puces ni de « Ajuster » par ligne.
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatAmountInput, type Locale } from "@symbola/i18n";
import { adjustEventBudgetItemsAction, simulateEventBudgetAction, type BudgetFormState } from "./actions";
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

  return (
    <>
      <form action={simulateAction} className="form-grid form-grid-3 budget-simulation-form">
        <input type="hidden" name="eventId" value={eventId} />
        <label>
          {t("totalAmount")}
          <input type="text" inputMode="decimal" name="totalAmount" defaultValue={formatAmountInput(budget ? budget.totalAmountCents : wantedBudgetCents, locale)} required />
        </label>
        <label>
          {t("guestCount")}
          <input type="number" name="guestCount" className="field-short" min={0} step={1} defaultValue={budget?.guestCount ?? ""} required />
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
        <div className="span-all row-wrap">
          {/* Sans simulation, « Simuler » est l'action de l'écran ; ensuite, un bouton secondaire. */}
          <button type="submit" className={budget ? "button-secondary" : "button-primary"} disabled={simulatePending || models.length === 0}>
            {t("simulate")}
          </button>
          {simulateState.error ? <p role="alert">{simulateState.error}</p> : null}
        </div>
      </form>

      {budget ? <AllocationList eventId={eventId} budget={budget} locale={locale} vendorSlots={vendorSlots} /> : null}
    </>
  );
}

// Un poste dont la saisie égale le montant enregistré ne compte pas : après l'enregistrement ou une
// simulation refaite, la liste repart des montants du serveur.
function AllocationList({ eventId, budget, locale, vendorSlots }: { eventId: string; budget: EventBudgetView; locale: Locale; vendorSlots: DefaultVendorSlot[] }) {
  const t = useTranslations("Budget");
  const saved = Object.fromEntries(budget.items.map((item) => [item.defaultVendorSlotId, formatAmountInput(item.amountCents, locale)]));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; line?: string } | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = budget.items.filter((item) => drafts[item.defaultVendorSlotId] !== undefined && drafts[item.defaultVendorSlotId]!.trim() !== saved[item.defaultVendorSlotId]);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await adjustEventBudgetItemsAction({ eventId, items: changed.map((item) => ({ defaultVendorSlotId: item.defaultVendorSlotId, amount: drafts[item.defaultVendorSlotId]! })) });
      if (!result.ok) return setError({ message: result.error, ...(result.line ? { line: result.line } : {}) });
      setDrafts({});
      setDone(result.count);
    });

  return (
    <section aria-labelledby="allocation-title" className="budget-allocation">
      <h3 id="allocation-title">{t("itemsTitle")}</h3>
      <div className="edit-list allocation-table" role="table" aria-labelledby="allocation-title">
        <div className="edit-list-head allocation-cols" role="row">
          <span role="columnheader">{t("allocationSlot")}</span>
          <span role="columnheader" className="num">
            {t("allocationAmount")}
          </span>
        </div>
        {budget.items.map((item) => {
          const slot = vendorSlots.find((candidate) => candidate.id === item.defaultVendorSlotId);
          const fieldId = `repartition-${item.defaultVendorSlotId}`;
          const isChanged = changed.includes(item);
          return (
            <div key={item.defaultVendorSlotId} className="edit-row allocation-cols" role="row">
              <span role="cell" className="allocation-slot">
                <label htmlFor={fieldId}>{slot?.label ?? item.defaultVendorSlotId}</label>
                {isChanged ? <span className="badge badge-ambre">{t("lineChanged")}</span> : null}
              </span>
              <span role="cell">
                <input
                  id={fieldId}
                  type="text"
                  inputMode="decimal"
                  className="field-amount"
                  aria-invalid={error?.line === item.defaultVendorSlotId ? true : undefined}
                  value={drafts[item.defaultVendorSlotId] ?? saved[item.defaultVendorSlotId] ?? ""}
                  onChange={(event) => {
                    setDone(null);
                    setDrafts({ ...drafts, [item.defaultVendorSlotId]: event.target.value });
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="notice notice-error">
          {error.message}
        </p>
      ) : null}
      {changed.length > 0 ? (
        <div className="edit-bar">
          <p role="status">{t("allocationPending", { count: changed.length })}</p>
          <div className="row-wrap">
            <button
              type="button"
              className="button-secondary"
              disabled={pending}
              onClick={() => {
                setDrafts({});
                setError(null);
              }}
            >
              {t("cancelChanges")}
            </button>
            <button type="button" className="button-primary" disabled={pending} onClick={save}>
              {t("allocationSave")}
            </button>
          </div>
        </div>
      ) : done !== null ? (
        <p role="status" className="notice">
          {t("allocationSaved", { count: done })}
        </p>
      ) : null}
    </section>
  );
}
