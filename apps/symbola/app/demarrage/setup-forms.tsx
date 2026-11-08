"use client";

// Lot 12 (ONB-03) — formulaires de l'assistant de démarrage. Chaque saisie
// dit qu'elle est enregistrée (ONB-04).
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { DefaultVendorSlot } from "@/modules/events/service";
import type { LegalForm, Metier, OrganizationProfile } from "@/modules/hub/service";
import { BudgetLineIcon, ICON_KEYS } from "@/app/budget-line-icon";
import {
  addBudgetLineAction,
  addLossReasonAction,
  addSourceAction,
  saveActivityAction,
  saveCompanyAction,
  saveVatAction,
  updateBudgetLineAction,
  type SetupFormState,
} from "./actions";

const LEGAL_FORMS: LegalForm[] = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"];

function Feedback({ state }: { state: SetupFormState }) {
  const t = useTranslations("Setup");
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success)
    return (
      <p role="status" className="saved">
        {t("saved")}
      </p>
    );
  return null;
}

// Lot 16 (ADR 0045) : types d'événement proposés, dans l'ordre de chaque métier.
export type EventTypeOption = { key: string; label: string };

export function ActivityForm({
  metier,
  precision,
  eventTypeOptions,
  chosenEventTypes,
}: {
  metier: Metier | null;
  precision: string | null;
  eventTypeOptions: Record<"wedding_planner" | "event_agency", EventTypeOption[]>;
  // Types déjà installés (retour sur l'étape) ; nul : tous cochés.
  chosenEventTypes: string[] | null;
}) {
  const t = useTranslations("Setup");
  const [state, action, pending] = useActionState(saveActivityAction, {});
  const [choice, setChoice] = useState<Metier | "">(metier ?? "");
  const options = eventTypeOptions[choice === "wedding_planner" || choice === "" ? "wedding_planner" : "event_agency"];
  return (
    <form action={action} className="stack">
      <fieldset className="choice-cards">
        <legend>{t("metierQuestion")}</legend>
        {(["wedding_planner", "event_agency", "autre"] as const).map((value) => (
          <label key={value} className="choice-card">
            <input type="radio" name="metier" value={value} checked={choice === value} onChange={() => setChoice(value)} required />
            <span>
              <strong>{t(`metier.${value}.title`)}</strong>
              <span className="muted">{t(`metier.${value}.body`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {choice === "autre" ? (
        <label>
          {t("metierPrecision")}
          <input type="text" name="metierPrecision" defaultValue={precision ?? ""} />
        </label>
      ) : null}
      {/* Lot 16 (ADR 0045) : les types cochés sont installés ; le mariage décide
          aussi des types de prestataires propres au mariage. */}
      <fieldset>
        <legend>{t("eventTypesQuestion")}</legend>
        {options.map((option) => (
          <label key={option.key}>
            <input type="checkbox" name="eventTypes" value={option.key} defaultChecked={chosenEventTypes === null || chosenEventTypes.includes(option.key)} />
            {option.label}
          </label>
        ))}
        <p className="muted">{t("eventTypesHint")}</p>
      </fieldset>
      <p className="muted">{t("activityHint")}</p>
      <button type="submit" className="primary-button" disabled={pending}>
        {t("validateAndContinue")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CompanyForm({ profile }: { profile: OrganizationProfile }) {
  const t = useTranslations("Setup");
  const [state, action, pending] = useActionState(saveCompanyAction, {});
  return (
    <form action={action} className="stack">
      <label>
        {t("legalForm")}
        <select name="legalForm" defaultValue={profile.legalForm ?? ""} required>
          <option value="" disabled>
            {t("choose")}
          </option>
          {LEGAL_FORMS.map((form) => (
            <option key={form} value={form}>
              {t(`legalForms.${form}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("siren")}
        <input type="text" name="siren" inputMode="numeric" defaultValue={profile.siren ?? ""} />
      </label>
      <label>
        {t("address")}
        <textarea name="address" rows={2} defaultValue={profile.address ?? ""} />
      </label>
      <p className="muted">{t("companyHint")}</p>
      <button type="submit" className="primary-button" disabled={pending}>
        {t("validateAndContinue")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function VatForm({ regime }: { regime: "franchise" | "assujetti" | null }) {
  const t = useTranslations("Setup");
  const [state, action, pending] = useActionState(saveVatAction, {});
  return (
    <form action={action} className="stack">
      <fieldset className="choice-cards">
        <legend>{t("vatQuestion")}</legend>
        {(["franchise", "assujetti"] as const).map((value) => (
          <label key={value} className="choice-card">
            <input type="radio" name="vatRegime" value={value} defaultChecked={(regime ?? "franchise") === value} />
            <span>
              <strong>{t(`vat.${value}.title`)}</strong>
              <span className="muted">{t(`vat.${value}.body`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="primary-button" disabled={pending}>
        {t("validateAndContinue")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function BudgetLineForm({ line }: { line: DefaultVendorSlot }) {
  const t = useTranslations("Setup");
  const [state, action, pending] = useActionState(updateBudgetLineAction, {});
  const [icon, setIcon] = useState(line.icon ?? "");
  return (
    <form action={action} className="line-form">
      <input type="hidden" name="id" value={line.id} />
      <BudgetLineIcon icon={icon || null} label={line.label} decorative />
      <label>
        <span className="sr-only">{t("lineName", { line: line.label })}</span>
        <input type="text" name="label" defaultValue={line.label} required aria-label={t("lineName", { line: line.label })} />
      </label>
      <label>
        <span className="sr-only">{t("lineIcon", { line: line.label })}</span>
        <select name="icon" value={icon} onChange={(event) => setIcon(event.target.value)} aria-label={t("lineIcon", { line: line.label })}>
          <option value="">{t("iconNone")}</option>
          {ICON_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`icons.${key}`)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} aria-label={t("saveLine", { line: line.label })}>
        {t("save")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function AddForm({ action, label, button }: { action: typeof addBudgetLineAction; label: string; button: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline-add">
      <label>
        {label}
        <input type="text" name="label" required />
      </label>
      <button type="submit" disabled={pending}>
        {button}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function AddBudgetLineForm() {
  const t = useTranslations("Setup");
  return <AddForm action={addBudgetLineAction} label={t("newLine")} button={t("add")} />;
}

export function AddSourceForm() {
  const t = useTranslations("Setup");
  return <AddForm action={addSourceAction} label={t("newSource")} button={t("add")} />;
}

export function AddLossReasonForm() {
  const t = useTranslations("Setup");
  return <AddForm action={addLossReasonAction} label={t("newLossReason")} button={t("add")} />;
}
