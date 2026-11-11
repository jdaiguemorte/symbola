// DEV-04 — factures conformes, contre un vrai PostgreSQL (RLS, trigger),
// par la porte d'entrée du module. Les devis sont signés par le faux
// fournisseur (DEV-02), comme dans l'essai guidé.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { eq } from "drizzle-orm";
import { invoices, ledgerEntries } from "@symbola/db/schema/quotes";
import { createStorageClient, uploadPrivateObject } from "@symbola/files";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import {
  CreditNoteExceedsInvoiceError,
  InvoiceAlreadyIssuedError,
  InvoiceNotFoundError,
  ProfessionalInvoiceNotSupportedError,
  QuoteNotFoundError,
  QuoteNotSignedError,
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  getEReporting,
  getInvoice,
  issueBalanceInvoice,
  issueCreditNote,
  issueDepositInvoice,
  listQuoteInvoices,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  removeEventQuotesData,
  sendQuote,
  sendQuoteForSignature,
  setQuoteClientKind,
  updateQuoteSettings,
  OriginalAlteredError,
  getCreditNotePdf,
  getInvoicePdf,
  getQuote,
  listLedgerEntries,
  listLedgerYears,
  verifyLedger,
} from "./service";

// Lot 23b (DOC-08) : rendu factice de l'original déposé à l'émission.
const renderInvoice = async () => Buffer.from("%PDF-1.4\n% facture de test\n%%EOF\n", "latin1");
const renderCreditNote = async () => Buffer.from("%PDF-1.4\n% avoir de test\n%%EOF\n", "latin1");


const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const NOW = new Date("2027-04-10T10:00:00Z");

afterEach(() => setSignatureProviderForTests(undefined));

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization(vatRegime: "franchise" | "assujetti" = "assujetti") {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) =>
    saveOnboardingStep(db, organizationId, {
      vatRegime,
      vatRateDefaultBasisPoints: vatRegime === "assujetti" ? 2000 : null,
      siren: "123456789",
      address: "1 rue des Lilas, 69001 Lyon",
    }),
  );
  const planner = await withDb((db) =>
    createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }),
  );
  return { organizationId, plannerId: planner.id };
}

// Devis de 1 500 € HT à 20 % + 800 € HT à 10 % (TTC 2 680 €), échéancier
// 30 % + 500 €, signé par deux signataires.
async function signedQuote(options: { demoEventId?: string; organizationId?: string; plannerId?: string } = {}) {
  const org = options.organizationId ? { organizationId: options.organizationId, plannerId: options.plannerId! } : await organization();
  const { organizationId, plannerId } = org;
  let eventId = options.demoEventId;
  if (!eventId) {
    const source = await createProspectSource(organizationId, "Salon");
    eventId = (
      await createProspect({
        organizationId,
        createdByUserId: plannerId,
        prospectSourceId: source.id,
        eventDate: "2027-09-18",
        clients: [{ firstName: "Inès", lastName: "Martin" }],
      })
    ).id;
  }
  const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 2000 });
  await addQuoteLine(organizationId, quote.id, { label: "Décoration", unit: "forfait", quantityMilli: 1000, unitPriceCents: 80000, vatRateBasisPoints: 1000 });
  await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: "2027-04-15", percentageBasisPoints: 3000 });
  await addScheduleItem(organizationId, quote.id, { label: "Deuxième acompte", dueDate: "2027-06-01", amountCents: 50000 });
  await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
  setSignatureProviderForTests(fakeSignatureProvider());
  const sent = await sendQuoteForSignature({
    organizationId,
    quoteId: quote.id,
    signers: [
      { name: "Inès Martin", email: `ines-${randomUUID()}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" },
      { name: "Sacha Durand", email: `sacha-${randomUUID()}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" },
    ],
    documentPdf: PDF,
    locale: "fr",
  });
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
  const items = sent.current.schedule.items;
  return { organizationId, plannerId, eventId, quoteId: quote.id, number: sent.number, items };
}

