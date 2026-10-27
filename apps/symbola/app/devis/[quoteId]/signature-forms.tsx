"use client";

import { useTranslations } from "next-intl";
import { QuoteActionForm } from "./quote-forms";
import { sendForSignatureAction } from "./signature-actions";

export type SignerDraft = { eventClientId: string | null; name: string; email: string };

// DEV-02 — signataires saisis sur le devis (ADR 0021), pré-remplis depuis
// les mariés de l'événement et leurs accès (EVT-06).
export function SendForSignatureForm({ quoteId, drafts, rows }: { quoteId: string; drafts: SignerDraft[]; rows: number }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={sendForSignatureAction}
      quoteId={quoteId}
      label={t("sendForSignature")}
      submitLabel={t("sendForSignature")}
      successMessage={t("signatureSent")}
    >
      <p>{t("sendForSignatureHint")}</p>
      {Array.from({ length: rows }, (_, index) => {
        const draft = drafts[index];
        const id = (field: string) => `signer-${index}-${field}`;
        return (
          <fieldset key={index}>
            <legend>{t("signerNumber", { number: index + 1 })}</legend>
            <input type="hidden" name={`signer_${index}_clientId`} value={draft?.eventClientId ?? ""} />
            <label htmlFor={id("name")}>{t("signerName")}</label>
            <input id={id("name")} type="text" name={`signer_${index}_name`} defaultValue={draft?.name ?? ""} autoComplete="name" />
            <label htmlFor={id("email")}>{t("signerEmail")}</label>
            <input id={id("email")} type="email" name={`signer_${index}_email`} defaultValue={draft?.email ?? ""} autoComplete="email" />
            <label htmlFor={id("address")}>{t("signerAddress")}</label>
            <textarea id={id("address")} name={`signer_${index}_address`} rows={2} autoComplete="street-address" />
          </fieldset>
        );
      })}
    </QuoteActionForm>
  );
}
