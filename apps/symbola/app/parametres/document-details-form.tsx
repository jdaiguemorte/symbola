"use client";

// Lot 17 (DEV-07) — coordonnées imprimées sur les devis et factures : SIRET,
// contact, site, numéro de TVA, immatriculation, capital d'une société.
import { useActionState, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatAmountInput, type Locale } from "@symbola/i18n";
import type { SellerDetails } from "@/modules/hub/service";
import { saveDocumentDetailsAction, type DocumentDetailsFormState } from "./actions";

export function DocumentDetailsForm({ details }: { details: SellerDetails }) {
  const t = useTranslations("Settings");
  const locale = useLocale() as Locale;
  const [state, formAction, pending] = useActionState<DocumentDetailsFormState, FormData>(saveDocumentDetailsAction, {});
  const ids = { registration: useId(), capital: useId() };

  return (
    <form action={formAction} aria-label={t("documentDetailsTitle")}>
      <label>
        {t("siret")}
        <input type="text" name="siret" inputMode="numeric" autoComplete="off" defaultValue={details.siret ?? ""} />
      </label>
      <label>
        {t("contactEmail")}
        <input type="email" name="contactEmail" autoComplete="email" defaultValue={details.contactEmail ?? ""} />
      </label>
      <label>
        {t("contactPhone")}
        <input type="tel" name="contactPhone" autoComplete="tel" defaultValue={details.contactPhone ?? ""} />
      </label>
      <label>
        {t("website")}
        <input type="text" name="website" inputMode="url" autoComplete="url" defaultValue={details.website ?? ""} />
      </label>
      <label>
        {t("vatNumber")}
        <input type="text" name="vatNumber" autoComplete="off" defaultValue={details.vatNumber ?? ""} />
      </label>
      <label>
        {t("registration")}
        <input type="text" name="registration" maxLength={120} aria-describedby={ids.registration} defaultValue={details.registration ?? ""} />
      </label>
      <p id={ids.registration} className="meta">
        {t("registrationHint")}
      </p>
      <label>
        {t("shareCapital")}
        <input
          type="text"
          name="shareCapital"
          inputMode="decimal"
          aria-describedby={ids.capital}
          defaultValue={formatAmountInput(details.shareCapitalCents, locale)}
        />
      </label>
      <p id={ids.capital} className="meta">
        {t("shareCapitalHint")}
      </p>
      <button type="submit" disabled={pending}>
        {t("documentDetailsSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("documentDetailsSaved")}</p> : null}
    </form>
  );
}