const year = (prefix: string, rank: number) => `${prefix}-2027-${String(rank).padStart(4, "0")}`;

describe("DEV-04 — Facture d'acompte et de solde depuis un devis signé", () => {
  it("quand elle génère une facture d'acompte, alors elle reçoit un numéro de la série de facturation ; tout ce qui y figure est figé", async () => {
    const { organizationId, items, number } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });

    expect(invoice).toMatchObject({
      kind: "deposit",
      number: year("F", 1),
      quoteNumber: number,
      issuedOn: "2027-04-10",
      paymentDueOn: "2027-04-15",
      serviceDate: "2027-04-15",
      amountCents: 80400,
      vatRegime: "assujetti",
      vatApplicable: true,
      depositLabel: "Acompte à la signature",
      isDemo: false,
    });
    expect(invoice.totals).toEqual({
      totalHtCents: 69000,
      vatByRate: [
        { rateBasisPoints: 1000, baseCents: 24000, vatCents: 2400 },
        { rateBasisPoints: 2000, baseCents: 45000, vatCents: 9000 },
      ],
      totalVatCents: 11400,
      totalTtcCents: 80400,
    });
    expect(invoice.seller).toMatchObject({ siren: "123456789", address: "1 rue des Lilas, 69001 Lyon" });
    expect(invoice.buyers).toEqual([
      { name: "Inès Martin", billingAddress: "3 place Bellecour, 69002 Lyon" },
      { name: "Sacha Durand", billingAddress: "3 place Bellecour, 69002 Lyon" },
    ]);
  });

  it("la facture de solde reprend les lignes du devis, déduit les acomptes facturés, avec la date de la prestation", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    await updateQuoteSettings(organizationId, {
      validityDays: 30,
      quotePrefix: "D",
      invoicePrefix: "F",
      creditNotePrefix: "A",
      upcomingHorizonDays: 90,
      invoicePaymentTermDays: 15,
      invoiceMentions: "Paiement à réception, par virement.",
    });
    const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });

    expect(balance).toMatchObject({
      kind: "balance",
      number: year("F", 2),
      serviceDate: "2027-09-18",
      paymentDueOn: "2027-04-25",
      amountCents: 268000 - 80400,
      mentions: "Paiement à réception, par virement.",
      deductions: [{ number: deposit.number, amountCents: 80400 }],
    });
    expect(balance.lines.map((line) => [line.label, line.netCents])).toEqual([
      ["Coordination", 150000],
      ["Décoration", 80000],
    ]);
    expect(balance.quoteTotals.totalTtcCents).toBe(268000);
    expect(balance.totals.totalTtcCents).toBe(187600);
  });

  it("refuse une seconde facture pour la même échéance, un second solde, et un devis non signé", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW })).rejects.toBeInstanceOf(
      InvoiceAlreadyIssuedError,
    );
    await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    await expect(issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW })).rejects.toBeInstanceOf(InvoiceAlreadyIssuedError);
    // Après le solde, plus de facture d'acompte.
    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[1]!.id, now: NOW })).rejects.toBeInstanceOf(
      InvoiceAlreadyIssuedError,
    );

    const { organizationId: otherOrg, plannerId } = await organization();
    const source = await createProspectSource(otherOrg, "Salon");
    const event = await createProspect({ organizationId: otherOrg, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Lou" }] });
    const draft = await createQuote({ organizationId: otherOrg, eventId: event.id, createdByUserId: plannerId, now: NOW });
    await expect(issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: otherOrg, quoteId: draft.id, now: NOW })).rejects.toBeInstanceOf(QuoteNotSignedError);
  });

  it("client professionnel : le choix est enregistré, l'émission refusée tant que Factur-X n'est pas livré, sans consommer de numéro", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    expect((await setQuoteClientKind(organizationId, quoteId, "professional")).clientKind).toBe("professional");
    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW })).rejects.toBeInstanceOf(
      ProfessionalInvoiceNotSupportedError,
    );
    await setQuoteClientKind(organizationId, quoteId, "individual");
    expect((await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW })).number).toBe(year("F", 1));
  });
});

