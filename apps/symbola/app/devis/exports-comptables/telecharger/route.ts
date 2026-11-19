// Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097) — téléchargement d'un export comptable : la Propriétaire, les
// Planners et le Comptable (lecture seule, lot 52), module des devis souscrit (contrôle côté serveur).
// Le contrôle de rapprochement passe d'abord : un écart bloque (409, rien n'est servi) et la demande est
// tracée ; sinon le fichier part, tracé lui aussi (table en ajout seul et journal d'audit).
import { getLocale } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { getOrganizationContact, getOrganizationProfile } from "@/modules/hub/service";
import {
  AccountingExportFormatError,
  getAccountingSettings,
  getCommissionInvoicePdf,
  getCreditNotePdf,
  getInvoicePdf,
  InvoiceNotFoundError,
  produceAccountingExport,
  type SaleDocument,
} from "@/modules/quotes/service";
import { authorizedAccountingReader } from "../../planner-access";
import { renderCreditNotePdf, renderInvoicePdf } from "../../factures/render-invoice-pdf";
import { exportWords, parseFormat, parsePeriod } from "../export-query";

export async function GET(request: Request): Promise<Response> {
  const reader = await authorizedAccountingReader();
  if (!reader) return new Response(null, { status: 401 });
  const url = new URL(request.url);
  const format = parseFormat(url.searchParams.get("format"));
  if (!format) return new Response(null, { status: 404 });
  const { organizationId } = reader;
  const locale = ((await getLocale()) === "en" ? "en" : "fr") as Locale & ("fr" | "en");
  const settings = await getAccountingSettings(organizationId, locale);
  const period = parsePeriod(Object.fromEntries(url.searchParams.entries()), settings.fiscalYearStartMonth);
  const db = appDatabase();
  const [profile, contact] = await Promise.all([getOrganizationProfile(db, organizationId), getOrganizationContact(db, organizationId)]);
  const readOriginal = async (document: SaleDocument): Promise<Uint8Array | null> => {
    try {
      if (document.kind === "credit_note") return (await getCreditNotePdf(organizationId, document.id, (note, vatApplicable) => renderCreditNotePdf(organizationId, note, vatApplicable))).pdf;
      try {
        return (await getInvoicePdf(organizationId, document.id, (invoice) => renderInvoicePdf(organizationId, invoice))).pdf;
      } catch (error) {
        if (!(error instanceof InvoiceNotFoundError)) throw error;
        return (await getCommissionInvoicePdf(organizationId, document.id, (invoice) => renderInvoicePdf(organizationId, invoice))).pdf;
      }
    } catch {
      // Original absent ou altéré : le contrôle le nomme et bloque l'archive.
      return null;
    }
  };
  let produced;
  try {
    produced = await produceAccountingExport({ organizationId, format, period, siren: profile.siren, locale, words: await exportWords(period, contact.name, locale), readOriginal });
  } catch (error) {
    if (error instanceof AccountingExportFormatError) return new Response(null, { status: 404 });
    throw error;
  }
  if (!produced.file) return new Response(null, { status: 409, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(produced.file.content), {
    headers: {
      "Content-Type": produced.file.mime,
      "Content-Disposition": `attachment; filename="${produced.file.name}"`,
      "Cache-Control": "no-store",
    },
  });
}
