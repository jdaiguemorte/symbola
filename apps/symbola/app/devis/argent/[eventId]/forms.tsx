"use client";

// Lot 48b (BUD-08, PRE-07 ; D6, D8) — formulaires des honoraires et des commissions.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addCommissionAction, issueCommissionInvoiceAction, savePlannerFeeAction, type MoneyFormState } from "./actions";

type FeeTerms = { kind: "flat" | "percent" | "mixed"; flat: string; percent: string; base: "estimated" | "committed" } | null;

export function PlannerFeeForm({ eventId, terms }: { eventId: string; terms: FeeTerms }) {
  const t = useTranslations("PlannerMoney");
  const [state, action, pending] = useActionState<MoneyFormState, FormData>(savePlannerFeeAction, {});
  const [kind, setKind] = useState<string>(terms?.kind ?? "none");
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("feeKind")}
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="none">{t("feeKindNone")}</option>
          <option value="flat">{t("feeKindFlat")}</option>
          <option value="percent">{t("feeKindPercent")}</option>
          <option value="mixed">{t("feeKindMixed")}</option>
        </select>
      </label>
      {kind === "flat" || kind === "mixed" ? (
        <label>
          {t("feeFlat")}
          <input name="flat" inputMode="decimal" defaultValue={terms?.flat ?? ""} required />
        </label>
      ) : null}
      {kind === "percent" || kind === "mixed" ? (
        <>
          <label>
            {t("feePercent")}
            <input name="percent" inputMode="decimal" defaultValue={terms?.percent ?? ""} required />
          </label>
          <label>
            {t("feeBase")}
            <select name="base" defaultValue={terms?.base ?? "estimated"}>
              <option value="estimated">{t("feeBaseEstimated")}</option>
              <option value="committed">{t("feeBaseCommitted")}</option>
            </select>
          </label>
        </>
      ) : null}
      <button type="submit" disabled={pending}>
        {t("feeSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("feeSaved")}</p> : null}
    </form>
  );
}

export function AddCommissionForm({ eventId, vendors, professional }: { eventId: string; vendors: { id: string | null; name: string }[]; professional: boolean }) {
  const t = useTranslations("PlannerMoney");
  const [state, action, pending] = useActionState<MoneyFormState, FormData>(addCommissionAction, {});
  const [mode, setMode] = useState("amount");
  return (
    <form action={action} className="stack" key={state.success ? "added" : "form"}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("commissionVendor")}
        <select name="vendor" required>
          {vendors.map((vendor) => (
            <option key={`${vendor.id ?? ""}|${vendor.name}`} value={`${vendor.id ?? ""}|${vendor.name}`}>
              {vendor.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("commissionNature")}
        <select name="nature" defaultValue="commission">
          <option value="commission">{t("natureCommission")}</option>
          <option value="referral">{t("natureReferral")}</option>
        </select>
      </label>
      <label>
        {t("commissionMode")}
        <select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="amount">{t("commissionModeAmount")}</option>
          <option value="percent">{t("commissionModePercent")}</option>
        </select>
      </label>
      {mode === "amount" ? (
        <label>
          {t("commissionAmount")}
          <input name="amount" inputMode="decimal" required />
        </label>
      ) : (
        <>
          <label>
            {t("commissionPercent")}
            <input name="percent" inputMode="decimal" required />
          </label>
          <label>
            {t("commissionBase")}
            <input name="base" inputMode="decimal" required />
          </label>
        </>
      )}
      {professional ? (
        <label className="checkbox">
          <input type="checkbox" name="shownToClient" defaultChecked />
          {t("commissionShown")}
        </label>
      ) : (
        <p className="muted">{t("commissionsIndividual")}</p>
      )}
      <button type="submit" disabled={pending}>
        {t("commissionAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("commissionAdded")}</p> : null}
    </form>
  );
}

export function IssueCommissionInvoiceForm({ eventId, commissionId, vendorName }: { eventId: string; commissionId: string; vendorName: string }) {
  const t = useTranslations("PlannerMoney");
  const [state, action, pending] = useActionState<MoneyFormState, FormData>(issueCommissionInvoiceAction, {});
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="commissionId" value={commissionId} />
      <button type="submit" disabled={pending}>
        {t("invoiceIssue", { vendor: vendorName })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("invoiceIssued")}</p> : null}
    </form>
  );
}
