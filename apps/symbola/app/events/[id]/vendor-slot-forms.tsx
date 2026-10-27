"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventVendorSlot, VendorSlotStatus } from "@/modules/events/service";
import { addVendorSlotAction, updateVendorSlotAction, type VendorSlotFormState } from "./vendor-slot-actions";
import { VENDOR_STATUS_LABEL_KEYS } from "./vendor-slot-status";

// Montant affiché dans le champ de saisie, en euros (« 2500,50 »).
function amountInputValue(cents: number | null): string {
  if (cents === null) return "";
  const euros = Math.trunc(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
}

export function VendorSlotForm({ eventId, slot }: { eventId: string; slot: EventVendorSlot }) {
  const t = useTranslations("Events");
  const initialState: VendorSlotFormState = {};
  const [state, formAction, pending] = useActionState(updateVendorSlotAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque
  // action, une erreur ferait sinon perdre la saisie.
  const [status, setStatus] = useState<VendorSlotStatus>(slot.status);
  const [vendorName, setVendorName] = useState(slot.vendorName ?? "");
  const [amount, setAmount] = useState(amountInputValue(slot.amountCents));

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slot.id} />
      <fieldset>
        <legend>{slot.label}</legend>
        <label>
          {t("vendorSlotStatus")}
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as VendorSlotStatus)}
          >
            {(Object.keys(VENDOR_STATUS_LABEL_KEYS) as VendorSlotStatus[]).map((value) => (
              <option key={value} value={value}>
                {t(VENDOR_STATUS_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {status === "booked" ? t("vendorNameRequired") : t("vendorName")}
          <input
            type="text"
            name="vendorName"
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
          />
        </label>
        <label>
          {t("vendorAmount")}
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button type="submit" disabled={pending}>
          {t("saveVendorSlot")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("vendorSlotSaved")}</p> : null}
      </fieldset>
    </form>
  );
}

export function AddVendorSlotForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Events");
  const initialState: VendorSlotFormState = {};
  const [state, formAction, pending] = useActionState(addVendorSlotAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("newVendorSlotLabel")}
        <input type="text" name="label" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("addVendorSlot")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
