"use client";

// Lot 48a (PRE-05, PRE-10 ; D3, D5) — dans l'espace du prestataire : déposer une pièce demandée,
// donner ou changer son IBAN (jamais prérempli).
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import { setVendorBankByLinkAction, type VendorBankState } from "./actions";

type UploadState = { error?: string; success?: boolean };

export function VendorDocumentDropForm({ documentId, label, preview }: { documentId: string; label: string; preview: boolean }) {
  const t = useTranslations("VendorSpace");
  const [state, action, pending] = useUploadAction<UploadState>("/prestataire/pieces");
  const fileId = useId();
  const dateId = useId();
  return (
    <form action={preview ? undefined : action} className="vendor-answer">
      <input type="hidden" name="documentId" value={documentId} />
      <label htmlFor={fileId}>{t("documentsFile", { document: label })}</label>
      <input id={fileId} type="file" name="file" accept="image/*,application/pdf" required disabled={preview} />
      <label htmlFor={dateId}>{t("documentsValidUntil")}</label>
      <input id={dateId} type="date" name="validUntil" disabled={preview} />
      <button type="submit" disabled={preview || pending}>
        {t("documentsSend")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("documentsSent")}</p> : null}
    </form>
  );
}

export function VendorBankLinkForm({ preview }: { preview: boolean }) {
  const t = useTranslations("VendorSpace");
  const [state, action, pending] = useActionState<VendorBankState, FormData>(setVendorBankByLinkAction, {});
  const ibanId = useId();
  const bicId = useId();
  return (
    <form action={preview ? undefined : action} className="vendor-answer" autoComplete="off">
      <label htmlFor={ibanId}>{t("bankIban")}</label>
      <input id={ibanId} name="iban" required spellCheck={false} disabled={preview} />
      <label htmlFor={bicId}>{t("bankBic")}</label>
      <input id={bicId} name="bic" spellCheck={false} disabled={preview} />
      <button type="submit" disabled={preview || pending}>
        {t("bankSend")}
      </button>
      {state.error === "iban" ? <p role="alert">{t("bankIbanInvalid")}</p> : null}
      {state.error === "bic" ? <p role="alert">{t("bankBicInvalid")}</p> : null}
      {state.error === "closed" ? <p role="alert">{t("documentsClosed")}</p> : null}
      {state.success ? <p role="status">{t("bankSent")}</p> : null}
    </form>
  );
}
