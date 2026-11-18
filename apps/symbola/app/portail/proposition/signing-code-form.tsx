"use client";

// Lot 43 (SEC-16 ; D4) — le code à usage unique avant de signer : envoyé à l'e-mail du lien, valable
// dix minutes, cinq essais. Une fois vérifié, le lien de signature s'affiche (trente minutes).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmSigningCodeAction, requestSigningCodeAction, type SigningCodeState } from "./actions";

export function SigningCodeForm({ quoteId, preview = false }: { quoteId: string; preview?: boolean }) {
  const t = useTranslations("Proposal.flow");
  const [requested, request, requesting] = useActionState(requestSigningCodeAction, {} as SigningCodeState);
  const [checked, confirm, confirming] = useActionState(confirmSigningCodeAction, {} as SigningCodeState);
  const inputId = `signing-code-${quoteId}`;
  return (
    <div className="signing-code">
      <p>{t("codeHint")}</p>
      <form action={preview ? undefined : request} aria-label={t("codeRequest")}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <button type="submit" disabled={requesting || preview}>
          {requested.emailHint ? t("codeResend") : t("codeRequest")}
        </button>
        {requested.emailHint ? <p role="status">{t("codeSent", { email: requested.emailHint })}</p> : null}
        {requested.error ? <p role="alert">{requested.error}</p> : null}
      </form>
      <form action={preview ? undefined : confirm} aria-label={t("codeConfirm")}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <label htmlFor={inputId}>{t("codeLabel")}</label>
        <input id={inputId} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 -]{6,9}" maxLength={9} required disabled={preview} />
        <button type="submit" disabled={confirming || preview}>
          {t("codeConfirm")}
        </button>
        {checked.error ? <p role="alert">{checked.error}</p> : null}
      </form>
    </div>
  );
}
