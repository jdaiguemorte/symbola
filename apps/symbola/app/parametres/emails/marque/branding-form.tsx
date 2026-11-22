"use client";

// Lot 66c (HUB-18 ; D5, D6 ; ADR 0113 ; maquette M20) — la marque des e-mails : police en quatre cartes,
// ligne libre du pied, nom affiché de l'expéditeur, éléments affichés des signatures, signature des
// envois automatiques. Lecture seule pour une collaboratrice (réglage de la titulaire).
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { EMAIL_FONTS, SIGNATURE_ELEMENTS, type EmailBrandingView } from "@symbola/contracts";
import { saveEmailBrandingAction, type EmailBrandingFormState } from "./actions";

export function EmailBrandingForm({
  branding,
  planners,
  ownerId,
  limits,
  disabled,
}: {
  branding: EmailBrandingView;
  planners: { id: string; label: string }[];
  ownerId: string | null;
  limits: { footerLine: number; senderName: number };
  disabled: boolean;
}) {
  const t = useTranslations("EmailBranding");
  const [state, action, pending] = useActionState(saveEmailBrandingAction, {} as EmailBrandingFormState);
  const id = useId();
  const signer = branding.automaticSignerUserId ?? "";
  return (
    <form action={action} className="stack" aria-label={t("title")}>
      <fieldset disabled={disabled} className="stack">
        <legend>{t("fontLegend")}</legend>
        <p className="field-hint" id={`${id}-font-hint`}>
          {t("fontHint")}
        </p>
        <div className="font-pick" role="radiogroup" aria-describedby={`${id}-font-hint`}>
          {EMAIL_FONTS.map((font) => (
            <label key={font} className={`mail-font-${font}`}>
              <input type="radio" name="font" value={font} defaultChecked={branding.font === font} />
              <span className="font-pick-sample" aria-hidden="true">
                Aa
              </span>
              <span className="font-pick-name">{t(`fonts.${font}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="stack">
        <legend className="sr-only">{t("brandTitle")}</legend>
        <label htmlFor={`${id}-sender`}>{t("senderNameLabel")}</label>
        <input id={`${id}-sender`} type="text" name="senderName" defaultValue={branding.senderName ?? ""} maxLength={limits.senderName} aria-describedby={`${id}-sender-hint`} />
        <p id={`${id}-sender-hint`} className="field-hint">
          {t("senderNameHint")}
        </p>
        <label htmlFor={`${id}-footer`}>{t("footerLineLabel")}</label>
        <input id={`${id}-footer`} type="text" name="footerLine" defaultValue={branding.footerLine ?? ""} maxLength={limits.footerLine} aria-describedby={`${id}-footer-hint`} />
        <p id={`${id}-footer-hint`} className="field-hint">
          {t("footerLineHint", { max: limits.footerLine })}
        </p>
        <p className="meta">{t("footerAddressNote")}</p>
      </fieldset>
      <h2>{t("signatureTitle")}</h2>
      <p>{t("signatureIntro")}</p>
      <fieldset disabled={disabled} className="stack">
        <legend>{t("elementsLegend")}</legend>
        {SIGNATURE_ELEMENTS.map((element) => (
          <label key={element}>
            <input type="checkbox" name="signatureElements" value={element} defaultChecked={branding.signatureElements.includes(element)} /> {t(`elements.${element}`)}
          </label>
        ))}
      </fieldset>
      <fieldset disabled={disabled} className="stack">
        <legend className="sr-only">{t("automaticSignerLabel")}</legend>
        <label htmlFor={`${id}-signer`}>{t("automaticSignerLabel")}</label>
        <select id={`${id}-signer`} name="automaticSigner" defaultValue={signer} aria-describedby={`${id}-signer-hint`}>
          <option value="">{t("automaticSignerOwner")}</option>
          {planners
            .filter((planner) => planner.id !== ownerId)
            .map((planner) => (
              <option key={planner.id} value={planner.id}>
                {planner.label}
              </option>
            ))}
        </select>
        <p id={`${id}-signer-hint`} className="field-hint">
          {t("automaticSignerHint")}
        </p>
      </fieldset>
      <p className="notice" role="note">
        {t("symbolaNote")}
      </p>
      {disabled ? (
        <p className="meta">{t("ownerOnly")}</p>
      ) : (
        <button type="submit" disabled={pending}>
          {t("save")}
        </button>
      )}
      {state.errors && state.errors.length > 0 ? (
        <div role="alert">
          <ul>
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.saved ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
