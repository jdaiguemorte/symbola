// Lot 31c (FAC-05, FAC-07, JUR-01, JUR-08 ; décisions D18 à D22, réponses de l'expert-comptable du
// 13/11/2026) — contre un vrai PostgreSQL (RLS, déclencheurs), par la porte d'entrée du module :
// conditions de paiement selon le client et taux des pénalités choisi ; solde qui déduit les
// acomptes en HT et en TVA, taux par taux ; arrhes sans facture, reçu non fiscal à l'encaissement,
// solde au prix total avec les arrhes en règlement ; une seule échéance d'arrhes ; e-reporting sans
// les arrhes ; abus d'une autre organisation ; essai guidé ; RGPD du reçu.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { quoteVersions } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { starterInvoiceMentions, starterProfessionalPaymentTerms } from "@symbola/starter-templates";
import { eq } from "drizzle-orm";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import {
  EarnestNotInvoicedError,
  EarnestSingleInstalmentError,
  QuoteNotFoundError,
  ReceiptNotFoundError,
  RequiredMentionsMissingError,
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  getEReporting,
  getQuote,
  getQuoteScheduledDeposit,
  getQuoteSettings,
  getReceipt,
  issueBalanceInvoice,
  issueCreditNote,
  issueDepositInvoice,
  listQuoteReceipts,
  loadStarterPaymentTerms,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  quoteMissingMentions,
  removeEventQuotesData,
  sendQuote,
  sendQuoteForSignature,
  setQuoteAdvanceKind,
  setQuoteClientKind,
  updateQuoteSettings,
} from "./service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { quotesPrivacy } from "./privacy";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const NOW = new Date("2027-04-10T10:00:00Z");
const renderInvoice = async () => Buffer.from("%PDF-1.4\n% facture de test\n%%EOF\n", "latin1");
const renderCreditNote = async () => Buffer.from("%PDF-1.4\n% avoir de test\n%%EOF\n", "latin1");

afterEach(() => setSignatureProviderForTests(undefined));

async function organization() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, metier: "wedding_planner" });
  await fillRequiredMentions(organizationId);
  const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-09-18" });
  return { organizationId, plannerId: planner.id, eventId: event.id };
}

type Context = Awaited<ReturnType<typeof organization>>;

// 1 500 € HT à 20 % + 800 € HT à 10 % (TTC 2 680 €).
async function draft(context: Context, options: { eventId?: string; schedule?: { label: string; dueDate: string; percentageBasisPoints?: number; amountCents?: number }[]; advanceKind?: "deposit" | "earnest" } = {}) {
  const quote = await createQuote({ organizationId: context.organizationId, eventId: options.eventId ?? context.eventId, createdByUserId: context.plannerId, now: NOW });
  await addQuoteLine(context.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 2000 });
  await addQuoteLine(context.organizationId, quote.id, { label: "Décoration", unit: "forfait", quantityMilli: 1000, unitPriceCents: 80000, vatRateBasisPoints: 1000 });
  if (options.advanceKind) await setQuoteAdvanceKind(context.organizationId, quote.id, options.advanceKind);
  for (const item of options.schedule ?? []) await addScheduleItem(context.organizationId, quote.id, item);
  return quote.id;
}

async function sign(context: Context, quoteId: string) {
  await sendQuote({ organizationId: context.organizationId, quoteId, now: NOW });
  setSignatureProviderForTests(fakeSignatureProvider());
  const sent = await sendQuoteForSignature({
    organizationId: context.organizationId,
    quoteId,
    signers: [
      { name: "Léa Martin", email: `lea-${randomUUID()}@example.test`, billingAddress: "4 rue des Lilas, 24200 Sarlat" },
      { name: "Maxime Dubois", email: `maxime-${randomUUID()}@example.test`, billingAddress: "4 rue des Lilas, 24200 Sarlat" },
    ],
    documentPdf: PDF,
    locale: "fr",
  });
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
  return getQuote(context.organizationId, quoteId);
}

const EARNEST = [{ label: "Arrhes à la réservation", dueDate: "2027-04-15", amountCents: 50000 }];
const DEPOSITS = [
  { label: "Acompte à la signature", dueDate: "2027-04-15", percentageBasisPoints: 3000 },
  { label: "Deuxième acompte", dueDate: "2027-06-01", amountCents: 50000 },
];

