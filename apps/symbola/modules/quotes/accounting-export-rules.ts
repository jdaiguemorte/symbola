// Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097) — règles pures des exports comptables, sans base :
// - périodes (mois, trimestre, année civile, exercice) ;
// - journal des recettes d'une micro-entreprise (encaissements) ;
// - journaux des ventes et des encaissements d'une société ou d'une EI au réel, en partie double ;
// - FEC (fichier des écritures comptables), au format de l'administration (18 colonnes) ;
// - contrôle de rapprochement bloquant (D3) : totaux au centime contre ceux de la base, écritures
//   équilibrées, numérotation continue des factures et des avoirs.
// Montants en centimes entiers (CLAUDE.md § 5). Le plan de comptes et les journaux viennent des
// données de départ ou des réglages de l'organisation (à relire par l'expert-comptable, EC-9).
import type { AccountingFamily, AccountKey, JournalKey } from "@symbola/starter-templates";

export const ACCOUNTING_FORMATS = ["receipts_journal", "sales_journal", "payments_journal", "fec", "originals"] as const;
export type AccountingFormat = (typeof ACCOUNTING_FORMATS)[number];

export const FORMATS_BY_FAMILY: Record<AccountingFamily, readonly AccountingFormat[]> = {
  micro: ["receipts_journal", "originals"],
  real: ["sales_journal", "payments_journal", "fec", "originals"],
};

export const PERIOD_KINDS = ["month", "quarter", "year", "fiscal_year"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];
export type Period = { kind: PeriodKind; start: string; end: string };

export type AccountingPlan = {
  accounts: Record<AccountKey, { number: string; label: string }>;
  journals: Record<JournalKey, { code: string; label: string }>;
};

export type DocumentTotals = { totalHtCents: number; vatByRate: { rateBasisPoints: number; baseCents: number; vatCents: number }[]; totalVatCents: number; totalTtcCents: number };

// Une facture ou un avoir émis (non fictif), figé : montant TTC positif ; un avoir se lit en sens inverse.
export type SaleDocument = {
  kind: "invoice" | "credit_note";
  id: string;
  number: string;
  issuedOn: string;
  buyerName: string;
  amountCents: number;
  totals: DocumentTotals;
};

// Un encaissement (reçu ou annulé), daté du jour où l'argent est arrivé ou de l'annulation.
export type CashEntry = {
  id: string;
  kind: "received" | "reversal";
  on: string;
  method: string | null;
  invoiceNumber: string | null;
  clientName: string;
  amountCents: number;
};

// —— Périodes ——————————————————————————————————————————————————————————————————————————————

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthBounds(year: number, firstMonth: number, months: number): { start: string; end: string } {
  const startMonthIndex = firstMonth - 1;
  const endIndex = startMonthIndex + months - 1;
  const endYear = year + Math.floor(endIndex / 12);
  const endMonth = (endIndex % 12) + 1;
  return { start: `${year}-${pad(firstMonth)}-01`, end: `${endYear}-${pad(endMonth)}-${pad(lastDayOfMonth(endYear, endMonth))}` };
}

export class InvalidPeriodError extends Error {
  constructor() {
    super("période invalide");
    this.name = "InvalidPeriodError";
  }
}

// index : le mois (1 à 12) ou le trimestre (1 à 4) ; ignoré pour l'année. L'exercice commence au mois
// réglé par l'organisation (1 : année civile) de l'année donnée.
export function periodBounds(kind: PeriodKind, year: number, index: number, fiscalYearStartMonth = 1): Period {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new InvalidPeriodError();
  if (kind === "month") {
    if (!Number.isInteger(index) || index < 1 || index > 12) throw new InvalidPeriodError();
    return { kind, ...monthBounds(year, index, 1) };
  }
  if (kind === "quarter") {
    if (!Number.isInteger(index) || index < 1 || index > 4) throw new InvalidPeriodError();
    return { kind, ...monthBounds(year, (index - 1) * 3 + 1, 3) };
  }
  if (kind === "year") return { kind, ...monthBounds(year, 1, 12) };
  if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) throw new InvalidPeriodError();
  return { kind, ...monthBounds(year, fiscalYearStartMonth, 12) };
}