describe("DEV-04 — Numérotation continue et sans trou", () => {
  it("des factures émises en parallèle reçoivent des numéros consécutifs, sans doublon ni trou ; l'année repart à 1", async () => {
    const org = await organization();
    const quotes = await Promise.all(Array.from({ length: 3 }, () => signedQuote(org)));
    const invoices = await Promise.all(
      quotes.flatMap((quote) => quote.items.map((item) => issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: org.organizationId, scheduleItemId: item.id, now: NOW }))),
    );
    expect(invoices.map((invoice) => invoice.number).sort()).toEqual(Array.from({ length: 6 }, (_, index) => year("F", index + 1)));

    const next = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: org.organizationId, quoteId: quotes[0]!.quoteId, now: new Date("2028-01-01T00:30:00+01:00") });
    expect(next.number).toBe("F-2028-0001");
  });

  it("un refus d'émission ne consomme aucun numéro", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    await expect(issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW })).rejects.toBeInstanceOf(InvoiceAlreadyIssuedError);
    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW })).rejects.toBeInstanceOf(InvoiceAlreadyIssuedError);
    const credit = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: (await listQuoteInvoices(organizationId, quoteId))[0]!.id, amountCents: 268000, reason: "Annulation", now: NOW });
    expect(credit.number).toBe(year("A", 1));
    // Le solde annulé par un avoir total peut être réémis : numéro suivant, sans trou.
    expect((await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW })).number).toBe(year("F", 2));
  });
});

describe("DEV-04 — Correction par avoir", () => {
  it("un avoir partiel ou total corrige une facture émise, qui elle ne change pas ; jamais plus que le montant restant", async () => {
    const { organizationId, items } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });

    const partial = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 10000, reason: "Geste commercial", now: NOW });
    expect(partial).toMatchObject({ number: year("A", 1), invoiceNumber: invoice.number, amountCents: 10000, reason: "Geste commercial" });
    expect(partial.totals.totalTtcCents).toBe(10000);
    await expect(
      issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 70401, reason: "Trop", now: NOW }),
    ).rejects.toBeInstanceOf(CreditNoteExceedsInvoiceError);
    await expect(issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 0, reason: "Rien", now: NOW })).rejects.toBeInstanceOf(
      RangeError,
    );

    const after = await getInvoice(organizationId, invoice.id);
    expect(after).toMatchObject({ amountCents: 80400, creditedCents: 10000 });
    expect(after.creditNotes.map((note) => note.number)).toEqual([year("A", 1)]);
  });

  it("le solde déduit les acomptes nets de leurs avoirs", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: deposit.id, amountCents: 400, reason: "Arrondi", now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    expect(balance.deductions).toEqual([{ number: deposit.number, amountCents: 80000 }]);
    expect(balance.amountCents).toBe(268000 - 80000);
  });
});

