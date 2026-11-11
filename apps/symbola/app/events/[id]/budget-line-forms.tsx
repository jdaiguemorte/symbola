"use client";

// Lot 12 (L12-EVT-17 / L12-EVT-14) — dans l'onglet Budget de la fiche : prévu d'une
// ligne (sans passer par une répartition) et son icône.
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmountInput, type Locale } from "@symbola/i18n";
import { updateBudgetLineAction, type BudgetFormState } from "@/app/budget/[eventId]/actions";
import { BudgetLineIcon, ICON_KEYS } from "@/app/budget-line-icon";
import { setVendorSlotIconAction, type VendorSlotFormState } from "./vendor-slot-actions";

export function PlannedAmountForm({ eventId, slotId, label, plannedCents }: { eventId: string; slotId: string; label: string; plannedCents: number | null }) {
  const t = useTranslations("Events");
  const initial: BudgetFormState = {};
  const [state, action, pending] = useActionState(updateBudgetLineAction, initial);
  const locale = useLocale() as Locale;
  const [amount, setAmount] = useState(formatAmountInput(plannedCents, locale));
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventVendorSlotId" value={slotId} />
      <input type="hidden" name="field" value="planned" />
      <label>
        {t("plannedAmountFor", { line: label })}
        <input type="text" inputMode="decimal" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <button type="submit" disabled={pending}>
        {t("savePlanned")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("plannedSaved")}</p> : null}
    </form>
  );
}

export function SlotIconForm({ eventId, slotId, label, icon }: { eventId: string; slotId: string; label: string; icon: string | null }) {
  const t = useTranslations("Events");
  const tSetup = useTranslations("Setup");
  const initial: VendorSlotFormState = {};
  const [state, action, pending] = useActionState(setVendorSlotIconAction, initial);
  const [value, setValue] = useState(icon ?? "");
  return (
    <form action={action} className="line-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slotId} />
      <BudgetLineIcon icon={value || null} label={label} decorative />
      <label>
        {t("lineIconFor", { line: label })}
        <select name="icon" value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">{tSetup("iconNone")}</option>
          {ICON_KEYS.map((key) => (
            <option key={key} value={key}>
              {tSetup(`icons.${key}`)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("saveIcon")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("iconSaved")}</p> : null}
    </form>
  );
}
