"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setLanguageAction, type ProfileFormState } from "./actions";

export function LanguageForm({ currentLanguage }: { currentLanguage: "fr" | "en" }) {
  const t = useTranslations("Profile");
  const initialState: ProfileFormState = {};
  const [state, formAction, pending] = useActionState(setLanguageAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("language")}
        <select name="language" defaultValue={currentLanguage}>
          <option value="fr">{t("languageFr")}</option>
          <option value="en">{t("languageEn")}</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("submit")}
      </button>
      {state.success ? <p role="status">{t("success")}</p> : null}
    </form>
  );
}