describe("DEV-04 — E-reporting (clients particuliers)", () => {
  it("exporte par période les factures, avoirs et encaissements, hors données d'essai", async () => {
    const { organizationId, plannerId, quoteId, items } = await signedQuote();
    const [method] = await addPaymentMethods(organizationId, ["Virement bancaire"]);
    await markScheduleItemPaid({ organizationId, scheduleItemId: items[0]!.id, paidOn: "2027-04-10", paymentMethodId: method!.id, now: NOW });
    const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: deposit.id, amountCents: 400, reason: "Arrondi", now: NOW });
    // Hors période : un solde émis en juin.
    await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: new Date("2027-06-02T10:00:00Z") });

    // Essai guidé dans la même organisation : jamais exporté.
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    const demo = await signedQuote({ organizationId, plannerId, demoEventId: trial.eventId });
    const demoInvoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: demo.items[0]!.id, now: NOW });
    expect(demoInvoice.number).toBe("DEMO-F-2027-0001");

    const report = await getEReporting(organizationId, { from: "2027-03-01", to: "2027-04-30" });
    expect(report.invoices.map((invoice) => [invoice.number, invoice.kind, invoice.totalTtcCents])).toEqual([[deposit.number, "deposit", 80400]]);
    expect(report.creditNotes.map((note) => [note.number, note.invoiceNumber, note.totalTtcCents])).toEqual([[year("A", 1), deposit.number, 400]]);
    expect(report.payments).toEqual([
      { paidOn: "2027-04-10", amountCents: 80400, paymentMethod: "Virement bancaire", quoteNumber: deposit.quoteNumber, label: "Acompte à la signature" },
    ]);
    expect(report.totals).toMatchObject({ invoicedTtcCents: 80400, creditedTtcCents: 400, netTtcCents: 80000, collectedCents: 80400 });
    expect(report.totals.netHtCents + report.totals.netVatCents).toBe(80000);
  });

  it("refuse une période invalide", async () => {
    const { organizationId } = await organization();
    await expect(getEReporting(organizationId, { from: "2027-05-01", to: "2027-04-30" })).rejects.toBeInstanceOf(RangeError);
    await expect(getEReporting(organizationId, { from: "2027-02-30", to: "2027-04-30" })).rejects.toBeInstanceOf(RangeError);
  });
});

describe("DEV-04 — Essai guidé et isolation", () => {
  it("les factures d'essai prennent la série DEMO et disparaissent avec l'essai", async () => {
    const { organizationId, plannerId } = await organization();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    const demo = await signedQuote({ organizationId, plannerId, demoEventId: trial.eventId });
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: demo.items[0]!.id, now: NOW });
    await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 100, reason: "Essai", now: NOW });
    expect(invoice.isDemo).toBe(true);

    await removeEventQuotesData(organizationId, [trial.eventId]);
    await expect(getInvoice(organizationId, invoice.id)).rejects.toBeInstanceOf(InvoiceNotFoundError);
    // La série légale n'a pas été consommée.
    const real = await signedQuote({ organizationId, plannerId });
    expect((await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: real.items[0]!.id, now: NOW })).number).toBe(year("F", 1));
  });

  it("une organisation n'émet rien sur le devis d'une autre et ne lit pas ses factures", async () => {
    const own = await organization();
    const other = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: other.organizationId, scheduleItemId: other.items[0]!.id, now: NOW });

    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: own.organizationId, scheduleItemId: other.items[1]!.id, now: NOW })).rejects.toBeInstanceOf(
      QuoteNotFoundError,
    );
    await expect(issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: own.organizationId, quoteId: other.quoteId, now: NOW })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(getInvoice(own.organizationId, invoice.id)).rejects.toBeInstanceOf(InvoiceNotFoundError);
    await expect(
      issueCreditNote({ renderOriginal: renderCreditNote, organizationId: own.organizationId, invoiceId: invoice.id, amountCents: 100, reason: "Intrus", now: NOW }),
    ).rejects.toBeInstanceOf(InvoiceNotFoundError);
    expect((await getEReporting(own.organizationId, { from: "2027-01-01", to: "2027-12-31" })).invoices).toEqual([]);
  });
});

// Lot 23 (SEC-19, ADR 0060) : partages, émissions et encaissements au journal
// d'audit, dans la transaction du geste.
async function journalOf(organizationId: string) {
  return withDb((db) =>
    withOrganization(db, organizationId, (tx) =>
      tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationId)).orderBy(auditEntries.occurredAt),
    ),
  );
}

