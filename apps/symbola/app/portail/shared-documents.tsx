// Lot 37a (POR-04, POR-10, DOC-01 ; D5, D6 ; ADR 0070) — documents partagés avec un tiers, au
// portail des clients et à l'espace d'un prestataire : chacun s'aperçoit dans un onglet du
// navigateur ou se télécharge. Le même rendu sert l'aperçu « vu par » de la planner (preview) :
// fichiers fermés, aucune trace sur le lien.
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatFileSize, type Locale } from "@symbola/i18n";
import type { EventDocument, InvoiceView } from "@symbola/contracts";
import { previewPath } from "@/lib/file-response";

function FileLinks({ path, label, preview, t }: { path: string; label: string; preview: boolean; t: Awaited<ReturnType<typeof getTranslations>> }) {
  if (preview) {
    return (
      <p className="document-links">
        <span>{t("preview")}</span>
        <span>{t("download")}</span>
      </p>
    );
  }
  return (
    <p className="document-links">
      <a href={previewPath(path)} target="_blank" rel="noopener noreferrer" aria-label={t("previewLabel", { label })}>
        {t("preview")}
      </a>
      <a href={path} download aria-label={t("downloadLabel", { label })}>
        {t("download")}
      </a>
    </p>
  );
}

export async function SharedDocuments({
  documents,
  basePath,
  invoices = [],
  locale,
  preview,
  headingId,
}: {
  documents: EventDocument[];
  basePath: "/portail/documents" | "/prestataire/documents";
  invoices?: InvoiceView[];
  locale: Locale;
  preview: boolean;
  headingId: string;
}) {
  const t = await getTranslations("EventDocuments");
  const tShared = await getTranslations("SharedDocuments");
  return (
    <section aria-labelledby={headingId} id="documents">
      <h2 id={headingId}>{tShared("title")}</h2>
      <p className="meta">{tShared("hint")}</p>
      {documents.length > 0 ? (
        <ul className="item-list event-documents" aria-label={tShared("documentsLabel")}>
          {documents.map((document) => (
            <li key={document.id}>
              <div>
                <strong>{document.label}</strong>
                <p className="meta">{[t("versionNumber", { version: document.version }), formatFileSize(document.sizeBytes, locale)].join(" · ")}</p>
              </div>
              <FileLinks path={`${basePath}/${document.id}`} label={document.label} preview={preview} t={t} />
            </li>
          ))}
        </ul>
      ) : null}
      {invoices.length > 0 ? (
        <>
          <h3>{tShared("invoicesTitle")}</h3>
          <ul className="item-list event-documents" aria-label={tShared("invoicesTitle")}>
            {invoices.flatMap((invoice) => [
              <li key={invoice.id}>
                <div>
                  <strong>{t("moduleInvoice", { number: invoice.number })}</strong>
                  <p className="meta">{tShared("invoiceDetail", { date: formatCalendarDate(invoice.issuedOn, locale), amount: formatAmount(invoice.amountCents, locale) })}</p>
                </div>
                <FileLinks path={`/portail/factures/${invoice.id}`} label={t("moduleInvoice", { number: invoice.number })} preview={preview} t={t} />
              </li>,
              ...invoice.creditNotes.map((creditNote) => (
                <li key={creditNote.id}>
                  <div>
                    <strong>{t("moduleCreditNote", { number: creditNote.number })}</strong>
                    <p className="meta">{tShared("creditNoteDetail", { invoice: invoice.number, date: formatCalendarDate(creditNote.issuedOn, locale), amount: formatAmount(creditNote.amountCents, locale) })}</p>
                  </div>
                  <FileLinks path={`/portail/avoirs/${creditNote.id}`} label={t("moduleCreditNote", { number: creditNote.number })} preview={preview} t={t} />
                </li>
              )),
            ])}
          </ul>
        </>
      ) : null}
    </section>
  );
}
