"use client";

import { useTranslations } from "next-intl";
import { QuoteActionForm } from "./quote-forms";
import { sendForSignatureAction } from "./signature-actions";

// Lot 36a (UX-02, D8) : le contact du client, et son adresse de facturation (ou postale), préremplie.
export type SignerDraft = { eventClientId: string | null; contactId: string | null; name: string; email: string; billingAddress: string };

// DEV-02 — signataires saisis sur le devis (ADR 0021), pré-remplis depuis
// les mariés de l'événement et leurs accès (PRD-EVT-06).
export function SendForSignatureForm({
  quoteId,
  drafts,
  rows,
  contract,
}: {
  quoteId: string;
  drafts: SignerDraft[];
  rows: number;
  // Lot 31b (DOC-03, D9) : contrat à jour, signé avec le devis dans le même PDF.
  contract?: { id: string; version: number } | null;
}) {
  const t = useTranslations("Quotes");
  const tContracts = useTranslations("Contracts");
  return (
    <QuoteActionForm
      action={sendForSignatureAction}
      quoteId={quoteId}
      label={t("sendForSignature")}
      submitLabel={t("sendForSignature")}
      successMessage={t("signatureSent")}
    >
      {(state) => (
        <>
          <p>{t("sendForSignatureHint")}</p>
          {contract ? (
            <>
              <input type="hidden" name="contractId" value={contract.id} />
              <p role="note">{tContracts("signedWithQuote", { version: contract.version })}</p>
            </>
          ) : (
            <p className="meta">{tContracts("quoteAloneHint")}</p>
          )}
          {Array.from({ length: rows }, (_, index) => {
            // Lot 38a (MSG-02) : après un refus ou l'écran du garde-fou, les lignes saisies reviennent
            // (la clé change à chaque réponse pour que React reprenne ces valeurs).
            const submitted = state.signers?.[index];
            const draft: SignerDraft | undefined = state.signers
              ? submitted
                ? { eventClientId: submitted.eventClientId ?? null, contactId: submitted.contactId ?? null, name: submitted.name, email: submitted.email, billingAddress: submitted.billingAddress }
                : undefined
              : drafts[index];
            const id = (field: string) => `signer-${index}-${field}`;
            return (
              <fieldset key={`${index}-${state.at ?? 0}`}>
                <legend>{t("signerNumber", { number: index + 1 })}</legend>
                <input type="hidden" name={`signer_${index}_clientId`} value={draft?.eventClientId ?? ""} />
                <input type="hidden" name={`signer_${index}_contactId`} value={draft?.contactId ?? ""} />
                <label htmlFor={id("name")}>{t("signerName")}</label>
                <input id={id("name")} type="text" name={`signer_${index}_name`} defaultValue={draft?.name ?? ""} autoComplete="name" />
                <label htmlFor={id("email")}>{t("signerEmail")}</label>
                <input id={id("email")} type="email" name={`signer_${index}_email`} defaultValue={draft?.email ?? ""} autoComplete="email" />
                <label htmlFor={id("address")}>{t("signerAddress")}</label>
                <textarea id={id("address")} name={`signer_${index}_address`} rows={2} autoComplete="street-address" defaultValue={draft?.billingAddress ?? ""} />
                {draft?.contactId ? (
                  <label className="checkbox">
                    <input type="checkbox" name={`signer_${index}_saveAddress`} defaultChecked={submitted ? (submitted.saveBillingAddress ?? false) : true} />
                    {t("signerSaveAddress")}
                  </label>
                ) : null}
              </fieldset>
            );
          })}
        </>
      )}
    </QuoteActionForm>
  );
}
