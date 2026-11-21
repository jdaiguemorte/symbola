"use client";

// Lot 63f (HUB-09, HUB-18, HUB-23 ; ADR 0103 ; maquette M1) — une étape de « L'essentiel » : une
// question, ses champs déjà remplis par les réglages, « Continuer » (ou Entrée) qui enregistre,
// « Passer cette étape ». Les champs marqués « * » sont obligatoires pour envoyer un devis, jamais
// pour avancer : aucun n'a l'attribut required (SC-01).
import Link from "next/link";
import { useActionState, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LogoForm } from "@/app/logo/logo-form";
import { saveEssentialStepAction, type EssentialsFormState } from "./actions";

const LEGAL_FORMS = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"] as const;

export type EssentialStepProps =
  | { step: "company"; organizationName: string; legalForm: string; siret: string }
  | { step: "address"; address: string; postalCode: string; city: string; contactEmail: string; contactPhone: string }
  | { step: "logo"; logoVersion: string | null }
  | { step: "vat"; vatRegime: "franchise" | "assujetti" | null; vatNumber: string }
  | { step: "bank"; iban: string; bic: string }
  | { step: "numbering"; quotePrefix: string; invoicePrefix: string; year: number };

export function EssentialStepForm(props: EssentialStepProps & { previous: string | null; last: boolean }) {
  const t = useTranslations("Essentials");
  const tSettings = useTranslations("Settings");
  const tSetup = useTranslations("Setup");
  const [state, action, pending] = useActionState<EssentialsFormState, FormData>(saveEssentialStepAction, {});
  const noteId = useId();
  const errorId = useId();
  // Une étape refusée garde la saisie (React remet les champs à leur valeur de départ après l'envoi).
  const kept = (name: string, stored: string) => state.values?.[name] ?? stored;
  const [quotePrefix, setQuotePrefix] = useState(props.step === "numbering" ? props.quotePrefix : "");
  const [invoicePrefix, setInvoicePrefix] = useState(props.step === "numbering" ? props.invoicePrefix : "");
  const required = props.step === "company" || props.step === "address" || props.step === "vat";

  // Un champ : son libellé (« * » visuel pour un obligatoire du devis), l'erreur qui le nomme.
  const field = (name: string, label: string, input: (attributes: { id: string; name: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode, options: { star?: boolean; hint?: string } = {}) => {
    const id = `essentials-${name}`;
    const described = [options.hint ? `${id}-hint` : null, options.star ? noteId : null, state.field === name ? errorId : null].filter(Boolean).join(" ");
    return (
      <div className="field-group">
        <label htmlFor={id}>
          {label}
          {options.star ? <span aria-hidden="true"> *</span> : null}
        </label>
        {input({ id, name, ...(state.field === name ? { "aria-invalid": true as const } : {}), ...(described ? { "aria-describedby": described } : {}) })}
        {options.hint ? (
          <p id={`${id}-hint`} className="field-hint">
            {options.hint}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      {/* Le logo s'envoie par son propre formulaire (route /logo), avant la suite de l'étape. */}
      {props.step === "logo" ? <LogoForm version={props.logoVersion} /> : null}
      <form id="essentials-form" action={action} className="stack essentials-form">
        <input type="hidden" name="step" value={props.step} />
        {props.step === "company" ? (
          <div className="form-grid">
            {field("organizationName", t("organizationName"), (attributes) => <input type="text" autoComplete="organization" maxLength={200} defaultValue={kept("organizationName", props.organizationName)} {...attributes} />, { star: true })}
            {field("legalForm", t("legalForm"), (attributes) => (
              <select defaultValue={kept("legalForm", props.legalForm)} {...attributes}>
                <option value="">{t("legalFormUnset")}</option>
                {LEGAL_FORMS.map((form) => (
                  <option key={form} value={form}>
                    {tSettings(`legalForm_${form}`)}
                  </option>
                ))}
              </select>
            ))}
            {field("siret", t("siret"), (attributes) => <input type="text" inputMode="numeric" autoComplete="off" defaultValue={kept("siret", props.siret)} {...attributes} />, { star: true, hint: t("siretHint") })}
          </div>
        ) : null}
        {props.step === "address" ? (
          <div className="form-grid">
            {field("address", t("address"), (attributes) => <input type="text" autoComplete="address-line1" maxLength={300} defaultValue={kept("address", props.address)} {...attributes} />, { star: true })}
            <div className="field-row">
              {field("postalCode", t("postalCode"), (attributes) => <input className="field-code" type="text" autoComplete="postal-code" maxLength={16} defaultValue={kept("postalCode", props.postalCode)} {...attributes} />, { star: true })}
              {field("city", t("city"), (attributes) => <input type="text" autoComplete="address-level2" maxLength={120} defaultValue={kept("city", props.city)} {...attributes} />, { star: true })}
            </div>
            {field("contactEmail", t("contactEmail"), (attributes) => <input type="email" autoComplete="email" defaultValue={kept("contactEmail", props.contactEmail)} {...attributes} />)}
            {field("contactPhone", t("contactPhone"), (attributes) => <input type="tel" autoComplete="tel" defaultValue={kept("contactPhone", props.contactPhone)} {...attributes} />)}
          </div>
        ) : null}
        {props.step === "vat" ? (
          <>
            <fieldset className="choice-cards" aria-describedby={noteId}>
              <legend>
                {t("steps.vat")}
                <span aria-hidden="true"> *</span>
              </legend>
              {(["franchise", "assujetti"] as const).map((value) => (
                <label key={value} className="choice-card">
                  <input type="radio" name="vatRegime" value={value} defaultChecked={kept("vatRegime", props.vatRegime ?? "") === value} />
                  <span>
                    <strong>{tSetup(`vat.${value}.title`)}</strong>
                    <span className="muted">{tSetup(`vat.${value}.body`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {field("vatNumber", t("vatNumber"), (attributes) => <input type="text" autoComplete="off" defaultValue={kept("vatNumber", props.vatNumber)} {...attributes} />, { hint: t("vatNumberHint") })}
          </>
        ) : null}
        {props.step === "bank" ? (
          <div className="form-grid">
            {field("iban", t("iban"), (attributes) => <input type="text" autoComplete="off" spellCheck={false} defaultValue={kept("iban", props.iban)} {...attributes} />)}
            {field("bic", t("bic"), (attributes) => <input type="text" className="field-short" autoComplete="off" spellCheck={false} defaultValue={kept("bic", props.bic)} {...attributes} />)}
          </div>
        ) : null}
        {props.step === "numbering" ? (
          <>
            <div className="field-row">
              {field("quotePrefix", t("quotePrefix"), (attributes) => <input type="text" className="field-short" maxLength={8} value={quotePrefix} onChange={(event) => setQuotePrefix(event.target.value)} {...attributes} />, { hint: t("prefixHint") })}
              {field("invoicePrefix", t("invoicePrefix"), (attributes) => <input type="text" className="field-short" maxLength={8} value={invoicePrefix} onChange={(event) => setInvoicePrefix(event.target.value)} {...attributes} />)}
            </div>
            <p className="essentials-example" aria-live="polite">
              {t("numberingExample", {
                year: props.year,
                quote: `${quotePrefix.trim().toUpperCase() || props.quotePrefix}-${props.year}-0001`,
                invoice: `${invoicePrefix.trim().toUpperCase() || props.invoicePrefix}-${props.year}-0001`,
              })}
            </p>
          </>
        ) : null}
        {required ? (
          <p id={noteId} className="field-hint">
            {t("requiredNote")}
          </p>
        ) : null}
        {state.error ? (
          <p id={errorId} role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="essentials-actions">
          {props.previous ? (
            <Link href={props.previous} className="button-link">
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="essentials-continue">
            <span className="muted essentials-enter" aria-hidden="true">
              {t("enterHint")}
            </span>
            <button type="submit" name="intent" value="continue" disabled={pending}>
              {props.last ? t("finish") : t("continue")}
            </button>
          </span>
        </div>
        {/* « Passer » n'écrit rien ; « Finir plus tard » enregistre l'étape affichée et ramène à l'accueil.
            Après « Continuer » dans le formulaire : ni l'un ni l'autre n'est le bouton d'Entrée. */}
        <div className="essentials-secondary">
          <button type="submit" name="intent" value="skip" className="button-ghost" disabled={pending}>
            {t("skip")}
          </button>
          <button type="submit" name="intent" value="later" className="button-ghost" disabled={pending}>
            {t("later")}
          </button>
        </div>
      </form>
    </>
  );
}

