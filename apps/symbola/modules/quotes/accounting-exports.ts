// Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097) — exports comptables, côté module des devis : lecture des
// factures, avoirs et encaissements d'une période (jamais les pièces d'essai, DAT-10), totaux de la
// base calculés à part (sommes SQL) pour le contrôle de rapprochement, réglages (exercice, plan de
// comptes), production du fichier et trace de chaque export (table en ajout seul et journal d'audit).
// Le format proposé suit la forme juridique du profil (D1) ; un écart bloque l'export (D3).
import { and, asc, between, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { withOrganization } from "@symbola/db/with-organization";
import {
  accountingExports,
  accountingExportSettings,
  creditNotes,
  invoices,
  numberSeries,
  paymentEntries,
  paymentScheduleItems,
  quoteVersions,
  vendorCommissions,
  type AccountingAccountsOverride,
  type AccountingJournalsOverride,
} from "@symbola/db/schema/quotes";
import { createZip, toCsv } from "@symbola/privacy";
import { ACCOUNT_KEYS, JOURNAL_KEYS, starterAccountingFamily, starterAccountingPlan, type AccountingFamily } from "@symbola/starter-templates";
import {
  checkFecStructure,
  exportFileName,
  fecFileName,
  fecText,
  formatAllowedForPeriod,
  FORMATS_BY_FAMILY,
  journalRows,
  paymentLines,
  receiptsJournalRows,
  reconcile,
  salesLines,
  type AccountingFormat,
  type AccountingPlan,
  type CashEntry,
  type DocumentTotals,
  type HeaderWords,
  type JournalWords,
  type Period,
  type Reconciliation,
  type SaleDocument,
} from "./accounting-export-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

// —— Réglages ———————————————————————————————————————————————————————————————————————————————

export type AccountingSettingsView = { fiscalYearStartMonth: number; plan: AccountingPlan; customized: boolean };

export class AccountingSettingsError extends Error {
  constructor(readonly field: "month" | "account" | "journal") {
    super(`réglages comptables : ${field} invalide`);
    this.name = "AccountingSettingsError";
  }
}

export async function getAccountingSettings(organizationId: string, locale: "fr" | "en"): Promise<AccountingSettingsView> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(accountingExportSettings));
  const starter = starterAccountingPlan(locale);
  const accounts = { ...starter.accounts };
  for (const key of ACCOUNT_KEYS) {
    const override = (row?.accounts as AccountingAccountsOverride | undefined)?.[key];
    if (override) accounts[key] = { number: override.number, label: override.label };
  }
  const journals = { ...starter.journals };
  for (const key of JOURNAL_KEYS) {
    const override = (row?.journals as AccountingJournalsOverride | undefined)?.[key];
    if (override) journals[key] = { code: override.code, label: override.label };
  }
  const customized = Object.keys(row?.accounts ?? {}).length > 0 || Object.keys(row?.journals ?? {}).length > 0;
  return { fiscalYearStartMonth: row?.fiscalYearStartMonth ?? 1, plan: { accounts, journals }, customized };
}

// La planner règle l'exercice et, si son comptable le demande, les comptes et les codes des journaux ;
// une valeur égale à celle de départ n'est pas gardée.
export async function saveAccountingSettings(organizationId: string, input: { fiscalYearStartMonth: number; accounts: Partial<Record<(typeof ACCOUNT_KEYS)[number], { number: string; label: string }>>; journals: Partial<Record<(typeof JOURNAL_KEYS)[number], { code: string; label: string }>> }, locale: "fr" | "en"): Promise<AccountingSettingsView> {
  if (!Number.isInteger(input.fiscalYearStartMonth) || input.fiscalYearStartMonth < 1 || input.fiscalYearStartMonth > 12) throw new AccountingSettingsError("month");
  const starter = starterAccountingPlan(locale);
  const accounts: AccountingAccountsOverride = {};
  for (const key of ACCOUNT_KEYS) {
    const value = input.accounts[key];
    if (!value) continue;
    const number = value.number.trim().toUpperCase();
    const label = value.label.replace(/\s+/g, " ").trim();
    if (!/^[0-9A-Z]{1,20}$/.test(number) || label.length < 1 || label.length > 100) throw new AccountingSettingsError("account");
    if (number !== starter.accounts[key].number || label !== starter.accounts[key].label) accounts[key] = { number, label };
  }
  const journals: AccountingJournalsOverride = {};
  for (const key of JOURNAL_KEYS) {
    const value = input.journals[key];
    if (!value) continue;
    const code = value.code.trim().toUpperCase();
    const label = value.label.replace(/\s+/g, " ").trim();
    if (!/^[A-Z0-9]{1,10}$/.test(code) || label.length < 1 || label.length > 100) throw new AccountingSettingsError("journal");
    if (code !== starter.journals[key].code || label !== starter.journals[key].label) journals[key] = { code, label };
  }
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(accountingExportSettings)
      .values({ organizationId, fiscalYearStartMonth: input.fiscalYearStartMonth, accounts, journals })
      .onConflictDoUpdate({ target: accountingExportSettings.organizationId, set: { fiscalYearStartMonth: input.fiscalYearStartMonth, accounts, journals, updatedAt: new Date() } }),
  );
  return getAccountingSettings(organizationId, locale);
}

