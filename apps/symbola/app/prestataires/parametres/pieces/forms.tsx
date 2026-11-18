"use client";

// Lot 48a (PRE-05) — formulaires des réglages des pièces.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDocumentKindAction, saveDocumentAlertDaysAction, type DocumentSettingsState } from "./actions";

export function AlertDaysForm({ days }: { days: number }) {
  const t = useTranslations("VendorDocumentSettings");
  const [state, action, pending] = useActionState<DocumentSettingsState, FormData>(saveDocumentAlertDaysAction, {});
  return (
    <form action={action} className="vendor-filters">
      <label>
        {t("days")}
        <input type="number" name="days" min={1} max={180} defaultValue={days} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}

export function AddKindForm() {
  const t = useTranslations("VendorDocumentSettings");
  const [state, action, pending] = useActionState<DocumentSettingsState, FormData>(addDocumentKindAction, {});
  return (
    <form action={action} className="vendor-filters">
      <label>
        {t("kindLabel")}
        <input name="label" maxLength={120} required />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="expires" defaultChecked />
        {t("kindExpires")}
      </label>
      <button type="submit" disabled={pending}>
        {t("kindAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("kindAdded")}</p> : null}
    </form>
  );
}
