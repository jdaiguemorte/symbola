"use client";

// Lot 53 (HUB-24 ; D8) — le terme d'un type, dans une langue : un terme proposé ou un terme libre court,
// avec son genre et son nombre.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ClientTerm } from "@symbola/contracts";
import { saveClientTermAction, type ClientTermFormState } from "./actions";

export function ClientTermForm({ eventTypeId, typeLabel, locale, current, fallback, suggestions }: { eventTypeId: string; typeLabel: string; locale: "fr" | "en"; current: ClientTerm | null; fallback: ClientTerm; suggestions: ClientTerm[] }) {
  const t = useTranslations("ClientTerms");
  const [state, formAction, pending] = useActionState<ClientTermFormState, FormData>(saveClientTermAction, {});
  const value = current ?? fallback;
  const listId = `client-terms-${eventTypeId}-${locale}`;
  return (
    <form action={formAction} className="client-term-form" aria-label={`${typeLabel} — ${locale.toUpperCase()}`}>
      <input type="hidden" name="eventTypeId" value={eventTypeId} />
      <input type="hidden" name="locale" value={locale} />
      <div className="form-row">
        <label>
          {t("term")} ({locale.toUpperCase()})
          <input type="text" name="term" maxLength={40} required defaultValue={value.term} list={listId} />
          <datalist id={listId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion.term} value={suggestion.term} />
            ))}
          </datalist>
        </label>
        <label>
          {t("gender")}
          <select name="gender" defaultValue={value.gender}>
            {(["masculine", "feminine", "neuter"] as const).map((gender) => (
              <option key={gender} value={gender}>
                {t(`genderValue.${gender}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("number")}
          <select name="number" defaultValue={value.number}>
            {(["singular", "plural"] as const).map((number) => (
              <option key={number} value={number}>
                {t(`numberValue.${number}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {current ? null : <p className="field-hint">{t("default", { term: fallback.term })}</p>}
      <div className="button-row">
        <button type="submit" disabled={pending}>
          {t("save")}
        </button>
        {current ? (
          <button type="submit" name="reset" value="true" className="button-secondary" disabled={pending}>
            {t("reset")}
          </button>
        ) : null}
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