// D1 : la famille proposée, déduite de la forme juridique (lue par l'appelant au profil du hub).
export function accountingFamilyFor(legalForm: string | null): { family: AccountingFamily; formats: readonly AccountingFormat[] } {
  const family = starterAccountingFamily(legalForm);
  return { family, formats: FORMATS_BY_FAMILY[family] };
}

// —— Données d'une période ——————————————————————————————————————————————————————————————————

type InvoiceTotalsSnapshot = { totals?: DocumentTotals };

function buyerName(snapshot: unknown): string {
  return Array.isArray(snapshot) ? snapshot.map((buyer) => String((buyer as { name?: unknown }).name ?? "").trim()).filter(Boolean).join(" & ") : "";
}

function invoiceTotals(snapshot: unknown, amountCents: number): DocumentTotals {
  const totals = (snapshot as InvoiceTotalsSnapshot | null)?.totals;
  return totals ?? { totalHtCents: amountCents, vatByRate: [], totalVatCents: 0, totalTtcCents: amountCents };
}

function creditTotals(snapshot: unknown, amountCents: number): DocumentTotals {
  const totals = snapshot as DocumentTotals | null;
  return totals && typeof totals.totalTtcCents === "number" ? totals : { totalHtCents: amountCents, vatByRate: [], totalVatCents: 0, totalTtcCents: amountCents };
}

function parisDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type PeriodData = {
  documents: SaleDocument[];
  numbered: { kind: "invoice" | "credit_note"; number: string; issuedOn: string }[];
  lastAssigned: { kind: "invoice" | "credit_note"; year: number; lastNumber: number }[];
  cash: CashEntry[];
  expected: { invoicedCents: number; creditedCents: number; receivedCents: number };
};

