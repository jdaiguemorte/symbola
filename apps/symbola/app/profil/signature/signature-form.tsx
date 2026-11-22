"use client";

// Lot 66c (HUB-18 ; D5 ; ADR 0113 ; maquette M19) — Mon compte › Ma signature : nom affiché, fonction,
// téléphone, site, quatre liens au plus, photo facultative (envoyée par sa route, contrôlée comme le
// logo), et l'aperçu en direct, composé comme l'e-mail (packages/mail/src/signature.ts) avec les
// éléments que l'organisation affiche.
import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { SIGNATURE_LINKS_MAX, type EmailFont, type MemberSignatureView, type SignatureElement } from "@symbola/contracts";
import { composeMailSignature } from "@symbola/mail/signature";
import { SignaturePreview } from "@/app/parametres/emails/email-preview";
import { RequiredMark } from "@/app/ui/required-mark";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { removeMySignaturePhotoAction, saveMySignatureAction, type SignatureFormState } from "./actions";

type Draft = { displayName: string; jobTitle: string; phone: string; website: string; links: { label: string; url: string }[] };

function draftOf(signature: MemberSignatureView | null): Draft {
  const links = Array.from({ length: SIGNATURE_LINKS_MAX }, (_, index) => signature?.links[index] ?? { label: "", url: "" });
  return { displayName: signature?.displayName ?? "", jobTitle: signature?.jobTitle ?? "", phone: signature?.phone ?? "", website: signature?.website ?? "", links };
}

export function SignatureForm({
  signature,
  elements,
  organizationName,
  suggestions,
  limits,
  font,
}: {
  font: EmailFont;
  signature: MemberSignatureView | null;
  elements: SignatureElement[];
  organizationName: string;
  suggestions: string[];
  limits: { text: number; label: number; url: number };
}) {
  const t = useTranslations("MySignature");
  const id = useId();
  const [state, action, pending] = useActionState(saveMySignatureAction, {} as SignatureFormState);
  const [photoState, photoAction, photoPending] = useUploadAction<UploadState>("/profil/signature/photo");
  const [draft, setDraft] = useState<Draft>(() => draftOf(signature));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const setLink = (index: number, patch: Partial<{ label: string; url: string }>) =>
    setDraft((current) => ({ ...current, links: current.links.map((link, at) => (at === index ? { ...link, ...patch } : link)) }));
  const invalid = new Set(state.fields ?? []);
  const preview = composeMailSignature({ ...draft, hasPhoto: signature?.hasPhoto ?? false }, elements, organizationName);
  const photoUrl = signature?.photoVersion ? `/profil/signature/photo?v=${encodeURIComponent(signature.photoVersion)}` : null;

  return (
    <div className="signature-editor">
      <div className="stack">
        <form action={action} className="stack" aria-label={t("title")}>
          <label htmlFor={`${id}-name`}>{t("displayName")}</label>
          <input
            id={`${id}-name`}
            name="displayName"
            type="text"
            autoComplete="name"
            value={draft.displayName}
            maxLength={limits.text}
            aria-describedby={`${id}-name-hint`}
            aria-invalid={invalid.has("displayName") || undefined}
            onChange={(event) => set({ displayName: event.target.value })}
          />
          <p id={`${id}-name-hint`} className="field-hint">
            {t("displayNameHint")}
          </p>
          <label htmlFor={`${id}-title`}>{t("jobTitle")}</label>
          <input id={`${id}-title`} name="jobTitle" type="text" autoComplete="organization-title" value={draft.jobTitle} maxLength={limits.text} aria-invalid={invalid.has("jobTitle") || undefined} onChange={(event) => set({ jobTitle: event.target.value })} />
          <label htmlFor={`${id}-phone`}>{t("phone")}</label>
          <input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" value={draft.phone} maxLength={40} aria-invalid={invalid.has("phone") || undefined} onChange={(event) => set({ phone: event.target.value })} />
          <label htmlFor={`${id}-website`}>{t("website")}</label>
          <input
            id={`${id}-website`}
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={draft.website}
            maxLength={limits.url}
            aria-describedby={`${id}-website-hint`}
            aria-invalid={invalid.has("website") || undefined}
            onChange={(event) => set({ website: event.target.value })}
          />
          <p id={`${id}-website-hint`} className="field-hint">
            {t("websiteHint")}
          </p>
          <fieldset className="stack" aria-describedby={`${id}-links-hint`}>
            <legend>{t("linksLegend", { max: SIGNATURE_LINKS_MAX })}</legend>
            <p id={`${id}-links-hint`} className="field-hint">
              {t("linksHint")}
            </p>
            <datalist id={`${id}-suggestions`}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <div className="signature-links">
              {draft.links.map((link, index) => (
                <div key={index} className="stack">
                  <label htmlFor={`${id}-link-label-${index}`}>{t("linkLabel", { n: index + 1 })}</label>
                  <input
                    id={`${id}-link-label-${index}`}
                    name={`linkLabel${index}`}
                    type="text"
                    list={`${id}-suggestions`}
                    value={link.label}
                    maxLength={limits.label}
                    aria-invalid={invalid.has("links") || undefined}
                    onChange={(event) => setLink(index, { label: event.target.value })}
                  />
                  <label htmlFor={`${id}-link-url-${index}`}>{t("linkUrl", { n: index + 1 })}</label>
                  <input
                    id={`${id}-link-url-${index}`}
                    name={`linkUrl${index}`}
                    type="text"
                    inputMode="url"
                    value={link.url}
                    maxLength={limits.url}
                    aria-invalid={invalid.has("links") || undefined}
                    onChange={(event) => setLink(index, { url: event.target.value })}
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={pending}>
            {t("save")}
          </button>
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
        <section aria-labelledby={`${id}-photo-title`} className="stack">
          <h2 id={`${id}-photo-title`}>{t("photoTitle")}</h2>
          <div className="signature-photo">
            {photoUrl ? <img src={photoUrl} alt={t("photoAlt")} /> : <p className="meta">{t("photoNone")}</p>}
            <form action={photoAction} className="logo-upload">
              <label htmlFor={`${id}-photo`}>
                {t("photoField")}
                <RequiredMark />
              </label>
              <input id={`${id}-photo`} type="file" name="photo" accept="image/png,image/jpeg" required />
              <button type="submit" className="button-secondary" disabled={photoPending}>
                {t("photoSubmit")}
              </button>
            </form>
            {photoUrl ? (
              <form action={removeMySignaturePhotoAction}>
                <button type="submit" className="button-ghost">
                  {t("photoRemove")}
                </button>
              </form>
            ) : null}
          </div>
          {photoState.error ? <p role="alert">{photoState.error}</p> : null}
          <p className="meta">{t("photoHint")}</p>
        </section>
      </div>
      <section aria-labelledby={`${id}-preview-title`}>
        <h2 id={`${id}-preview-title`}>{t("previewTitle")}</h2>
        <div className="mail-preview" role="region" aria-label={t("previewLabel")} aria-live="polite" tabIndex={0}>
          <div className={`mail-preview-card mail-font-${font}`}>
            <div className="mail-preview-body">
              <p>{t("previewBody")}</p>
              {preview ? <SignaturePreview signature={preview} photoUrl={photoUrl} /> : <p className="meta">{t("previewEmpty")}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
