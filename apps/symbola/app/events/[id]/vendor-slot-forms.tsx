"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { EventVendorSlot } from "@/modules/events/service";
import { addVendorSlotAction, updateVendorSlotAction, type VendorSlotFormState } from "./vendor-slot-actions";
import { VENDOR_STATUS_CLASSES, VENDOR_STATUS_LABEL_KEYS } from "./vendor-slot-status";

// Lot 28a (PRE-02) : le statut du poste se lit (celui de ses prestataires) ; le
// formulaire garde « Non requis » et le raccourci du prestataire retenu. Lot 28b
// (D10) : un poste peut avoir plusieurs prestataires retenus ; le raccourci en
// ajoute un (ou change le montant d'un retenu du même nom).
export function VendorSlotForm({ eventId, slot }: { eventId: string; slot: EventVendorSlot }) {
  const t = useTranslations("Events");
  const initialState: VendorSlotFormState = {};
  const [state, formAction, pending] = useActionState(updateVendorSlotAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque
  // action, une erreur ferait sinon perdre la saisie.
  const [notRequired, setNotRequired] = useState(slot.notRequired);
  const [vendorName, setVendorName] = useState("");
  const locale = useLocale() as Locale;
  const [amount, setAmount] = useState("");
  // Prestataire ajouté : le raccourci se vide pour le suivant.
  useEffect(() => {
    if (!state.success) return;
    setVendorName("");
    setAmount("");
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slot.id} />
      <fieldset>
        <legend>{slot.label}</legend>
        <p>
          {t("vendorSlotStatus")} <span className={VENDOR_STATUS_CLASSES[slot.status]}>{t(VENDOR_STATUS_LABEL_KEYS[slot.status])}</span>
        </p>
        {slot.retainedVendors.length > 0 ? (
          <p>
            {t("retainedVendors", { vendors: slot.retainedVendors.map((vendor) => (vendor.quoteAmountCents !== null ? `${vendor.vendorName} (${formatAmount(vendor.quoteAmountCents, locale)})` : vendor.vendorName)).join(", ") })}
          </p>
        ) : null}
        <label className="checkbox">
          <input type="checkbox" name="notRequired" checked={notRequired} onChange={(event) => setNotRequired(event.target.checked)} />
          {t("vendorSlotNotRequired")}
        </label>
        <label>
          {t("retainedVendorName")}
          <input
            type="text"
            name="vendorName"
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
          />
        </label>
        <label>
          {t("retainedVendorAmount")}
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
        {state.confirm ? (
          <div className="notice">
            <p role="alert">{state.confirm}</p>
            <button type="submit" name="confirmed" value="1">
              {t("confirmRetainedVendor", { vendor: vendorName })}
            </button>
          </div>
        ) : null}
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
