"use client";

import { useTranslations } from "next-intl";
import type { ClientKind, InvoiceView } from "@/modules/quotes/service";
import { QuoteActionForm } from "./quote-forms";
import { issueBalanceInvoiceAction, issueCreditNoteAction, issueDepositInvoiceAction, setClientKindAction } from "./invoice-actions";

export function ClientKindForm({ quoteId, clientKind }: { quoteId: string; clientKind: ClientKind }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={setClientKindAction} quoteId={quoteId} label={t("clientKind")} submitLabel={t("saveClientKind")} successMessage={t("clientKindSaved")}>
      <label htmlFor="client-kind">{t("clientKind")}</label>
      <select id="client-kind" name="clientKind" defaultValue={clientKind}>
        <option value="individual">{t("clientIndividual")}</option>
        <option value="professional">{t("clientProfessional")}</option>
      </select>
    </QuoteActionForm>
  );
}

export function IssueDepositInvoiceForm({ quoteId, scheduleItemId, label }: { quoteId: string; scheduleItemId: string; label: string }) {
  const t = useTranslations("Quotes");
  const name = t("issueDepositInvoiceFor", { label });
  return (
    <QuoteActionForm action={issueDepositInvoiceAction} quoteId={quoteId} label={name} submitLabel={name} successMessage={t("invoiceIssued")}>
      <input type="hidden" name="scheduleItemId" value={scheduleItemId} />
    </QuoteActionForm>
  );
}

export function IssueBalanceInvoiceForm({ quoteId }: { quoteId: string }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={issueBalanceInvoiceAction}
      quoteId={quoteId}
      label={t("issueBalanceInvoice")}
      submitLabel={t("issueBalanceInvoice")}
      successMessage={t("invoiceIssued")}
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
    >
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <label htmlFor={id("amount")}>{t("creditNoteAmount")}</label>
      <input id={id("amount")} type="text" inputMode="decimal" name="amount" required />
      <label htmlFor={id("reason")}>{t("creditNoteReason")}</label>
      <input id={id("reason")} type="text" name="reason" required />
    </QuoteActionForm>
  );
}
