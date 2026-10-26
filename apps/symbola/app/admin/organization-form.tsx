"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createOrganizationAction, type CreateOrganizationFormState } from "./actions";

export function AdminOrganizationForm() {
  const t = useTranslations("AdminOrganizationForm");
  const initialState: CreateOrganizationFormState = {};
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("name")}
        <input type="text" name="name" required />
      </label>
      <label>
        {t("language")}
        <select name="language" defaultValue="fr">
          <option value="fr">{t("languageFr")}</option>
          <option value="en">{t("languageEn")}</option>
        </select>
      </label>
      <label>
        {t("siret")}
        <input type="text" name="siret" />
      </label>
      <label>
        {t("titulaireEmail")}
        <input type="email" name="titulaireEmail" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("submit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("success")}</p> : null}
    </form>
  );
}