async function paymentMethod(context: Context) {
  const [method] = await addPaymentMethods(context.organizationId, ["Virement bancaire"]);
  return method!.id;
}

describe("JUR-01 / FAC-07 — Conditions de paiement selon le client et taux des pénalités (lot 31c, D18)", () => {
  it("les réglages gardent les deux textes et le taux choisi ; aucun taux par défaut ; un taux inconnu ou un préfixe réservé est refusé ; un champ absent reste inchangé", async () => {
    const context = await organization();
    const before = await getQuoteSettings(context.organizationId);
    expect(before).toMatchObject({ invoiceMentionsProfessional: null, latePenaltyRate: null, receiptPrefix: "R" });

    const saved = await updateQuoteSettings(context.organizationId, { ...before, invoiceMentionsProfessional: "Paiement à 30 jours.", latePenaltyRate: "three_times_legal", receiptPrefix: "RA" });
    expect(saved).toMatchObject({ invoiceMentionsProfessional: "Paiement à 30 jours.", latePenaltyRate: "three_times_legal", receiptPrefix: "RA" });

    await expect(updateQuoteSettings(context.organizationId, { ...saved, latePenaltyRate: "bce" as never })).rejects.toBeInstanceOf(RangeError);
    await expect(updateQuoteSettings(context.organizationId, { ...saved, receiptPrefix: "DEMO" })).rejects.toBeInstanceOf(RangeError);

    // Un enregistrement sans les champs du 31c (ancien formulaire) les laisse inchangés.
    const older = {
      validityDays: 45,
      quotePrefix: saved.quotePrefix,
      invoicePrefix: saved.invoicePrefix,
      creditNotePrefix: saved.creditNotePrefix,
      upcomingHorizonDays: saved.upcomingHorizonDays,
      invoicePaymentTermDays: saved.invoicePaymentTermDays,
      invoiceMentions: saved.invoiceMentions,
      advanceKindDefault: saved.advanceKindDefault,
    };
    expect(await updateQuoteSettings(context.organizationId, older)).toMatchObject({ validityDays: 45, latePenaltyRate: "three_times_legal", receiptPrefix: "RA" });
  });

  it("devis d'un professionnel : texte professionnel et taux nommés avant l'envoi ; remplis, il part et les garde figés", async () => {
    const context = await organization();
    const quoteId = await draft(context);
    await setQuoteClientKind(context.organizationId, quoteId, "professional");
    expect(await quoteMissingMentions(context.organizationId, quoteId)).toEqual(["professionalPaymentTerms", "latePenaltyRate"]);
    await expect(sendQuote({ organizationId: context.organizationId, quoteId, now: NOW })).rejects.toMatchObject({ fields: ["professionalPaymentTerms", "latePenaltyRate"] });

    const settings = await getQuoteSettings(context.organizationId);
    await updateQuoteSettings(context.organizationId, { ...settings, invoiceMentionsProfessional: "Paiement à 30 jours, par virement.", latePenaltyRate: "ecb_plus_10" });
    const sent = await sendQuote({ organizationId: context.organizationId, quoteId, now: NOW });
    expect(sent.current.seller).toMatchObject({ paymentTerms: "Paiement à 30 jours, par virement.", latePenaltyRate: "ecb_plus_10" });

    await updateQuoteSettings(context.organizationId, { ...(await getQuoteSettings(context.organizationId)), latePenaltyRate: "three_times_legal" });
    expect((await getQuote(context.organizationId, quoteId)).current.seller).toMatchObject({ latePenaltyRate: "ecb_plus_10" });
  });

  it("particulier : rien du professionnel n'est demandé ni figé sur son devis", async () => {
    const context = await organization();
    const quoteId = await draft(context);
    expect(await quoteMissingMentions(context.organizationId, quoteId)).toEqual([]);
    const sent = await sendQuote({ organizationId: context.organizationId, quoteId, now: NOW });
    expect(sent.current.seller?.paymentTerms ?? null).toBeNull();
    expect(sent.current.seller?.latePenaltyRate ?? null).toBeNull();
  });

  it("au démarrage, les deux textes de départ sont enregistrés, jamais le taux ; un texte déjà saisi reste", async () => {
    const db = appDatabase();
    const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
    expect(await loadStarterPaymentTerms(organizationId, "fr")).toBe(true);
    expect(await getQuoteSettings(organizationId)).toMatchObject({
      invoiceMentions: starterInvoiceMentions("fr"),
      invoiceMentionsProfessional: starterProfessionalPaymentTerms("fr"),
      latePenaltyRate: null,
    });
    expect(await loadStarterPaymentTerms(organizationId, "fr")).toBe(false);

    const other = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
    await updateQuoteSettings(other, { ...(await getQuoteSettings(other)), invoiceMentions: "Mon texte." });
    expect(await loadStarterPaymentTerms(other, "en")).toBe(true);
    expect(await getQuoteSettings(other)).toMatchObject({ invoiceMentions: "Mon texte.", invoiceMentionsProfessional: starterProfessionalPaymentTerms("en") });
  });
});