export function isWithin(period: { start: string; end: string }, day: string): boolean {
  return day >= period.start && day <= period.end;
}

// D1 : le FEC est un fichier de fin d'exercice ; il ne se produit que sur une année ou un exercice.
export function formatAllowedForPeriod(format: AccountingFormat, kind: PeriodKind): boolean {
  return format !== "fec" || kind === "year" || kind === "fiscal_year";
}

// —— Montants ——————————————————————————————————————————————————————————————————————————————

// « 1234,56 » : virgule décimale, sans séparateur de milliers ni symbole (CSV et FEC).
export function decimalAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${pad(absolute % 100)}`;
}

function compact(day: string): string {
  return day.replaceAll("-", "");
}

// —— Écritures en partie double ————————————————————————————————————————————————————————————

export type JournalLine = {
  journal: JournalKey;
  entryNumber: string;
  date: string;
  account: AccountKey;
  pieceRef: string;
  pieceDate: string;
  label: string;
  debitCents: number;
  creditCents: number;
};

function vatLines(totals: DocumentTotals): { rateBasisPoints: number; vatCents: number; baseCents: number }[] {
  return totals.vatByRate.filter((rate) => rate.vatCents !== 0 || rate.baseCents !== 0);
}

// Une facture : le client au débit (TTC), les ventes (HT) et la TVA collectée par taux au crédit. Un
// avoir : l'inverse. Les ventes prennent le reste pour que l'écriture tienne au centime ; un écart entre
// le TTC figé et ses totaux est relevé par le contrôle (« unbalanced »), jamais corrigé en silence.
export function salesLines(documents: SaleDocument[], words: { invoice: string; creditNote: string }): JournalLine[] {
  const lines: JournalLine[] = [];
  const sorted = [...documents].sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.number.localeCompare(b.number));
  sorted.forEach((document, index) => {
    const entryNumber = `VE${pad(index + 1, 6)}`;
    const sign = document.kind === "invoice" ? 1 : -1;
    const label = `${document.kind === "invoice" ? words.invoice : words.creditNote} ${document.number} ${document.buyerName}`.trim();
    const common = { journal: "sales" as const, entryNumber, date: document.issuedOn, pieceRef: document.number, pieceDate: document.issuedOn, label };
    const side = (cents: number, debit: boolean) => {
      const signed = cents * sign;
      const onDebit = debit ? signed >= 0 : signed < 0;
      return { debitCents: onDebit ? Math.abs(signed) : 0, creditCents: onDebit ? 0 : Math.abs(signed) };
    };
    lines.push({ ...common, account: "clients", ...side(document.amountCents, true) });
    let vatTotal = 0;
    const vat = vatLines(document.totals).filter((rate) => rate.vatCents !== 0);
    for (const rate of vat) vatTotal += rate.vatCents;
    lines.push({ ...common, account: "sales", ...side(document.amountCents - vatTotal, false) });
    for (const rate of vat) lines.push({ ...common, account: "vatCollected", ...side(rate.vatCents, false) });
  });
  return lines;
}

// Un encaissement : la banque au débit, le client au crédit ; une annulation, l'inverse.
export function paymentLines(entries: CashEntry[], words: { payment: string; reversal: string }): JournalLine[] {
  const lines: JournalLine[] = [];
  const sorted = [...entries].sort((a, b) => a.on.localeCompare(b.on) || a.id.localeCompare(b.id));
  sorted.forEach((entry, index) => {
    const entryNumber = `BQ${pad(index + 1, 6)}`;
    const received = entry.kind === "received";
    const label = [received ? words.payment : words.reversal, entry.invoiceNumber, entry.clientName].filter(Boolean).join(" ");
    const common = { journal: "bank" as const, entryNumber, date: entry.on, pieceRef: entry.invoiceNumber ?? entryNumber, pieceDate: entry.on, label };
    lines.push({ ...common, account: "bank", debitCents: received ? entry.amountCents : 0, creditCents: received ? 0 : entry.amountCents });
    lines.push({ ...common, account: "clients", debitCents: received ? 0 : entry.amountCents, creditCents: received ? entry.amountCents : 0 });
  });
  return lines;
}

export function signedCash(entries: CashEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.kind === "received" ? entry.amountCents : -entry.amountCents), 0);
}

// —— Fichiers ——————————————————————————————————————————————————————————————————————————————

export type ExportHeader = { periodLabel: string; organization: string; exportedOn: string };
export type HeaderWords = { period: string; organization: string; exportedOn: string };

function headerRows(header: ExportHeader, words: HeaderWords): string[][] {
  return [[words.period, header.periodLabel], [words.organization, header.organization], [words.exportedOn, header.exportedOn], []];
}

// Journal des recettes (micro-entreprise, réponse 8) : date d'encaissement, mode, numéro de facture,
// client, montant ; une annulation en négatif.
export function receiptsJournalRows(entries: CashEntry[], header: ExportHeader, words: HeaderWords & { columns: [string, string, string, string, string]; total: string }): { rows: string[][]; totalCents: number } {
  const sorted = [...entries].sort((a, b) => a.on.localeCompare(b.on) || a.id.localeCompare(b.id));
  const totalCents = signedCash(sorted);
  const rows = [
    ...headerRows(header, words),
    [...words.columns],
    ...sorted.map((entry) => [entry.on, entry.method ?? "", entry.invoiceNumber ?? "", entry.clientName, decimalAmount(entry.kind === "received" ? entry.amountCents : -entry.amountCents)]),
    [words.total, "", "", "", decimalAmount(totalCents)],
  ];
  return { rows, totalCents };
}

export type JournalWords = HeaderWords & { columns: [string, string, string, string, string, string, string, string]; total: string };

export function journalRows(lines: JournalLine[], plan: AccountingPlan, header: ExportHeader, words: JournalWords): { rows: string[][]; debitCents: number; creditCents: number } {
  const debitCents = lines.reduce((sum, line) => sum + line.debitCents, 0);
  const creditCents = lines.reduce((sum, line) => sum + line.creditCents, 0);
  const rows = [
    ...headerRows(header, words),
    [...words.columns],
    ...lines.map((line) => [plan.journals[line.journal].code, line.date, line.entryNumber, line.pieceRef, plan.accounts[line.account].number, line.label, decimalAmount(line.debitCents), decimalAmount(line.creditCents)]),
    [words.total, "", "", "", "", "", decimalAmount(debitCents), decimalAmount(creditCents)],
  ];
  return { rows, debitCents, creditCents };
}

// FEC (article A47 A-1 du livre des procédures fiscales) : 18 colonnes dans l'ordre réglementaire,
// séparateur « | », dates AAAAMMJJ, montants à virgule. Les comptes auxiliaires restent vides (EC-9).
export const FEC_COLUMNS = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

function fecCell(value: string): string {
  return value.replace(/[|\r\n\t]/g, " ");
}

export function fecText(lines: JournalLine[], plan: AccountingPlan): string {
  const sorted = [...lines].sort((a, b) => a.date.localeCompare(b.date) || a.journal.localeCompare(b.journal) || a.entryNumber.localeCompare(b.entryNumber));
  const rows = sorted.map((line) =>
    [
      plan.journals[line.journal].code,
      plan.journals[line.journal].label,
      line.entryNumber,
      compact(line.date),
      plan.accounts[line.account].number,
      plan.accounts[line.account].label,
      "",
      "",
      line.pieceRef,
      compact(line.pieceDate),
      line.label,
      decimalAmount(line.debitCents),
      decimalAmount(line.creditCents),
      "",
      "",
      compact(line.date),
      "",
      "",
    ].map(fecCell).join("|"),
  );
  return `${[FEC_COLUMNS.join("|"), ...rows].join("\r\n")}\r\n`;
}

// Nom réglementaire : SIREN, « FEC », date de clôture de l'exercice (AAAAMMJJ).
export function fecFileName(siren: string | null, periodEnd: string): string {
  return `${(siren ?? "").replace(/\D/g, "") || "000000000"}FEC${compact(periodEnd)}.txt`;
}

// Structure d'un FEC produit : en-tête exact, 18 colonnes par ligne, dates et montants bien formés,
// chaque écriture équilibrée. Renvoie la liste des anomalies (vide : conforme).
export function checkFecStructure(text: string): string[] {
  const issues: string[] = [];
  const lines = text.replace(/\r\n$/, "").split("\r\n");
  if (lines[0] !== FEC_COLUMNS.join("|")) issues.push("header");
  const balance = new Map<string, number>();
  lines.slice(1).forEach((line, index) => {
    const cells = line.split("|");
    if (cells.length !== FEC_COLUMNS.length) return issues.push(`columns:${index + 2}`);
    if (!/^\d{8}$/.test(cells[3]!) || !/^\d{8}$/.test(cells[9]!) || !/^\d{8}$/.test(cells[15]!)) issues.push(`date:${index + 2}`);
    if (!/^-?\d+,\d{2}$/.test(cells[11]!) || !/^-?\d+,\d{2}$/.test(cells[12]!)) issues.push(`amount:${index + 2}`);
    const cents = (value: string) => Number(value.replace(",", "").replace(/^(-?)0+(?=\d)/, "$1"));
    const key = `${cells[0]}:${cells[2]}`;
    balance.set(key, (balance.get(key) ?? 0) + cents(cells[11]!) - cents(cells[12]!));
  });
  for (const [key, cents] of balance) if (cents !== 0) issues.push(`unbalanced:${key}`);
  return issues;
}

// —— Contrôle de rapprochement (D3) ——————————————————————————————————————————————————————————

export type NumberedDocument = { kind: "invoice" | "credit_note"; number: string; issuedOn: string };

export type ReconciliationIssue =
  | { kind: "missing_number"; number: string }
  | { kind: "total_mismatch"; total: "invoiced" | "credited" | "received"; exportCents: number; expectedCents: number }
  | { kind: "unbalanced"; number: string }
  | { kind: "missing_original"; number: string };

export type ReconciliationInput = {
  period: { start: string; end: string };
  // Factures et avoirs émis du périmètre, toutes années touchées par la période (avant, pendant et
  // après), pour situer les trous ; lastAssigned : le dernier rang attribué par série et par année.
  numbered: NumberedDocument[];
  lastAssigned: { kind: "invoice" | "credit_note"; year: number; lastNumber: number }[];
  documents: SaleDocument[];
  cash: CashEntry[];
  // Totaux de la base, calculés à part (sommes SQL), pour la période.
  expected: { invoicedCents: number; creditedCents: number; receivedCents: number };
  // Pièces dont l'original manque (archive des PDF).
  missingOriginals?: string[];
};

export type Reconciliation = {
  ok: boolean;
  invoicedCents: number;
  creditedCents: number;
  receivedCents: number;
  documentCount: number;
  cashCount: number;
  issues: ReconciliationIssue[];
};

const NUMBER_PATTERN = /^(.*)-(\d{4})-(\d+)$/;

function parseNumber(number: string): { prefix: string; year: number; rank: number; width: number } | null {
  const match = NUMBER_PATTERN.exec(number);
  if (!match) return null;
  return { prefix: match[1]!, year: Number(match[2]), rank: Number(match[3]), width: match[3]!.length };
}

// Numérotation continue (DAT-04) : par série (facture, avoir) et par année, aucun rang ne manque entre
// le dernier émis avant la période et le premier émis après (ou le dernier attribué).
export function missingNumbers(input: Pick<ReconciliationInput, "period" | "numbered" | "lastAssigned">): string[] {
  const missing: string[] = [];
  const series = new Map<string, { kind: "invoice" | "credit_note"; year: number; ranks: Map<number, { issuedOn: string; prefix: string; width: number }> }>();
  for (const document of input.numbered) {
    const parsed = parseNumber(document.number);
    if (!parsed) continue;
    const key = `${document.kind}:${parsed.year}`;
    const entry = series.get(key) ?? { kind: document.kind, year: parsed.year, ranks: new Map() };
    entry.ranks.set(parsed.rank, { issuedOn: document.issuedOn, prefix: parsed.prefix, width: parsed.width });
    series.set(key, entry);
  }
  for (const assigned of input.lastAssigned) {
    const key = `${assigned.kind}:${assigned.year}`;
    if (!series.has(key) && assigned.lastNumber > 0) series.set(key, { kind: assigned.kind, year: assigned.year, ranks: new Map() });
  }
  const startYear = Number(input.period.start.slice(0, 4));
  const endYear = Number(input.period.end.slice(0, 4));
  for (const entry of [...series.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.year - b.year)) {
    if (entry.year < startYear || entry.year > endYear) continue;
    const ranks = [...entry.ranks.entries()];
    const lastAssigned = input.lastAssigned.find((row) => row.kind === entry.kind && row.year === entry.year)?.lastNumber ?? Math.max(0, ...ranks.map(([rank]) => rank));
    const before = Math.max(0, ...ranks.filter(([, row]) => row.issuedOn < input.period.start).map(([rank]) => rank));
    const afterRanks = ranks.filter(([, row]) => row.issuedOn > input.period.end).map(([rank]) => rank);
    const after = afterRanks.length > 0 ? Math.min(...afterRanks) : lastAssigned + 1;
    const sample = ranks[0]?.[1];
    for (let rank = before + 1; rank < after; rank += 1) {
      if (entry.ranks.has(rank)) continue;
      const neighbour = entry.ranks.get(rank - 1) ?? entry.ranks.get(rank + 1) ?? sample;
      const prefix = neighbour?.prefix ?? (entry.kind === "invoice" ? "F" : "A");
      missing.push(`${prefix}-${entry.year}-${pad(rank, neighbour?.width ?? 4)}`);
    }
  }
  return missing;
}

function documentBalanced(document: SaleDocument): boolean {
  const totals = document.totals;
  const vat = totals.vatByRate.reduce((sum, rate) => sum + rate.vatCents, 0);
  return totals.totalTtcCents === document.amountCents && totals.totalHtCents + vat === totals.totalTtcCents;
}

export function reconcile(input: ReconciliationInput): Reconciliation {
  const issues: ReconciliationIssue[] = [];
  for (const number of missingNumbers(input)) issues.push({ kind: "missing_number", number });
  const inPeriod = input.documents.filter((document) => isWithin(input.period, document.issuedOn));
  for (const document of inPeriod) if (!documentBalanced(document)) issues.push({ kind: "unbalanced", number: document.number });
  const invoicedCents = inPeriod.filter((document) => document.kind === "invoice").reduce((sum, document) => sum + document.amountCents, 0);
  const creditedCents = inPeriod.filter((document) => document.kind === "credit_note").reduce((sum, document) => sum + document.amountCents, 0);
  const cash = input.cash.filter((entry) => isWithin(input.period, entry.on));
  const receivedCents = signedCash(cash);
  const totals: [ReconciliationIssue & { kind: "total_mismatch" }][] = [];
  const compare = (total: "invoiced" | "credited" | "received", exportCents: number, expectedCents: number) => {
    if (exportCents !== expectedCents) totals.push([{ kind: "total_mismatch", total, exportCents, expectedCents }]);
  };
  compare("invoiced", invoicedCents, input.expected.invoicedCents);
  compare("credited", creditedCents, input.expected.creditedCents);
  compare("received", receivedCents, input.expected.receivedCents);
  issues.push(...totals.flat());
  for (const number of input.missingOriginals ?? []) issues.push({ kind: "missing_original", number });
  return { ok: issues.length === 0, invoicedCents, creditedCents, receivedCents, documentCount: inPeriod.length, cashCount: cash.length, issues };
}

// Nom de fichier : format, période ; jamais de donnée personnelle (CLAUDE.md § 2.8).
export function exportFileName(format: Exclude<AccountingFormat, "fec">, period: { start: string; end: string }): string {
  const stem = { receipts_journal: "journal-recettes", sales_journal: "journal-ventes", payments_journal: "journal-encaissements", originals: "pieces-originales" }[format];
  return `${stem}-${period.start}-${period.end}.${format === "originals" ? "zip" : "csv"}`;
}
