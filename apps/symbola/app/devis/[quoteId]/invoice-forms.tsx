"use client";

import { useTranslations } from "next-intl";
import type { ClientKind, InvoiceView } from "@/modules/quotes/service";
import { QuoteActionForm } from "./quote-forms";
import { issueBalanceInvoiceAction, issueCreditNoteAction, issueDepositInvoiceAction, setClientKindAction } from "./invoice-actions";

export function ClientKindForm({ quoteId, clientKind }: { quoteId: string; clientKind: ClientKind }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={setClientKindAction} quoteId={quoteId} label={t("clientKind")} submitLabel={t("saveClientKind")} successMessage={t("clientKindSaved")} layout="row">
      <label htmlFor="client-kind" className="field-fit">
        {t("clientKind")}
        <select id="client-kind" name="clientKind" defaultValue={clientKind}>
          <option value="individual">{t("clientIndividual")}</option>
          {/* Lot 31b (réponse 3 de l'avocat, D16) : association, SCI… */}
          <option value="non_professional">{t("clientNonProfessional")}</option>
          <option value="professional">{t("clientProfessional")}</option>
        </select>
      </label>
    </QuoteActionForm>
  );
}

// Lot 62d : `primary`, la prochaine pièce à émettre (le seul bouton principal de l'écran).
export function IssueDepositInvoiceForm({ quoteId, scheduleItemId, label, primary = false }: { quoteId: string; scheduleItemId: string; label: string; primary?: boolean }) {
  const t = useTranslations("Quotes");
  const name = t("issueDepositInvoiceFor", { label });
  return (
    <QuoteActionForm action={issueDepositInvoiceAction} quoteId={quoteId} label={name} submitLabel={name} successMessage={t("invoiceIssued")} primary={primary}>
      <input type="hidden" name="scheduleItemId" value={scheduleItemId} />
    </QuoteActionForm>
  );
}

export function IssueBalanceInvoiceForm({ quoteId, primary = false }: { quoteId: string; primary?: boolean }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={issueBalanceInvoiceAction}
      quoteId={quoteId}
      label={t("issueBalanceInvoice")}
      submitLabel={t("issueBalanceInvoice")}
      successMessage={t("invoiceIssued")}
      primary={primary}
    >
      <p>{t("issueInvoiceHint")}</p>
    </QuoteActionForm>
  );
}

export function CreditNoteForm({ quoteId, invoice }: { quoteId: string; invoice: InvoiceView }) {
  const t = useTranslations("Quotes");
  const id = (name: string) => `${name}-${invoice.id}`;
  return (
    <QuoteActionForm
      action={issueCreditNoteAction}
      quoteId={quoteId}
      label={t("issueCreditNoteFor", { number: invoice.number })}
      submitLabel={t("issueCreditNote")}
      successMessage={t("creditNoteIssued")}
      layout="row"
    >
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <label htmlFor={id("amount")} className="field-fit">
        {t("creditNoteAmount")}
        <input id={id("amount")} type="text" inputMode="decimal" name="amount" required className="field-amount" />
      </label>
      <label htmlFor={id("reason")}>
        {t("creditNoteReason")}
        <input id={id("reason")} type="text" name="reason" required />
      </label>
    </QuoteActionForm>
  );
}
