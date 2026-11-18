"use client";

// Lot 45 (CRM-06, CRM-05 ; D2) — relances des prospects : activées, jusqu'à trois (jours après le dernier
// envoi, modèle), envoi automatique (désactivé par défaut : la planner relit chaque relance) ; la
// brochure jointe par lien sécurisé.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import type { ProspectFollowUpSettings } from "@symbola/contracts";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { removeBrochureAction, saveProspectFollowUpsAction, type ProspectSettingsState } from "./prospect-actions";

export function ProspectFollowUpForm({ settings, templates }: { settings: ProspectFollowUpSettings; templates: { id: string; name: string }[] }) {
  const t = useTranslations("FollowUpSettings");
  const [state, action, pending] = useActionState<ProspectSettingsState, FormData>(saveProspectFollowUpsAction, {});
  return (
    <form action={action} className="stack" aria-labelledby="prospect-follow-ups-title">
      <h2 id="prospect-follow-ups-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      <label className="checkbox">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
        {t("enabled")}
      </label>
      {[1, 2, 3].map((rank) => {
        const step = settings.steps[rank - 1];
        return (
          <fieldset key={rank} className="row-wrap">
            <legend>{t("step", { rank })}</legend>
            <label>
              {t("days")}
              <input type="number" name={`days-${rank}`} min={1} max={60} defaultValue={step?.days ?? ""} />
            </label>
            <label>
              {t("template")}
              <select name={`template-${rank}`} defaultValue={step?.messageTemplateId ?? ""}>
                <option value="">{t("defaultText")}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        );
      })}
      <label className="checkbox">
        <input type="checkbox" name="autoSend" defaultChecked={settings.autoSend} />
        {t("autoSend")}
      </label>
      <p className="meta">{t("autoSendHint")}</p>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.ok ? <p role="status">{state.ok}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function BrochureForm({ brochure }: { brochure: ProspectFollowUpSettings["brochure"] }) {
  const t = useTranslations("FollowUpSettings");
  const [state, action, pending] = useUploadAction<UploadState>("/parametres/relances/brochure");
  const fieldId = useId();
  return (
    <div className="stack" aria-labelledby="brochure-title" role="group">
      <h2 id="brochure-title">{t("brochureTitle")}</h2>
      <p>{brochure ? t("brochureCurrent", { name: brochure.fileName }) : t("brochureNone")}</p>
      <form action={action} className="stack">
        <label htmlFor={fieldId}>{t("brochureField")}</label>
        <input id={fieldId} type="file" name="brochure" accept="application/pdf" required />
        <button type="submit" disabled={pending}>
          {t("brochureSubmit")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
      {brochure ? (
        <form action={removeBrochureAction}>
          <button type="submit" className="button-ghost">
            {t("brochureRemove")}
          </button>
        </form>
      ) : null}
      <p className="meta">{t("brochureHint")}</p>
    </div>
  );
}