describe("FAC-05 — Le solde déduit les acomptes en HT et en TVA, taux par taux (lot 31c, D20)", () => {
  it("chaque acompte est retiré de son propre taux ; acomptes et solde redonnent exactement le devis", async () => {
    const context = await organization();
    const quote = await sign(context, await draft(context, { schedule: DEPOSITS, advanceKind: "deposit" }));
    const items = quote.current.schedule.items;
    const first = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const second = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, scheduleItemId: items[1]!.id, now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, quoteId: quote.id, now: NOW });

    expect(balance.deductions.map((deduction) => [deduction.number, deduction.amountCents, deduction.totals?.totalTtcCents])).toEqual([
      [first.number, 80400, 80400],
      [second.number, 50000, 50000],
    ]);
    expect(balance.amountCents).toBe(268000 - 80400 - 50000);
    expect(balance.amountDueCents).toBe(balance.amountCents);
    for (const line of balance.quoteTotals.vatByRate) {
      const parts = [first.totals, second.totals, balance.totals].map((totals) => totals.vatByRate.find((entry) => entry.rateBasisPoints === line.rateBasisPoints)!);
      expect(parts.reduce((sum, part) => sum + part.baseCents, 0)).toBe(line.baseCents);
      expect(parts.reduce((sum, part) => sum + part.vatCents, 0)).toBe(line.vatCents);
    }
  });

  it("un avoir partiel réduit la déduction de son acompte, taux par taux", async () => {
    const context = await organization();
    const quote = await sign(context, await draft(context, { schedule: DEPOSITS, advanceKind: "deposit" }));
    const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, scheduleItemId: quote.current.schedule.items[0]!.id, now: NOW });
    await issueCreditNote({ renderOriginal: renderCreditNote, organizationId: context.organizationId, invoiceId: deposit.id, amountCents: 400, reason: "Arrondi", now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, quoteId: quote.id, now: NOW });
    expect(balance.deductions.map((deduction) => [deduction.amountCents, deduction.totals?.totalTtcCents])).toEqual([[80000, 80000]]);
    expect(balance.amountCents).toBe(268000 - 80000);
    expect(balance.totals.totalHtCents + balance.totals.totalVatCents).toBe(balance.amountCents);
  });
});

