// Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097) — exports comptables contre un vrai PostgreSQL (RLS) : journal
// des recettes, journaux des ventes et des encaissements, FEC, PDF d'origine ; rapprochement au
// centime, numérotation continue avoirs compris, écart bloquant et expliqué, pièces d'essai exclues,
// traces en ajout seul et isolation entre organisations.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { confirmed } from "@/lib/test-fixtures/recipients";
import { minimalPdf } from "@/lib/test-fixtures/pdf";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { checkFecStructure } from "./accounting-export-rules";
import {
  AccountingExportFormatError,
  AccountingSettingsError,
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  checkAccountingPeriod,
  createQuote,
  getAccountingSettings,
  getCreditNotePdf,
  getInvoicePdf,
  issueBalanceInvoice,
  issueCreditNote,
  issueDepositInvoice,
  listAccountingExports,
  markScheduleItemPaid,
  periodBounds,
  produceAccountingExport,
  saveAccountingSettings,
  sendQuote,
  sendQuoteForSignature,
  type ExportWords,
  type SaleDocument,
} from "./service";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const NOW = new Date("2027-04-10T10:00:00Z");
const renderInvoice = async () => minimalPdf("facture de test");
const renderCreditNote = async () => minimalPdf("avoir de test");

const admin = postgres({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "symbola",
  username: process.env.POSTGRES_ADMIN_USER ?? "postgres",
  password: process.env.POSTGRES_ADMIN_PASSWORD ?? "",
  max: 1,
  onnotice: () => {},
});

afterEach(() => setSignatureProviderForTests(undefined));
afterAll(async () => {
  await admin.end();
});

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization() {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, siren: "123456789", address: "1 rue des Lilas, 69001 Lyon" }));
  await fillRequiredMentions(organizationId);
  const planner = await withDb((db) => createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }));
  return { organizationId, plannerId: planner.id };
}

