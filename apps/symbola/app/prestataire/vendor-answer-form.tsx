"use client";

// Lot 47 (PRE-04 ; D3, D4 ; ADR 0085) — la réponse du prestataire, pensée pour le téléphone : une
// action principale par écran. 1) « Je suis disponible » (ou le choix présélectionné par le bouton
// de l'e-mail, à confirmer d'un toucher : rien n'est enregistré à l'ouverture du lien) ; 2) le dépôt
// du devis, photo ou PDF, montant TTC facultatif, message court ; 3) « Merci ». Dans l'aperçu « vu
// par » de la planner, tout est inactif.
import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { answerAvailabilityAction, type VendorAnswerState } from "./actions";

type Answer = { availability: "available" | "unavailable" | null; hasQuote: boolean };

export function VendorAnswerForm({ answer, canAnswer, preselected, preview }: { answer: Answer; canAnswer: boolean; preselected: "available" | "unavailable" | null; preview: boolean }) {
  const t = useTranslations("VendorAnswer");
  const [state, action, pending] = useActionState<VendorAnswerState, FormData>(answerAvailabilityAction, {});
  const [quoteState, quoteAction, quotePending] = useUploadAction<UploadState>("/prestataire/devis");
  const [changing, setChanging] = useState(false);
  const fileId = useId();
  const disabled = preview || !canAnswer;

  if (state.error) return <p role="alert">{t("errors.closed")}</p>;

  // Réponse donnée : « Merci », et « changer d'avis » tant que la planner n'a pas tranché.
  const done = answer.availability === "unavailable" || (answer.availability === "available" && answer.hasQuote);
  if (done && !changing) {
    return (
      <div className="vendor-answer" role="status">
        <p>{answer.availability === "unavailable" ? t("thanksUnavailable") : t("thanksQuote")}</p>
        {canAnswer ? (
          <button type="button" className="link-button" onClick={() => setChanging(true)} disabled={preview}>
            {t("changeMind")}
          </button>
        ) : null}
      </div>
    );
  }

  // Disponible, sans devis : l'écran du dépôt.
  if (answer.availability === "available" && !changing) {
    return (
      <form action={preview ? undefined : quoteAction} className="vendor-answer">
        <h2>{t("depositTitle")}</h2>
        <p>{t("depositIntro")}</p>
        <label htmlFor={fileId}>{t("quoteFile")}</label>
        <input id={fileId} type="file" name="quote" accept="image/*,application/pdf" capture="environment" required disabled={disabled} />
        <label>
          {t("amount")}
          <input type="text" name="amount" inputMode="decimal" autoComplete="off" disabled={disabled} />
        </label>
        <label>
          {t("message")}
          <textarea name="message" rows={2} maxLength={1000} disabled={disabled} />
        </label>
        <button type="submit" className="primary" disabled={disabled || quotePending}>
          {t("sendQuote")}
        </button>
        {quoteState.error ? <p role="alert">{quoteState.error}</p> : null}
        <p className="muted">{t("depositLater")}</p>
      </form>
    );
  }

  // Le choix : le bouton principal suit la présélection de l'e-mail ; l'autre réponse reste possible.
  const primary = preselected ?? "available";
  const secondary = primary === "available" ? "unavailable" : "available";
  return (
    <form action={preview ? undefined : action} className="vendor-answer">
      <h2>{t("question")}</h2>
      {preselected ? <p role="status">{t(preselected === "available" ? "preselectedAvailable" : "preselectedUnavailable")}</p> : null}
      <div className="choice">
        <button type="submit" name="availability" value={primary} className="primary" disabled={disabled || pending}>
          {t(primary === "available" ? (preselected ? "confirmAvailable" : "available") : "confirmUnavailable")}
        </button>
        <button type="submit" name="availability" value={secondary} disabled={disabled || pending}>
          {t(secondary === "available" ? "available" : "unavailable")}
        </button>
      </div>
      {!canAnswer ? <p className="muted">{t("closed")}</p> : null}
    </form>
  );
}

export function VendorInvoiceForm({ preview }: { preview: boolean }) {
  const t = useTranslations("VendorAnswer");
  const [state, action, pending] = useUploadAction<UploadState>("/prestataire/facture");
  const fileId = useId();
  return (
    <form action={preview ? undefined : action} className="vendor-answer">
      <label htmlFor={fileId}>{t("invoiceFile")}</label>
      <input id={fileId} type="file" name="invoice" accept="image/*,application/pdf" required disabled={preview} />
      <button type="submit" disabled={preview || pending}>
        {t("sendInvoice")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("invoiceSent")}</p> : null}
    </form>
  );
}
