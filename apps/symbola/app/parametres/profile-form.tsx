"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveProfileAction, type ProfileFormState } from "./actions";
import type { OrganizationProfile } from "@/modules/hub/service";

const LEGAL_FORMS = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"] as const;

export function ProfileForm({ profile }: { profile: OrganizationProfile }) {
  const t = useTranslations("Settings");
  const initialState: ProfileFormState = {};
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("siren")}
        <input type="text" name="siren" defaultValue={profile.siren ?? ""} />
      </label>
      <label>
        {t("address")}
        <input type="text" name="address" defaultValue={profile.address ?? ""} />
      </label>
      <label>
        {t("legalForm")}
        <select name="legalForm" defaultValue={profile.legalForm ?? ""}>
          <option value="">{t("legalFormUnset")}</option>
          {LEGAL_FORMS.map((form) => (
            <option key={form} value={form}>
              {t(`legalForm_${form}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("metier")}
        <select name="metier" defaultValue={profile.metier ?? ""}>
          <option value="">{t("metierUnset")}</option>
          <option value="wedding_planner">{t("metierWeddingPlanner")}</option>
          <option value="autre">{t("metierAutre")}</option>
        </select>
      </label>
      <label>
        {t("metierPrecision")}
        <input type="text" name="metierPrecision" defaultValue={profile.metierPrecision ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.success ? <p role="status">{t("profileSaved")}</p> : null}
    </form>
  );
}
