import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { InvoiceView, QuoteDetail } from "@/modules/quotes/service";
import { ClientKindForm, CreditNoteForm, IssueBalanceInvoiceForm, IssueDepositInvoiceForm } from "./invoice-forms";

// DEV-04 — factures d'un devis signé : émission (acompte par échéance,
// solde), liste des factures émises et de leurs avoirs, PDF.
export async function InvoicesSection({ quote, invoices, locale }: { quote: QuoteDetail; invoices: InvoiceView[]; locale: Locale }) {
  const t = await getTranslations("Quotes");
  if (quote.status !== "signed" && invoices.length === 0) return null;
  const active = invoices.filter((invoice) => invoice.amountCents - invoice.creditedCents > 0);
  const balanceIssued = active.some((invoice) => invoice.kind === "balance");
  const invoicedItems = new Set(active.flatMap((invoice) => (invoice.scheduleItemId ? [invoice.scheduleItemId] : [])));
  const pendingItems = balanceIssued ? [] : quote.current.schedule.items.filter((item) => !invoicedItems.has(item.id));

  return (
    <section aria-labelledby="invoices-title">
      <h2 id="invoices-title">{t("invoicesTitle")}</h2>
      {quote.status === "signed" ? (
        <>
          <ClientKindForm quoteId={quote.id} clientKind={quote.clientKind} />
          {quote.clientKind === "professional" ? <p role="status">{t("professionalInvoiceNotSupported")}</p> : null}
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
    </section>
  );
}
