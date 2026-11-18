"use client";

// Lot 44 (CRM-01 ; D1 à D3, D7) — le formulaire des réglages du formulaire de contact.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CONTACT_FORM_FIELDS, type ContactFormField } from "@symbola/contracts";
import { saveContactSettingsAction, type ContactSettingsState } from "./actions";

type Settings = { active: boolean; slug: string; hiddenFields: ContactFormField[]; privacyPolicyUrl: string; allowedOrigins: string[]; notifyOwner: boolean; locale: "fr" | "en" };

export function ContactSettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("ContactForm.settings");
  const tFields = useTranslations("ContactForm.fields");
  const [state, action, pending] = useActionState<ContactSettingsState, FormData>(saveContactSettingsAction, {});
  return (
    <form action={action} className="stack card">
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.saved ? <p role="status">{t("saved")}</p> : null}
      <label className="checkbox">
        <input type="checkbox" name="active" defaultChecked={settings.active} />
        {t("active")}
      </label>
      <label>
        {t("slug")}
        <input type="text" name="slug" required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={settings.slug} aria-describedby="contact-slug-help" />
      </label>
      <p id="contact-slug-help" className="meta">
        {t("slugHelp")}
      </p>
      <label>
        {t("privacyPolicyUrl")}
        <input type="url" name="privacyPolicyUrl" maxLength={500} placeholder="https://" defaultValue={settings.privacyPolicyUrl} aria-describedby="contact-policy-help" />
      </label>
      <p id="contact-policy-help" className="meta">
        {t("privacyPolicyHelp")}
      </p>
      <fieldset className="stack">
        <legend>{t("shownFields")}</legend>
        <p className="meta">{t("shownFieldsHelp")}</p>
        {CONTACT_FORM_FIELDS.map((field) => (
          <label key={field} className="checkbox">
            <input type="checkbox" name="shownFields" value={field} defaultChecked={!settings.hiddenFields.includes(field)} />
            {tFields(field)}
          </label>
        ))}
      </fieldset>
      <label>
        {t("allowedOrigins")}
        <textarea name="allowedOrigins" rows={3} maxLength={2000} defaultValue={settings.allowedOrigins.join("\n")} aria-describedby="contact-origins-help" />
      </label>
      <p id="contact-origins-help" className="meta">
        {t("allowedOriginsHelp")}
      </p>
      <label className="checkbox">
        <input type="checkbox" name="notifyOwner" defaultChecked={settings.notifyOwner} />
        {t("notifyOwner")}
      </label>
      <label>
        {t("locale")}
        <select name="locale" defaultValue={settings.locale}>
          <option value="fr">{t("localeFr")}</option>
          <option value="en">{t("localeEn")}</option>
        </select>
      </label>
      <button type="submit" className="primary" disabled={pending}>
        {t("save")}
      </button>
    </form>
  );
}
