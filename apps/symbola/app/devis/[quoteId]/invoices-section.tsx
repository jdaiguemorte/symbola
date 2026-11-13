import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { InvoiceView, MissingMention, QuoteDetail, ReceiptView, ScheduledDepositView } from "@/modules/quotes/service";
import { MissingMentionsList } from "../missing-mentions";
import { ClientKindForm, CreditNoteForm, IssueBalanceInvoiceForm, IssueDepositInvoiceForm } from "./invoice-forms";

// DEV-04 — factures d'un devis signé : émission (acompte par échéance,
// solde), liste des factures émises et de leurs avoirs, PDF. Lot 31c (D21) : un devis à arrhes n'a
// pas de facture d'arrhes ; ses reçus (non fiscaux, créés à l'encaissement) sont listés ici.
export async function InvoicesSection({
  quote,
  invoices,
  locale,
  scheduled = null,
  receipts = [],
}: {
  quote: QuoteDetail;
  invoices: InvoiceView[];
  locale: Locale;
  receipts?: ReceiptView[];
  // Lot 31b (FAC-05, D6) : facture d'acompte émise d'elle-même, en attente ou bloquée.
  scheduled?: ScheduledDepositView | null;
}) {
  const t = await getTranslations("Quotes");
  const tContracts = await getTranslations("Contracts");
  const mentionFields = (scheduled?.missingFields ?? []).filter((field): field is MissingMention => field !== "unavailable");
  if (quote.status !== "signed" && invoices.length === 0 && receipts.length === 0) return null;
  const active = invoices.filter((invoice) => invoice.amountCents - invoice.creditedCents > 0);
  const balanceIssued = active.some((invoice) => invoice.kind === "balance");
  const invoicedItems = new Set(active.flatMap((invoice) => (invoice.scheduleItemId ? [invoice.scheduleItemId] : [])));
  const earnest = quote.current.advanceKind === "earnest";
  const pendingItems = balanceIssued || earnest ? [] : quote.current.schedule.items.filter((item) => !invoicedItems.has(item.id));

  return (
    <section aria-labelledby="invoices-title">
      <h2 id="invoices-title">{t("invoicesTitle")}</h2>
      {scheduled && scheduled.status === "waiting" ? (
        <p role="status">{tContracts("depositWaiting", { label: scheduled.scheduleItemLabel, date: formatCalendarDate(scheduled.issueOn, locale) })}</p>
      ) : null}
      {scheduled && scheduled.status === "blocked" ? (
        <div role="note" className="missing-mentions-panel">
          <p>{tContracts("depositBlocked", { label: scheduled.scheduleItemLabel })}</p>
          {mentionFields.length > 0 ? <MissingMentionsList fields={mentionFields} /> : <p>{tContracts("depositUnavailable")}</p>}
        </div>
      ) : null}
      {scheduled?.paymentNotBefore && scheduled.status !== "issued" ? (
        <p className="meta">{tContracts("depositNoPaymentBefore", { date: formatCalendarDate(scheduled.paymentNotBefore, locale) })}</p>
      ) : null}
      {quote.status === "signed" ? (
        <>
          <ClientKindForm quoteId={quote.id} clientKind={quote.clientKind} />
          {quote.clientKind === "professional" ? <p role="status">{t("professionalInvoiceNotSupported")}</p> : null}
          {earnest && quote.current.schedule.items.length > 0 ? <p className="meta">{t("earnestNoInvoice")}</p> : null}
          {pendingItems.map((item) => (
            <IssueDepositInvoiceForm key={item.id} quoteId={quote.id} scheduleItemId={item.id} label={item.label} />
          ))}
          {!balanceIssued ? <IssueBalanceInvoiceForm quoteId={quote.id} /> : null}
        </>
      ) : null}
      {invoices.length === 0 ? <p>{t("noInvoices")}</p> : null}
      <ul>
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <p>
              <strong>{invoice.number}</strong> — {t(invoice.kind === "deposit" ? "invoiceKindDeposit" : "invoiceKindBalance")}
              {invoice.depositLabel ? ` (${invoice.depositLabel})` : ""} — {formatCalendarDate(invoice.issuedOn, locale)} —{" "}
              {formatAmount(invoice.amountCents, locale)}
              {invoice.creditedCents > 0 ? ` — ${t("credited", { amount: formatAmount(invoice.creditedCents, locale) })}` : ""} —{" "}
              <a href={`/devis/factures/${invoice.id}/pdf`}>{t("downloadInvoicePdf", { number: invoice.number })}</a>
            </p>
            {invoice.creditNotes.length > 0 ? (
              <ul>
                {invoice.creditNotes.map((note) => (
                  <li key={note.id}>
                    {note.number} — {formatCalendarDate(note.issuedOn, locale)} — {formatAmount(note.amountCents, locale)} — {note.reason} —{" "}
                    <a href={`/devis/avoirs/${note.id}/pdf`}>{t("downloadCreditNotePdf", { number: note.number })}</a>
                  </li>
                ))}
              </ul>
            ) : null}
            {invoice.amountCents - invoice.creditedCents > 0 ? (
              <details>
                <summary>{t("issueCreditNoteFor", { number: invoice.number })}</summary>
                <CreditNoteForm quoteId={quote.id} invoice={invoice} />
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      {receipts.length > 0 ? (
        <>
          <h3 id="receipts-title">{t("receiptsTitle")}</h3>
          <ul aria-labelledby="receipts-title">
            {receipts.map((receipt) => (
              <li key={receipt.id}>
                <strong>{receipt.number}</strong> —{" "}
                {t("receiptLine", { label: receipt.label, amount: formatAmount(receipt.amountCents, locale), date: formatCalendarDate(receipt.paidOn, locale) })}
                {receipt.cancelled ? ` — ${t("receiptCancelled")}` : ""} — <a href={`/devis/recus/${receipt.id}/pdf`}>{t("downloadReceiptPdf", { number: receipt.number })}</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
