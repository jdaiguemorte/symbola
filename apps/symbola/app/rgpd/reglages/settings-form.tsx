"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { PrivacySettings } from "@/modules/hub/service";
import { saveGuestNoticeAction, saveLinkNoticeAction, savePrivacySettingsAction, type SettingsFormState } from "./actions";

// Lot 26a (ADR 0053) : plus de compte de marié, donc plus de durée affichée pour
// leur suppression ; la valeur reste en base, renvoyée telle quelle.
const FIELDS: (keyof PrivacySettings)[] = ["requestAlertDays", "prospectRetentionMonths", "clientRetentionMonths", "accountingRetentionMonths", "signedQuoteRetentionMonths", "requestProofRetentionMonths"];

// Lot 49 (RGP-08, D9) : durées de la purge des invités, en jours, si le module Invités est ouvert.
const GUEST_FIELDS: (keyof PrivacySettings)[] = ["guestDietRetentionDays", "guestRetentionDays", "guestPurgeMaxPostponeDays"];

export function PrivacySettingsForm({ settings, guestsEnabled = false }: { settings: PrivacySettings; guestsEnabled?: boolean }) {
  const t = useTranslations("Privacy");
  const initialState: SettingsFormState = {};
  const [state, formAction, pending] = useActionState(savePrivacySettingsAction, initialState);
  // Lot 62b (UX-12) : durées en champs courts, sur une grille ; un seul bouton principal à l'écran.
  return (
    <form action={formAction} className="settings-sheet" aria-label={t("settingsTitle")}>
      <input type="hidden" name="inactiveAccountMonths" value={settings.inactiveAccountMonths} />
      <section className="card" aria-labelledby="privacy-durations">
        <h2 id="privacy-durations">{t("durationsTitle")}</h2>
        <div className="form-grid form-grid-3 duration-grid">
          {FIELDS.map((field) => (
            <label key={field}>
              {t(`setting.${field}`)}
              <input className="field-short" type="number" name={field} min={1} max={1200} step={1} required defaultValue={settings[field]} />
            </label>
          ))}
        </div>
      </section>
      {guestsEnabled ? (
        <section className="card" aria-labelledby="privacy-guests">
          <h2 id="privacy-guests">{t("guestRetentionLegend")}</h2>
          <p className="field-hint">{t("guestRetentionIntro")}</p>
          <div className="form-grid form-grid-3 duration-grid">
            {GUEST_FIELDS.map((field) => (
              <label key={field}>
                {t(`setting.${field}`)}
                <input className="field-short" type="number" name={field} min={1} max={120} step={1} required defaultValue={settings[field]} />
              </label>
            ))}
          </div>
        </section>
      ) : (
        GUEST_FIELDS.map((field) => <input key={field} type="hidden" name={field} value={settings[field]} />)
      )}
      <div className="form-foot">
        <button type="submit" disabled={pending}>
          {t("saveSettings")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
      </div>
    </form>
  );
}

// Lot 26a (RGP-03) — mention d'information des pages à lien personnel : le
// texte de l'organisation, ou celui de départ (à adapter, à faire relire).
export function LinkNoticeForm({ text, custom }: { text: string; custom: boolean }) {
  const t = useTranslations("Privacy");
  const [state, formAction, pending] = useActionState(saveLinkNoticeAction, {} as SettingsFormState);
  return (
    <form action={formAction} aria-label={t("linkNoticeTitle")}>
      <h2>{t("linkNoticeTitle")}</h2>
      <p>{t("linkNoticeIntro")}</p>
      {custom ? null : <p className="muted">{t("linkNoticeReview")}</p>}
      <label className="field-wide">
        {t("linkNoticeLabel")}
        <textarea name="notice" rows={8} maxLength={4000} defaultValue={text} />
      </label>
      <div className="button-row">
        <button type="submit" name="intent" value="save" className="button-secondary" disabled={pending}>
          {t("linkNoticeSave")}
        </button>
        {custom ? (
          <button type="submit" name="intent" value="reset" className="button-ghost" disabled={pending}>
            {t("linkNoticeReset")}
          </button>
        ) : null}
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("linkNoticeSaved")}</p> : null}
    </form>
  );
}

// Lot 49 (RGP-03, article 14) — mention d'information de la page de réponse des invités : le texte
// de l'organisation, ou celui de départ (à faire relire par la DPO, DPO-4).
export function GuestNoticeForm({ text, custom }: { text: string; custom: boolean }) {
  const t = useTranslations("Privacy");
  const [state, formAction, pending] = useActionState(saveGuestNoticeAction, {} as SettingsFormState);
  return (
    <form action={formAction} aria-label={t("guestNoticeTitle")}>
      <h2>{t("guestNoticeTitle")}</h2>
      <p>{t("guestNoticeIntro")}</p>
      {custom ? null : <p className="muted">{t("linkNoticeReview")}</p>}
      <label className="field-wide">
        {t("guestNoticeLabel")}
        <textarea name="notice" rows={8} maxLength={4000} defaultValue={text} />
      </label>
      <div className="button-row">
        <button type="submit" name="intent" value="save" className="button-secondary" disabled={pending}>
          {t("linkNoticeSave")}
        </button>
        {custom ? (
          <button type="submit" name="intent" value="reset" className="button-ghost" disabled={pending}>
            {t("linkNoticeReset")}
          </button>
        ) : null}
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("linkNoticeSaved")}</p> : null}
    </form>
  );
}