describe("SEC-19 — Devis, factures et encaissements au journal d'audit", () => {
  it("l'envoi du devis et la demande de signature sont des partages ; la facture et l'avoir des émissions, avec leur numéro", async () => {
    const { organizationId, quoteId, number, items } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const creditNote = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 10000, reason: "Remise", now: NOW });
    const journal = await journalOf(organizationId);
    expect(journal.find((entry) => entry.action === "quotes.quote.sent")).toMatchObject({ category: "partage", objectId: quoteId, details: { number, version: 1 } });
    expect(journal.find((entry) => entry.action === "quotes.signature.requested")).toMatchObject({ category: "partage", details: { signers: 2 } });
    expect(journal.find((entry) => entry.action === "quotes.invoice.issued")).toMatchObject({
      category: "emission",
      objectId: invoice.id,
      details: { number: invoice.number, kind: "deposit", amountCents: 80400 },
      isDemo: false,
    });
    expect(journal.find((entry) => entry.action === "quotes.credit_note.issued")).toMatchObject({
      objectId: creditNote.id,
      details: { number: creditNote.number, invoiceNumber: invoice.number, amountCents: 10000 },
    });
  });

  it("un encaissement saisi puis annulé laisse deux lignes ; rien n'est effacé du journal", async () => {
    const { organizationId, items } = await signedQuote();
    const [method] = await addPaymentMethods(organizationId, ["Virement"]);
    await markScheduleItemPaid({ organizationId, scheduleItemId: items[0]!.id, paidOn: "2027-04-09", paymentMethodId: method!.id, now: NOW });
    await markScheduleItemUnpaid(organizationId, items[0]!.id, "Erreur de saisie");
    const payments = (await journalOf(organizationId)).filter((entry) => entry.category === "encaissement");
    expect(payments.map((entry) => entry.action)).toEqual(["quotes.payment.recorded", "quotes.payment.cancelled"]);
    expect(payments[0]).toMatchObject({ objectId: items[0]!.id, details: { paidOn: "2027-04-09" } });
  });
});

// Lot 23b (DOC-08, FAC-14, JUR-05, JUR-06, ADR 0061) — pièces inaltérables.
function ledgerOf(organizationId: string) {
  return withDb((db) =>
    withOrganization(db, organizationId, (tx) => tx.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, organizationId)).orderBy(ledgerEntries.sequence)),
  );
}

describe("DOC-08 — Originaux conservés tels qu'émis", () => {
  it("l'original est déposé à l'émission ; le PDF servi est cet original, sans nouveau rendu, et s'enchaîne", async () => {
    const { organizationId, items } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    let renders = 0;
    const served = await getInvoicePdf(organizationId, invoice.id, async () => {
      renders += 1;
      return Buffer.from("autre rendu");
    });
    expect(served.pdf.equals(await renderInvoice())).toBe(true);
    expect(served).toMatchObject({ number: invoice.number, reconstructed: false });
    expect(renders).toBe(0);
    const creditNote = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 100, reason: "Geste", now: NOW });
    expect((await getCreditNotePdf(organizationId, creditNote.id, async () => Buffer.from("x"))).pdf.equals(await renderCreditNote())).toBe(true);
    expect((await ledgerOf(organizationId)).map((entry) => entry.entryKind)).toEqual(["invoice", "original", "credit_note", "original"]);
    expect(await verifyLedger(organizationId)).toMatchObject({ ok: true, entries: 4 });
  });

  it("un original altéré dans le stockage n'est pas servi, rien n'est reconstruit, et l'anomalie va au journal", async () => {
    const { organizationId, items } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    await uploadPrivateObject(createStorageClient(), {
      key: `originals/${organizationId}/invoice/${invoice.id}.pdf`,
      body: Buffer.from("%PDF-1.4\n% falsifié\n%%EOF\n"),
      contentType: "application/pdf",
    });
    await expect(getInvoicePdf(organizationId, invoice.id, renderInvoice)).rejects.toBeInstanceOf(OriginalAlteredError);
    const journal = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "quotes.original.altered"))));
    expect(journal).toMatchObject([{ objectId: invoice.id, details: { number: invoice.number } }]);
  });

  it("si l'original ne peut être rendu ou déposé, la facture n'est pas émise et aucun numéro n'est perdu", async () => {
    const { organizationId, items, quoteId } = await signedQuote();
    const failing = async (): Promise<Buffer> => {
      throw new Error("stockage indisponible");
    };
    await expect(issueDepositInvoice({ renderOriginal: failing, organizationId, scheduleItemId: items[0]!.id, now: NOW })).rejects.toThrow("stockage indisponible");
    expect(await listQuoteInvoices(organizationId, quoteId)).toEqual([]);
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    expect(invoice.number).toBe(year("F", 1));
  });

  it("une facture émise avant le lot 23b reçoit son original à sa première ouverture, marqué « reconstitué », une seule fois", async () => {
    const { organizationId, items } = await signedQuote();
    const issued = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const legacyId = await withDb((db) =>
      withOrganization(db, organizationId, async (tx) => {
        const [row] = await tx.select().from(invoices).where(eq(invoices.id, issued.id));
        const legacyValues = { ...row!, id: randomUUID(), number: "F-ANCIENNE-0001", scheduleItemId: items[1]!.id, createdBy: null };
        const [legacy] = await tx.insert(invoices).values(legacyValues).returning();
        return legacy!.id;
      }),
    );
    let renders = 0;
    const render = async () => {
      renders += 1;
      return Buffer.from("%PDF-1.4\n% reconstitué\n%%EOF\n");
    };
    expect(await getInvoicePdf(organizationId, legacyId, render)).toMatchObject({ reconstructed: true });
    expect(await getInvoicePdf(organizationId, legacyId, render)).toMatchObject({ reconstructed: true });
    expect(renders).toBe(1);
    expect(await verifyLedger(organizationId)).toMatchObject({ ok: true });
  });
});

