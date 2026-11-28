"use client";

// Lot 48a (PRE-05) — formulaires des réglages des pièces.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import type { VendorDocumentKind } from "@symbola/contracts";
import { addDocumentKindAction, saveDocumentAlertDaysAction, saveDocumentKindUsageAction, type DocumentSettingsState } from "./actions";

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

// Lot 73d (P3, P4, D7) : le nom court et « Demandée d'habitude » d'une nature, enregistrés seuls.
export function KindUsageForm({ kind }: { kind: VendorDocumentKind }) {
  const t = useTranslations("VendorDocumentSettings");
  const ids = { short: useId(), usual: useId() };
  const [state, action, pending] = useActionState<DocumentSettingsState, FormData>(saveDocumentKindUsageAction, {});
  return (
    <form action={action} className="vendor-filters" aria-label={t("usageFor", { kind: kind.label })}>
      <input type="hidden" name="kindId" value={kind.id} />
      <label>
        {t("shortLabel")}
        <input name="shortLabel" maxLength={40} defaultValue={kind.shortLabel ?? ""} placeholder={t("shortLabelPlaceholder")} aria-describedby={ids.short} />
        <span id={ids.short} className="field-hint">
          {t("shortLabelHint")}
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="requestedByDefault" defaultChecked={kind.requestedByDefault} aria-describedby={ids.usual} />
        {t("requestedByDefault")}
      </label>
      <span id={ids.usual} className="field-hint">
        {t("requestedByDefaultHint")}
      </span>
      <button type="submit" className="button-secondary" disabled={pending}>
        {t("usageSave", { kind: kind.shortLabel ?? kind.label })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("usageSaved")}</p> : null}
    </form>
  );
}
