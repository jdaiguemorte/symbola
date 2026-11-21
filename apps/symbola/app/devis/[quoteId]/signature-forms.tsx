"use client";

import { useTranslations } from "next-intl";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
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
  primary = false,
}: {
  quoteId: string;
  drafts: SignerDraft[];
  rows: number;
  // Lot 31b (DOC-03, D9) : contrat à jour, signé avec le devis dans le même PDF.
  contract?: { id: string; version: number } | null;
  // Lot 62d : la signature est la prochaine action du devis (le seul bouton principal de l'écran).
  primary?: boolean;
}) {
  const t = useTranslations("Quotes");
  const tContracts = useTranslations("Contracts");
  const tCommon = useTranslations("Common");
  return (
    <QuoteActionForm
      action={sendForSignatureAction}
      quoteId={quoteId}
      label={t("sendForSignature")}
      submitLabel={t("sendForSignature")}
      successMessage={t("signatureSent")}
      primary={primary}
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
            <p className="field-hint">{tContracts("quoteAloneHint")}</p>
          )}
          {/* Lot 62d (UX-12) : les signataires côte à côte, le nom et l'e-mail sur une ligne. */}
          <div className="form-grid">
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
            // Lot 63a : le premier signataire est obligatoire (nom et e-mail) ; les suivants, non.
            const first = index === 0;
            return (
              <fieldset key={`${index}-${state.at ?? 0}`}>
                <legend>{t("signerNumber", { number: index + 1 })}</legend>
                <input type="hidden" name={`signer_${index}_clientId`} value={draft?.eventClientId ?? ""} />
                <input type="hidden" name={`signer_${index}_contactId`} value={draft?.contactId ?? ""} />
                <label htmlFor={id("name")}>
                  <span>
                    {t("signerName")}
                    {first ? <RequiredMark /> : null}
                  </span>
                  <input id={id("name")} type="text" name={`signer_${index}_name`} defaultValue={draft?.name ?? ""} autoComplete="name" required={first} />
                </label>
                <label htmlFor={id("email")}>
                  <span>
                    {t("signerEmail")}
                    {first ? <RequiredMark /> : null}
                  </span>
                  <input id={id("email")} type="email" name={`signer_${index}_email`} defaultValue={draft?.email ?? ""} autoComplete="email" required={first} />
                </label>
                <label htmlFor={id("address")}>
                  {t("signerAddress")}
                  <textarea id={id("address")} name={`signer_${index}_address`} rows={2} autoComplete="street-address" defaultValue={draft?.billingAddress ?? ""} />
                </label>
                {/* Lot 63a (UX-02 ; recette du 21/11) : les mariés partagent souvent une adresse. */}
                {index > 0 ? <SameAddressButton from={`signer-0-address`} to={id("address")} label={t("signerSameAddress")} /> : null}
                {draft?.contactId ? (
                  <label>
                    <input type="checkbox" name={`signer_${index}_saveAddress`} defaultChecked={submitted ? (submitted.saveBillingAddress ?? false) : true} />
                    {t("signerSaveAddress")}
                  </label>
                ) : null}
              </fieldset>
            );
          })}
          </div>
          <RequiredLegend text={tCommon("requiredLegend")} />
        </>
      )}
    </QuoteActionForm>
  );
}

// Recopie l'adresse de facturation du premier signataire (champ non contrôlé : on écrit sa valeur).
function SameAddressButton({ from, to, label }: { from: string; to: string; label: string }) {
  return (
    <button
      type="button"
      className="button-secondary button-small"
      onClick={() => {
        const source = document.getElementById(from) as HTMLTextAreaElement | null;
        const target = document.getElementById(to) as HTMLTextAreaElement | null;
        if (source && target) target.value = source.value;
      }}
    >
      {label}
    </button>
  );
}