describe("JUR-05 — Encaissements corrigés par écriture inverse", () => {
  it("une annulation motivée s'ajoute à la saisie ; l'historique montre les deux ; un nouvel encaissement reste possible", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    const [method] = await addPaymentMethods(organizationId, ["Virement"]);
    const pay = () => markScheduleItemPaid({ organizationId, scheduleItemId: items[0]!.id, paidOn: "2027-04-09", paymentMethodId: method!.id, now: NOW });
    await pay();
    await expect(markScheduleItemUnpaid(organizationId, items[0]!.id, "   ")).rejects.toBeInstanceOf(RangeError);
    await markScheduleItemUnpaid(organizationId, items[0]!.id, "Virement rejeté");
    await pay();
    const quote = await getQuote(organizationId, quoteId);
    const item = quote.current.schedule.items.find((candidate) => candidate.id === items[0]!.id)!;
    expect(item.paidOn).toBe("2027-04-09");
    expect(item.payments.map((entry) => [entry.kind, entry.amountCents, entry.reason])).toEqual([
      ["received", 80400, null],
      ["reversal", 80400, "Virement rejeté"],
      ["received", 80400, null],
    ]);
    expect((await ledgerOf(organizationId)).map((entry) => entry.entryKind)).toEqual(["payment", "payment_reversal", "payment"]);
    expect(JSON.stringify(await ledgerOf(organizationId))).not.toContain("Virement rejeté");
    expect(await verifyLedger(organizationId)).toMatchObject({ ok: true, entries: 3 });
  });
});

describe("JUR-06 — Archive comptable", () => {
  it("chaque année d'écritures se lit dans l'ordre de la chaîne, avec les numéros, montants et empreintes", async () => {
    const { organizationId, items, number } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const [method] = await addPaymentMethods(organizationId, ["Chèque"]);
    await markScheduleItemPaid({ organizationId, scheduleItemId: items[0]!.id, paidOn: "2027-04-09", paymentMethodId: method!.id, now: NOW });
    const thisYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(new Date()));
    expect(await listLedgerYears(organizationId)).toEqual([thisYear]);
    const entries = await listLedgerEntries(organizationId, thisYear);
    expect(entries.map((entry) => [entry.sequence, entry.kind, entry.number, entry.quoteNumber, entry.amountCents, entry.paymentMethodLabel])).toEqual([
      [1, "invoice", invoice.number, number, 80400, null],
      [2, "original", null, null, null, null],
      [3, "payment", null, number, 80400, "Chèque"],
    ]);
    expect(entries[1]!.previousHash).toBe(entries[0]!.hash);
  });
});