// Devis de 1 500 € HT à 20 % + 800 € HT à 10 % (TTC 2 680 €), acompte de 30 %, signé.
async function signedQuote(organizationId: string, plannerId: string, eventId?: string) {
  let event = eventId;
  if (!event) {
    const source = await createProspectSource(organizationId, "Salon");
    event = (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, eventDate: "2027-09-18", clients: [{ firstName: "Inès", lastName: "Martin" }] })).id;
  }
  const quote = await createQuote({ organizationId, eventId: event, createdByUserId: plannerId, now: NOW });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 2000 });
  await addQuoteLine(organizationId, quote.id, { label: "Décoration", unit: "forfait", quantityMilli: 1000, unitPriceCents: 80000, vatRateBasisPoints: 1000 });
  await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: "2027-04-15", percentageBasisPoints: 3000 });
  await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
  setSignatureProviderForTests(fakeSignatureProvider());
  const sent = await sendQuoteForSignature(confirmed({ organizationId, quoteId: quote.id, signers: [{ name: "Inès Martin", email: `ines-${randomUUID()}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" }], documentPdf: PDF, locale: "fr" }));
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
  return { quoteId: quote.id, items: sent.current.schedule.items };
}

// Avril 2027 : acompte payé et facturé (804 €), avoir de 4 €, solde (1 880 €) ; un essai guidé dans la
// même organisation, jamais exporté.
async function april() {
  const { organizationId, plannerId } = await organization();
  const { quoteId, items } = await signedQuote(organizationId, plannerId);
  const [method] = await addPaymentMethods(organizationId, ["Virement bancaire"]);
  await markScheduleItemPaid({ organizationId, scheduleItemId: items[0]!.id, paidOn: "2027-04-10", paymentMethodId: method!.id, now: NOW });
  const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
  const credit = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: deposit.id, amountCents: 400, reason: "Arrondi", now: NOW });
  const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: new Date("2027-04-20T10:00:00Z") });
  const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
  const demo = await signedQuote(organizationId, plannerId, trial.eventId);
  const demoInvoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: demo.items[0]!.id, now: NOW });
  return { organizationId, plannerId, deposit, credit, balance, demoInvoice };
}

const words: ExportWords = {
  header: { period: "Période", organization: "Organisation", exportedOn: "Exporté le" },
  periodLabel: "Avril 2027",
  organization: "Atelier",
  exportedOn: "2027-05-02",
  receipts: { columns: ["Date d'encaissement", "Mode", "Facture", "Client", "Montant"], total: "Total" },
  journal: { columns: ["Journal", "Date", "Écriture", "Pièce", "Compte", "Libellé", "Débit", "Crédit"], total: "Total" },
  lines: { invoice: "Facture", creditNote: "Avoir", payment: "Encaissement", reversal: "Annulation" },
};

function text(content: Uint8Array): string {
  return Buffer.from(content).toString("utf8");
}

describe("FAC-11 — Exports comptables (lot 58)", () => {
  it("l'export d'un mois se rapproche au centime du total facturé, des avoirs et des encaissements ; les pièces d'essai n'y sont jamais", async () => {
    const { organizationId, deposit, credit, balance, demoInvoice } = await april();
    expect(balance.amountCents).toBe(188000);
    const period = periodBounds("month", 2027, 4);
    const { reconciliation } = await checkAccountingPeriod(organizationId, period);
    expect(reconciliation).toMatchObject({ ok: true, invoicedCents: 268400, creditedCents: 400, receivedCents: 80400, documentCount: 3, issues: [] });

    const sales = await produceAccountingExport({ organizationId, format: "sales_journal", period, siren: "123456789", locale: "fr", words });
    const csv = text(sales.file!.content);
    expect(sales.file!.name).toBe("journal-ventes-2027-04-01-2027-04-30.csv");
    for (const number of [deposit.number, credit.number, balance.number]) expect(csv).toContain(number);
    expect(csv).not.toContain(demoInvoice.number);
    expect(csv).toContain("Période;Avril 2027");
    // Le client au débit, net des avoirs : 804 + 1 880 − 4 = 2 680,00 €.
    const clientNet = csv
      .split("\r\n")
      .map((line) => line.split(";"))
      .filter((cells) => cells[4] === "411")
      .reduce((sum, cells) => sum + Number(cells[6]!.replace(",", "")) - Number(cells[7]!.replace(",", "")), 0);
    expect(clientNet).toBe(268000);

    const payments = await produceAccountingExport({ organizationId, format: "payments_journal", period, siren: "123456789", locale: "fr", words });
    expect(text(payments.file!.content)).toContain("BQ;2027-04-10;BQ000001;" + deposit.number + ";512;");

    const receipts = await produceAccountingExport({ organizationId, format: "receipts_journal", period, siren: "123456789", locale: "fr", words });
    expect(text(receipts.file!.content)).toContain(`2027-04-10;Virement bancaire;${deposit.number};Inès Martin;804,00`);
  });

  it("D2 : le FEC de l'année a l'en-tête réglementaire, des écritures équilibrées et le nom SIREN + FEC + clôture ; refusé sur un trimestre", async () => {
    const { organizationId } = await april();
    const year = periodBounds("year", 2027, 0);
    const fec = await produceAccountingExport({ organizationId, format: "fec", period: year, siren: "123 456 789", locale: "fr", words });
    expect(fec.reconciliation.ok).toBe(true);
    expect(fec.file!.name).toBe("123456789FEC20271231.txt");
    expect(checkFecStructure(text(fec.file!.content))).toEqual([]);
    await expect(produceAccountingExport({ organizationId, format: "fec", period: periodBounds("quarter", 2027, 2), siren: null, locale: "fr", words })).rejects.toBeInstanceOf(AccountingExportFormatError);
  });

  it("D3 : un numéro manquant (avoirs compris) bloque l'export et se nomme ; la demande bloquée est tracée", async () => {
    const { organizationId } = await april();
    // Un rang de facture attribué sans pièce (anomalie simulée par l'administration de la base).
    await admin`update quotes.number_series set last_number = last_number + 1 where organization_id = ${organizationId} and kind = 'invoice' and is_demo = false and year = 2027`;
    await admin`update quotes.number_series set last_number = last_number + 1 where organization_id = ${organizationId} and kind = 'credit_note' and is_demo = false and year = 2027`;
    const period = periodBounds("month", 2027, 4);
    const blocked = await produceAccountingExport({ organizationId, format: "sales_journal", period, siren: null, locale: "fr", words });
    expect(blocked.file).toBeNull();
    expect(blocked.reconciliation.ok).toBe(false);
    expect(blocked.reconciliation.issues).toEqual([
      { kind: "missing_number", number: "A-2027-0002" },
      { kind: "missing_number", number: "F-2027-0003" },
    ]);
    const traces = await listAccountingExports(organizationId);
    expect(traces[0]).toMatchObject({ format: "sales_journal", status: "blocked", periodStart: "2027-04-01", periodEnd: "2027-04-30" });
    const [audit] = await admin<{ action: string }[]>`select action from core.audit_entries where organization_id = ${organizationId} and action like 'quotes.accounting.%' order by occurred_at desc limit 1`;
    expect(audit!.action).toBe("quotes.accounting.blocked");
  });

  it("les PDF d'origine de la période partent dans une archive ZIP ; un original absent bloque", async () => {
    const { organizationId } = await april();
    const period = periodBounds("month", 2027, 4);
    const readOriginal = async (document: SaleDocument) =>
      document.kind === "invoice" ? (await getInvoicePdf(organizationId, document.id, renderInvoice)).pdf : (await getCreditNotePdf(organizationId, document.id, renderCreditNote)).pdf;
    const zip = await produceAccountingExport({ organizationId, format: "originals", period, siren: null, locale: "fr", words, readOriginal });
    expect(zip.reconciliation.ok).toBe(true);
    expect(zip.file!.mime).toBe("application/zip");
    expect(Buffer.from(zip.file!.content).subarray(0, 2).toString("latin1")).toBe("PK");
    const missing = await produceAccountingExport({ organizationId, format: "originals", period, siren: null, locale: "fr", words, readOriginal: async (document) => (document.kind === "credit_note" ? null : readOriginal(document)) });
    expect(missing.file).toBeNull();
    expect(missing.reconciliation.issues).toEqual([{ kind: "missing_original", number: expect.stringMatching(/^A-2027-/) }]);
  });

  it("le plan de comptes se règle (les valeurs de départ restent à relire, EC-9) ; une valeur invalide est refusée", async () => {
    const { organizationId } = await april();
    expect((await getAccountingSettings(organizationId, "fr")).plan.accounts.sales.number).toBe("706");
    await saveAccountingSettings(organizationId, { fiscalYearStartMonth: 7, accounts: { sales: { number: "7061", label: "Coordination" } }, journals: {} }, "fr");
    const settings = await getAccountingSettings(organizationId, "fr");
    expect(settings).toMatchObject({ fiscalYearStartMonth: 7, customized: true });
    const sales = await produceAccountingExport({ organizationId, format: "sales_journal", period: periodBounds("month", 2027, 4), siren: null, locale: "fr", words });
    expect(text(sales.file!.content)).toContain(";7061;");
    await expect(saveAccountingSettings(organizationId, { fiscalYearStartMonth: 13, accounts: {}, journals: {} }, "fr")).rejects.toBeInstanceOf(AccountingSettingsError);
    await expect(saveAccountingSettings(organizationId, { fiscalYearStartMonth: 1, accounts: { bank: { number: "=512", label: "Banque" } }, journals: {} }, "fr")).rejects.toBeInstanceOf(AccountingSettingsError);
  });

  it("isolation : une autre organisation ne lit ni les pièces, ni les traces, ni les réglages d'une organisation", async () => {
    const { organizationId } = await april();
    await produceAccountingExport({ organizationId, format: "receipts_journal", period: periodBounds("month", 2027, 4), siren: null, locale: "fr", words });
    const other = await organization();
    const { reconciliation } = await checkAccountingPeriod(other.organizationId, periodBounds("month", 2027, 4));
    expect(reconciliation).toMatchObject({ invoicedCents: 0, documentCount: 0, cashCount: 0 });
    expect(await listAccountingExports(other.organizationId)).toEqual([]);
    expect((await listAccountingExports(organizationId)).length).toBe(1);
    // En ajout seul : le rôle applicatif ne modifie ni ne supprime une trace.
    await expect(withDb((db) => db.execute(`update quotes.accounting_exports set status = 'done'`))).rejects.toMatchObject({ cause: expect.objectContaining({ message: expect.stringMatching(/permission denied/) }) });
  });
});