export async function loadPeriodData(organizationId: string, period: { start: string; end: string }): Promise<PeriodData> {
  const startYear = Number(period.start.slice(0, 4));
  const endYear = Number(period.end.slice(0, 4));
  const yearStart = `${startYear}-01-01`;
  const yearEnd = `${endYear}-12-31`;
  return inOrganization(organizationId, async (tx) => {
    const invoiceRows = await tx
      .select({ id: invoices.id, number: invoices.number, issuedOn: invoices.issuedOn, amountCents: invoices.amountCents, buyers: invoices.buyerSnapshot, totals: invoices.totalsSnapshot, quoteId: invoices.quoteId, scheduleItemId: invoices.scheduleItemId, kind: invoices.kind, commissionId: invoices.commissionId })
      .from(invoices)
      .where(and(eq(invoices.isDemo, false), between(invoices.issuedOn, yearStart, yearEnd)))
      .orderBy(asc(invoices.issuedOn), asc(invoices.number));
    const creditRows = await tx
      .select({ id: creditNotes.id, number: creditNotes.number, issuedOn: creditNotes.issuedOn, amountCents: creditNotes.amountCents, buyers: creditNotes.buyerSnapshot, totals: creditNotes.totalsSnapshot })
      .from(creditNotes)
      .where(and(eq(creditNotes.isDemo, false), between(creditNotes.issuedOn, yearStart, yearEnd)))
      .orderBy(asc(creditNotes.issuedOn), asc(creditNotes.number));
    const series = await tx
      .select({ kind: numberSeries.kind, year: numberSeries.year, lastNumber: numberSeries.lastNumber })
      .from(numberSeries)
      .where(and(eq(numberSeries.isDemo, false), inArray(numberSeries.kind, ["invoice", "credit_note"]), between(numberSeries.year, startYear, endYear)));

    const inPeriod = (day: string) => day >= period.start && day <= period.end;
    const documents: SaleDocument[] = [
      ...invoiceRows.filter((row) => inPeriod(row.issuedOn)).map((row) => ({ kind: "invoice" as const, id: row.id, number: row.number, issuedOn: row.issuedOn, buyerName: buyerName(row.buyers), amountCents: row.amountCents, totals: invoiceTotals(row.totals, row.amountCents) })),
      ...creditRows.filter((row) => inPeriod(row.issuedOn)).map((row) => ({ kind: "credit_note" as const, id: row.id, number: row.number, issuedOn: row.issuedOn, buyerName: buyerName(row.buyers), amountCents: row.amountCents, totals: creditTotals(row.totals, row.amountCents) })),
    ];

    // Encaissements : ceux d'une échéance d'un devis (et leurs annulations), puis les commissions
    // reçues d'un prestataire, facturées (lot 48b).
    const entries = await tx
      .select({ id: paymentEntries.id, kind: paymentEntries.kind, amountCents: paymentEntries.amountCents, paidOn: paymentEntries.paidOn, createdAt: paymentEntries.createdAt, method: paymentEntries.paymentMethodLabel, scheduleItemId: paymentEntries.scheduleItemId, quoteId: quoteVersions.quoteId })
      .from(paymentEntries)
      .innerJoin(paymentScheduleItems, eq(paymentScheduleItems.id, paymentEntries.scheduleItemId))
      .innerJoin(quoteVersions, eq(quoteVersions.id, paymentScheduleItems.versionId))
      .where(eq(paymentEntries.isDemo, false));
    const quoteInvoices = new Map<string, typeof invoiceRows>();
    const allInvoices = entries.length > 0 ? await tx.select({ id: invoices.id, number: invoices.number, issuedOn: invoices.issuedOn, amountCents: invoices.amountCents, buyers: invoices.buyerSnapshot, totals: invoices.totalsSnapshot, quoteId: invoices.quoteId, scheduleItemId: invoices.scheduleItemId, kind: invoices.kind, commissionId: invoices.commissionId }).from(invoices).where(and(eq(invoices.isDemo, false), isNotNull(invoices.quoteId))) : [];
    for (const row of allInvoices) quoteInvoices.set(row.quoteId!, [...(quoteInvoices.get(row.quoteId!) ?? []), row]);
    const entryDay = (entry: (typeof entries)[number]) => entry.paidOn ?? parisDay(entry.createdAt);
    const cash: CashEntry[] = entries
      .filter((entry) => inPeriod(entryDay(entry)))
      .map((entry) => {
        const related = quoteInvoices.get(entry.quoteId) ?? [];
        const invoice = related.find((row) => row.scheduleItemId === entry.scheduleItemId) ?? related.find((row) => row.kind === "balance") ?? related[0];
        return { id: entry.id, kind: entry.kind, on: entryDay(entry), method: entry.method, invoiceNumber: invoice?.number ?? null, clientName: invoice ? buyerName(invoice.buyers) : "", amountCents: entry.amountCents };
      });
    const commissions = await tx
      .select({ id: vendorCommissions.id, receivedOn: vendorCommissions.receivedOn, vendorName: vendorCommissions.vendorName, number: invoices.number, amountCents: invoices.amountCents })
      .from(vendorCommissions)
      .innerJoin(invoices, eq(invoices.commissionId, vendorCommissions.id))
      .where(and(eq(vendorCommissions.status, "received"), eq(invoices.isDemo, false), between(vendorCommissions.receivedOn, period.start, period.end)));
    for (const commission of commissions) cash.push({ id: commission.id, kind: "received", on: commission.receivedOn!, method: null, invoiceNumber: commission.number, clientName: commission.vendorName, amountCents: commission.amountCents });

    // Totaux de la base, par des sommes indépendantes de la construction des lignes (D3).
    const [invoiced] = await tx.select({ cents: sql<string>`coalesce(sum(${invoices.amountCents}), 0)` }).from(invoices).where(and(eq(invoices.isDemo, false), between(invoices.issuedOn, period.start, period.end)));
    const [credited] = await tx.select({ cents: sql<string>`coalesce(sum(${creditNotes.amountCents}), 0)` }).from(creditNotes).where(and(eq(creditNotes.isDemo, false), between(creditNotes.issuedOn, period.start, period.end)));
    const [received] = await tx
      .select({ cents: sql<string>`coalesce(sum(case when ${paymentEntries.kind} = 'received' then ${paymentEntries.amountCents} else -${paymentEntries.amountCents} end), 0)` })
      .from(paymentEntries)
      .where(and(eq(paymentEntries.isDemo, false), sql`coalesce(${paymentEntries.paidOn}, (${paymentEntries.createdAt} at time zone 'Europe/Paris')::date) between ${period.start}::date and ${period.end}::date`));
    const [commissionReceived] = await tx
      .select({ cents: sql<string>`coalesce(sum(${invoices.amountCents}), 0)` })
      .from(vendorCommissions)
      .innerJoin(invoices, eq(invoices.commissionId, vendorCommissions.id))
      .where(and(eq(vendorCommissions.status, "received"), eq(invoices.isDemo, false), gte(vendorCommissions.receivedOn, period.start), lte(vendorCommissions.receivedOn, period.end)));

    return {
      documents,
      numbered: [
        ...invoiceRows.map((row) => ({ kind: "invoice" as const, number: row.number, issuedOn: row.issuedOn })),
        ...creditRows.map((row) => ({ kind: "credit_note" as const, number: row.number, issuedOn: row.issuedOn })),
      ],
      lastAssigned: series.map((row) => ({ kind: row.kind as "invoice" | "credit_note", year: row.year, lastNumber: row.lastNumber })),
      cash,
      expected: { invoicedCents: Number(invoiced!.cents), creditedCents: Number(credited!.cents), receivedCents: Number(received!.cents) + Number(commissionReceived!.cents) },
    };
  });
}