describe("JUR-08 — Arrhes : une seule échéance, aucune facture, reçu non fiscal, solde au prix total (lot 31c, D21, D22)", () => {
  it("un devis à arrhes n'a qu'une échéance : le choix des arrhes sur deux échéances, et une deuxième échéance, sont refusés", async () => {
    const context = await organization();
    const twoItems = await draft(context, { schedule: DEPOSITS });
    await expect(setQuoteAdvanceKind(context.organizationId, twoItems, "earnest")).rejects.toBeInstanceOf(EarnestSingleInstalmentError);
    expect((await getQuote(context.organizationId, twoItems)).current.advanceKind).not.toBe("earnest");

    const earnest = await draft(context, { schedule: EARNEST, advanceKind: "earnest" });
    await expect(addScheduleItem(context.organizationId, earnest, DEPOSITS[1]!)).rejects.toBeInstanceOf(EarnestSingleInstalmentError);
    expect((await getQuote(context.organizationId, earnest)).current.schedule.items).toHaveLength(1);
  });

  it("avant l'envoi, un devis à arrhes à plusieurs échéances (copie ancienne) est nommé et ne part pas", async () => {
    const context = await organization();
    const quoteId = await draft(context, { schedule: DEPOSITS });
    const quote = await getQuote(context.organizationId, quoteId);
    await withOrganization(appDatabase(), context.organizationId, (tx) => tx.update(quoteVersions).set({ advanceKind: "earnest" }).where(eq(quoteVersions.id, quote.current.id)));
    expect(await quoteMissingMentions(context.organizationId, quoteId)).toEqual(["earnestSingleInstalment"]);
    await expect(sendQuote({ organizationId: context.organizationId, quoteId, now: NOW })).rejects.toBeInstanceOf(RequiredMentionsMissingError);
  });

  it("aucune facture d'arrhes : l'émission est refusée sans consommer de numéro ; rien n'est programmé à la signature", async () => {
    const context = await organization();
    const earnest = await sign(context, await draft(context, { schedule: EARNEST, advanceKind: "earnest" }));
    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, scheduleItemId: earnest.current.schedule.items[0]!.id, now: NOW })).rejects.toBeInstanceOf(EarnestNotInvoicedError);
    expect(await getQuoteScheduledDeposit(context.organizationId, earnest.id)).toBeNull();

    const deposit = await sign(context, await draft(context, { schedule: DEPOSITS, advanceKind: "deposit" }));
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, scheduleItemId: deposit.current.schedule.items[0]!.id, now: NOW });
    expect(invoice.number).toBe("F-2027-0001");
  });

  it("à l'encaissement des arrhes, un reçu non fiscal de sa propre série ; annulé, l'encaissement marque le reçu, qui reste ; un acompte n'en reçoit pas", async () => {
    const context = await organization();
    const methodId = await paymentMethod(context);
    const earnest = await sign(context, await draft(context, { schedule: EARNEST, advanceKind: "earnest" }));
    const itemId = earnest.current.schedule.items[0]!.id;
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: itemId, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });

    const [receipt] = await listQuoteReceipts(context.organizationId, earnest.id);
    expect(receipt).toMatchObject({
      number: "R-2027-0001",
      quoteNumber: earnest.number,
      scheduleItemId: itemId,
      paidOn: "2027-04-08",
      amountCents: 50000,
      label: "Arrhes à la réservation",
      paymentMethodLabel: "Virement bancaire",
      cancelled: false,
      isDemo: false,
    });
    expect(receipt!.buyers.map((buyer) => buyer.name)).toEqual(["Léa Martin", "Maxime Dubois"]);
    expect(receipt!.seller.organizationName).toBeTruthy();
    expect(await getReceipt(context.organizationId, receipt!.id)).toEqual(receipt);

    await markScheduleItemUnpaid(context.organizationId, itemId, "Virement rejeté par la banque");
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: itemId, paidOn: "2027-04-09", paymentMethodId: methodId, now: NOW });
    expect((await listQuoteReceipts(context.organizationId, earnest.id)).map((entry) => [entry.number, entry.paidOn, entry.cancelled])).toEqual([
      ["R-2027-0001", "2027-04-08", true],
      ["R-2027-0002", "2027-04-09", false],
    ]);

    const deposit = await sign(context, await draft(context, { schedule: DEPOSITS, advanceKind: "deposit" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: deposit.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });
    expect(await listQuoteReceipts(context.organizationId, deposit.id)).toEqual([]);
  });

  it("le solde d'un devis à arrhes porte le prix total, puis les arrhes reçues en règlement, puis le reste à payer", async () => {
    const context = await organization();
    const methodId = await paymentMethod(context);
    const earnest = await sign(context, await draft(context, { schedule: EARNEST, advanceKind: "earnest" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: earnest.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, quoteId: earnest.id, now: NOW });

    expect(balance).toMatchObject({ kind: "balance", advanceKind: "earnest", amountCents: 268000, amountDueCents: 268000 - 50000, deductions: [] });
    expect(balance.totals).toEqual({ totalHtCents: 230000, vatByRate: balance.quoteTotals.vatByRate, totalVatCents: 38000, totalTtcCents: 268000 });
    expect(balance.settlements).toEqual([{ label: "Arrhes à la réservation", paidOn: "2027-04-08", amountCents: 50000 }]);
  });

  it("l'e-reporting garde la facture de solde au prix total mais exclut l'encaissement des arrhes", async () => {
    const context = await organization();
    const methodId = await paymentMethod(context);
    const earnest = await sign(context, await draft(context, { schedule: EARNEST, advanceKind: "earnest" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: earnest.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId: context.organizationId, quoteId: earnest.id, now: NOW });
    const deposit = await sign(context, await draft(context, { schedule: DEPOSITS, advanceKind: "deposit" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: deposit.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });

    const report = await getEReporting(context.organizationId, { from: "2027-04-01", to: "2027-04-30" });
    expect(report.invoices.map((invoice) => [invoice.number, invoice.totalTtcCents])).toEqual([[balance.number, 268000]]);
    expect(report.payments.map((payment) => [payment.quoteNumber, payment.label, payment.amountCents])).toEqual([[deposit.number, "Acompte à la signature", 80400]]);
  });

  it("une organisation ne lit pas les reçus d'une autre ; un reçu d'essai prend la série DEMO et disparaît avec l'essai", async () => {
    const context = await organization();
    const methodId = await paymentMethod(context);
    const earnest = await sign(context, await draft(context, { schedule: EARNEST, advanceKind: "earnest" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: earnest.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });
    const [receipt] = await listQuoteReceipts(context.organizationId, earnest.id);

    const intruder = await organization();
    await expect(getReceipt(intruder.organizationId, receipt!.id)).rejects.toBeInstanceOf(ReceiptNotFoundError);
    await expect(listQuoteReceipts(intruder.organizationId, earnest.id)).rejects.toBeInstanceOf(QuoteNotFoundError);

    const trial = await startEventsTrial({ organizationId: context.organizationId, userId: context.plannerId, locale: "fr", now: NOW });
    const demo = await sign(context, await draft(context, { eventId: trial.eventId, schedule: EARNEST, advanceKind: "earnest" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: demo.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });
    const [demoReceipt] = await listQuoteReceipts(context.organizationId, demo.id);
    expect(demoReceipt).toMatchObject({ number: "DEMO-R-2027-0001", isDemo: true });
    await removeEventQuotesData(context.organizationId, [trial.eventId]);
    await expect(getReceipt(context.organizationId, demoReceipt!.id)).rejects.toBeInstanceOf(ReceiptNotFoundError);
    expect(await listQuoteReceipts(context.organizationId, earnest.id)).toHaveLength(1);
  });

  it("RGPD : le reçu est trouvé par le nom du client, gardé pendant la conservation comptable, puis anonymisé", async () => {
    const context = await organization();
    const methodId = await paymentMethod(context);
    const earnest = await sign(context, await draft(context, { schedule: EARNEST, advanceKind: "earnest" }));
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: earnest.current.schedule.items[0]!.id, paidOn: "2027-04-08", paymentMethodId: methodId, now: NOW });
    const [receipt] = await listQuoteReceipts(context.organizationId, earnest.id);

    const found = (await quotesPrivacy.find({ organizationId: context.organizationId, terms: { name: "Lea Martin" } })).filter((record) => record.kind === "earnest_receipt");
    expect(found).toMatchObject([{ recordId: receipt!.id, label: receipt!.number }]);
    const related = (await quotesPrivacy.related({ organizationId: context.organizationId, eventIds: [context.eventId] })).filter((record) => record.kind === "earnest_receipt");
    expect(related.map((record) => record.recordId)).toEqual([receipt!.id]);

    const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 120 };
    const records = [{ kind: "earnest_receipt", recordId: receipt!.id }];
    expect(await quotesPrivacy.planErasure({ organizationId: context.organizationId, records, rules, today: "2028-01-01" })).toEqual([
      { kind: "earnest_receipt", recordId: receipt!.id, fate: "kept", legalBasis: "accounting", keptUntil: "2037-04-10" },
    ]);
    await quotesPrivacy.erase({ organizationId: context.organizationId, records, rules, today: "2037-04-11" });
    expect((await getReceipt(context.organizationId, receipt!.id)).buyers.map((buyer) => [buyer.name, buyer.billingAddress])).toEqual([
      ["[anonymisé]", "[anonymisé]"],
      ["[anonymisé]", "[anonymisé]"],
    ]);
  });
});
