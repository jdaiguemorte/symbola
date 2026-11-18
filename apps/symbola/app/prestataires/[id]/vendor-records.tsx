"use client";

// Lot 48a (PRE-05, PRE-10, SEC-27, DAT-08 ; ADR 0093) — formulaires de la fiche : IBAN (jamais
// prérempli en clair), pièce déposée ou demandée, fin de validité, note interne et sa case
// « confidentielle ».
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { VendorDocumentKind } from "@symbola/contracts";
import { useUploadAction } from "@/app/ui/use-upload";
import { requestVendorDocumentAction, saveVendorNoteAction, setVendorBankAction, setVendorDocumentValidityAction, type RecordFormState } from "./records-actions";

export function VendorBankForm({ vendorId, hasIban }: { vendorId: string; hasIban: boolean }) {
  const t = useTranslations("VendorRecords");
  const [state, action, pending] = useActionState<RecordFormState, FormData>(setVendorBankAction, {});
  return (
    <form action={action} className="stack" autoComplete="off">
      <input type="hidden" name="vendorId" value={vendorId} />
      <label>
        {hasIban ? t("ibanNew") : t("iban")}
        <input name="iban" inputMode="text" autoComplete="off" spellCheck={false} placeholder="FR76 3000 6000 0112 3456 7890 189" />
      </label>
      <label>
        {t("bic")}
        <input name="bic" autoComplete="off" spellCheck={false} />
      </label>
      <p className="muted">{t("ibanHint")}</p>
      <button type="submit" disabled={pending}>
        {t("ibanSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("ibanSaved")}</p> : null}
    </form>
  );
}

export function VendorDocumentUploadForm({ vendorId, kinds }: { vendorId: string; kinds: VendorDocumentKind[] }) {
  const t = useTranslations("VendorRecords");
  const [state, action, pending] = useUploadAction<RecordFormState>(`/prestataires/${vendorId}/pieces`);
  return (
    <form action={action} className="stack">
      <label>
        {t("documentKind")}
        <select name="kindId" defaultValue={kinds[0]?.id}>
          {kinds.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("documentFile")}
        <input type="file" name="file" accept="application/pdf,image/*" />
      </label>
      <label>
        {t("validUntil")}
        <input type="date" name="validUntil" />
      </label>
      <button type="submit" disabled={pending}>
        {t("documentAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("documentAdded")}</p> : null}
    </form>
  );
}

export function VendorDocumentRequestForm({ vendorId, kinds }: { vendorId: string; kinds: VendorDocumentKind[] }) {
  const t = useTranslations("VendorRecords");
  const [state, action, pending] = useActionState<RecordFormState, FormData>(requestVendorDocumentAction, {});
  return (
    <form action={action} className="vendor-filters">
      <input type="hidden" name="vendorId" value={vendorId} />
      <label>
        {t("requestKind")}
        <select name="kindId" defaultValue={kinds[0]?.id}>
          {kinds.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("requestSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("requestSent")}</p> : null}
    </form>
  );
}

export function VendorDocumentValidityForm({ vendorId, documentId, validUntil, label }: { vendorId: string; documentId: string; validUntil: string | null; label: string }) {
  const t = useTranslations("VendorRecords");
  const [state, action, pending] = useActionState<RecordFormState, FormData>(setVendorDocumentValidityAction, {});
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="documentId" value={documentId} />
      <label>
        <span className="sr-only">{t("validUntilFor", { document: label })}</span>
        <input type="date" name="validUntil" defaultValue={validUntil ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("validUntilSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function VendorNoteForm({ vendorId, note, confidential }: { vendorId: string; note: string | null; confidential: boolean }) {
  const t = useTranslations("VendorRecords");
  const [state, action, pending] = useActionState<RecordFormState, FormData>(saveVendorNoteAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="vendorId" value={vendorId} />
      <label>
        {t("note")}
        <textarea name="note" rows={4} maxLength={10000} defaultValue={note ?? ""} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="confidential" defaultChecked={confidential} />
        {t("noteConfidential")}
      </label>
      <p className="muted">{t("noteConfidentialHint")}</p>
      <button type="submit" disabled={pending}>
        {t("noteSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("noteSaved")}</p> : null}
    </form>
  );
}