// —— Export ——————————————————————————————————————————————————————————————————————————————————

export type ExportWords = {
  header: HeaderWords;
  periodLabel: string;
  organization: string;
  exportedOn: string;
  receipts: { columns: [string, string, string, string, string]; total: string };
  journal: { columns: JournalWords["columns"]; total: string };
  lines: { invoice: string; creditNote: string; payment: string; reversal: string };
};

export type AccountingFile = { name: string; mime: string; content: Uint8Array };

export class AccountingExportFormatError extends Error {
  constructor() {
    super("format non disponible pour cette période");
    this.name = "AccountingExportFormatError";
  }
}

export type OriginalReader = (document: SaleDocument) => Promise<Uint8Array | null>;

// Contrôle seul (l'écran l'affiche avant tout téléchargement) : rien n'est tracé.
export async function checkAccountingPeriod(organizationId: string, period: Period): Promise<{ reconciliation: Reconciliation; data: PeriodData }> {
  const data = await loadPeriodData(organizationId, period);
  return { reconciliation: reconcile({ period, ...data }), data };
}

// D3 : le contrôle d'abord ; un écart bloque, s'explique, et la demande est tracée (« blocked »). Sinon
// le fichier se produit et l'export est tracé (« done »), avec une copie au journal d'audit.
export async function produceAccountingExport(input: {
  organizationId: string;
  format: AccountingFormat;
  period: Period;
  siren: string | null;
  locale: "fr" | "en";
  words: ExportWords;
  readOriginal?: OriginalReader;
}): Promise<{ reconciliation: Reconciliation; file: AccountingFile | null }> {
  if (!formatAllowedForPeriod(input.format, input.period.kind)) throw new AccountingExportFormatError();
  const { data } = await checkAccountingPeriod(input.organizationId, input.period);
  const settings = await getAccountingSettings(input.organizationId, input.locale);
  const header = { periodLabel: input.words.periodLabel, organization: input.words.organization, exportedOn: input.words.exportedOn };

  let file: AccountingFile | null = null;
  const missingOriginals: string[] = [];
  const fecIssues: string[] = [];
  if (input.format === "receipts_journal") {
    const { rows } = receiptsJournalRows(data.cash, header, { ...input.words.header, ...input.words.receipts });
    file = { name: exportFileName("receipts_journal", input.period), mime: "text/csv; charset=utf-8", content: Buffer.from(toCsv(rows)) };
  } else if (input.format === "sales_journal") {
    const { rows } = journalRows(salesLines(data.documents, input.words.lines), settings.plan, header, { ...input.words.header, ...input.words.journal });
    file = { name: exportFileName("sales_journal", input.period), mime: "text/csv; charset=utf-8", content: Buffer.from(toCsv(rows)) };
  } else if (input.format === "payments_journal") {
    const { rows } = journalRows(paymentLines(data.cash, input.words.lines), settings.plan, header, { ...input.words.header, ...input.words.journal });
    file = { name: exportFileName("payments_journal", input.period), mime: "text/csv; charset=utf-8", content: Buffer.from(toCsv(rows)) };
  } else if (input.format === "fec") {
    const text = fecText([...salesLines(data.documents, input.words.lines), ...paymentLines(data.cash, input.words.lines)], settings.plan);
    fecIssues.push(...checkFecStructure(text));
    file = { name: fecFileName(input.siren, input.period.end), mime: "text/plain; charset=utf-8", content: Buffer.from(text) };
  } else {
    const entries: { name: string; data: Uint8Array }[] = [];
    for (const document of data.documents) {
      const pdf = input.readOriginal ? await input.readOriginal(document) : null;
      if (!pdf) missingOriginals.push(document.number);
      else entries.push({ name: `${document.kind === "invoice" ? "factures" : "avoirs"}/${document.number}.pdf`, data: pdf });
    }
    file = { name: exportFileName("originals", input.period), mime: "application/zip", content: createZip(entries) };
  }

  const reconciliation = reconcile({ period: input.period, ...data, missingOriginals });
  // Un FEC mal formé (ne devrait jamais arriver) bloque comme un écart de totaux.
  if (fecIssues.length > 0) {
    reconciliation.ok = false;
    reconciliation.issues.push(...fecIssues.map((issue) => ({ kind: "unbalanced" as const, number: issue })));
  }
  const status = reconciliation.ok ? ("done" as const) : ("blocked" as const);
  await inOrganization(input.organizationId, async (tx) => {
    await tx.insert(accountingExports).values({
      organizationId: input.organizationId,
      format: input.format,
      periodKind: input.period.kind,
      periodStart: input.period.start,
      periodEnd: input.period.end,
      status,
      invoicedCents: reconciliation.invoicedCents,
      creditedCents: reconciliation.creditedCents,
      receivedCents: reconciliation.receivedCents,
      documentCount: reconciliation.documentCount,
      issues: reconciliation.issues,
    });
    await appendAudit(tx, {
      organizationId: input.organizationId,
      action: reconciliation.ok ? "quotes.accounting.exported" : "quotes.accounting.blocked",
      details: { format: input.format, period: `${input.period.start}/${input.period.end}`, documents: reconciliation.documentCount, issues: reconciliation.issues.length },
    });
  });
  return { reconciliation, file: reconciliation.ok ? file : null };
}

export type AccountingExportTrace = { id: string; format: AccountingFormat; periodStart: string; periodEnd: string; status: "done" | "blocked"; invoicedCents: number; creditedCents: number; receivedCents: number; documentCount: number; createdAt: string };

export async function listAccountingExports(organizationId: string, limit = 20): Promise<AccountingExportTrace[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(accountingExports).orderBy(sql`${accountingExports.createdAt} desc`).limit(limit));
  return rows.map((row) => ({
    id: row.id,
    format: row.format,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status,
    invoicedCents: row.invoicedCents,
    creditedCents: row.creditedCents,
    receivedCents: row.receivedCents,
    documentCount: row.documentCount,
    createdAt: row.createdAt.toISOString(),
  }));
}
