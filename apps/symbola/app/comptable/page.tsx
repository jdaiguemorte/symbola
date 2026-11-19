// Lot 52 (HUB-04 ; réponse de Julien du 18/11 au lot 58 ; ADR 0094) — l'accueil du Comptable, en lecture
// seule : factures et avoirs émis (originaux téléchargeables), par année, et les liens vers les
// encaissements, les journaux (écritures CSV) et l'e-reporting. Aucun évènement, invité, contact hors
// facture ni réglage. Sans module Devis et factures : l'écran le dit (dégradation propre).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatDateTime, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireAccountant } from "@/lib/guards";
import { getOrganizationContact } from "@/modules/hub/service";
import { commissionInvoiceIds, listLedgerEntries, listLedgerYears } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";

type Query = { annee?: string };

export default async function AccountingPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requireAccountant();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Accounting");
  const tHelp = await getTranslations("Help");
  const organization = (await getOrganizationContact(appDatabase(), organizationId)).name;
  const header = <PageHeader title={t("title", { organization })} subtitle={t("subtitle")} />;
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        {header}
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const years = await listLedgerYears(organizationId);
  const year = years.includes(Number(query.annee)) ? Number(query.annee) : years[0];
  const documents = year === undefined ? [] : (await listLedgerEntries(organizationId, year)).filter((entry) => entry.kind === "invoice" || entry.kind === "credit_note");
  // Décision de Julien du 19/11 : les factures de commission au prestataire (lot 48b), lues comme les autres.
  const commissions = await commissionInvoiceIds(organizationId, documents.filter((entry) => entry.kind === "invoice").map((entry) => entry.objectId));
  const documentKind = (entry: (typeof documents)[number]) => (entry.kind === "credit_note" ? "credit_note" : commissions.has(entry.objectId) ? "commission_invoice" : "invoice");
  const documentHref = (entry: (typeof documents)[number]) =>
    entry.kind === "credit_note" ? `/devis/avoirs/${entry.objectId}/pdf` : commissions.has(entry.objectId) ? `/devis/argent/factures/${entry.objectId}` : `/devis/factures/${entry.objectId}/pdf`;
  return (
    <main>
      {header}
      <ScreenHelp title={tHelp("accounting.title")} body={tHelp("accounting.body")} />
      <p>
        <span className="badge">{t("readOnly")}</span>
      </p>
      <section aria-labelledby="documents-title" className="settings-block">
        <h2 id="documents-title">{t("documentsTitle")}</h2>
        {years.length > 1 ? (
          <nav aria-label={t("year")}>
            <ul className="row-wrap">
              {years.map((candidate) => (
                <li key={candidate}>
                  <Link href={`/comptable?annee=${candidate}`} aria-current={candidate === year ? "page" : undefined}>
                    {candidate}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {documents.length === 0 ? (
          <p>{t("noDocuments")}</p>
        ) : (
          <div className="list-table-wrap" role="region" aria-label={t("documentsTable")} tabIndex={0}>
            <table className="list-table">
              <thead>
                <tr>
                  <th scope="col">{t("number")}</th>
                  <th scope="col">{t("kind")}</th>
                  <th scope="col">{t("date")}</th>
                  <th scope="col">{t("amount")}</th>
                  <th scope="col">{t("download")}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((entry) => (
                  <tr key={entry.sequence}>
                    <th scope="row">{entry.number}</th>
                    <td>{t(`kinds.${documentKind(entry)}`)}</td>
                    <td className="num">{formatDateTime(entry.recordedAt, locale)}</td>
                    <td className="num">{entry.amountCents === null ? "—" : formatAmount(entry.amountCents, locale)}</td>
                    <td>
                      <a href={documentHref(entry)} aria-label={t("downloadLabel", { number: entry.number ?? "" })}>
                        {t("download")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="links-title" className="settings-block">
        <h2 id="links-title">{t("linksTitle")}</h2>
        <ul>
          <li>
            <Link href="/devis/encaissements">{t("links.payments")}</Link>
          </li>
          <li>
            <Link href="/devis/exports-comptables">{t("links.exports")}</Link>
          </li>
          <li>
            <Link href="/devis/parametres/archive">{t("links.ledger")}</Link>
          </li>
          <li>
            <Link href="/devis/e-reporting">{t("links.eReporting")}</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
