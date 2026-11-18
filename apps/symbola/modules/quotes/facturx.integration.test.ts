// Lot 41 (FAC-10, JUR-02, JUR-12, JUR-13 ; D1, D6 à D11) — Factur-X, mentions de la réforme et bon
// de commande, contre un vrai PostgreSQL (RLS, déclencheurs) et le stockage, par la porte d'entrée
// du module. Les devis sont signés par le faux fournisseur (DEV-02), comme dans l'essai guidé.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { eq } from "drizzle-orm";
import { invoices, originalDocuments } from "@symbola/db/schema/quotes";
import { createContact, saveOnboardingStep, saveVatOnDebits, VatOnDebitsNotApplicableError } from "@/modules/hub/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { readCiiTotals } from "./facturx/cii";
import { invoiceFacturX } from "./facturx/document";
import {
  FacturXTotalsMismatchError,
  QuoteBuyerNotFoundError,
  QuoteNotFoundError,
  RequiredMentionsMissingError,
  actOnFakeSignature,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  extractFacturXml,
  getInvoicePdf,
  getQuote,
  issueBalanceInvoice,
  issueCreditNote,
  issueDepositInvoice,
  listClientQuotesToSign,
  listQuoteInvoices,
  sendQuote,
  sendQuoteForSignature,
  setClientOrderReference,
  setFacturXBuildersForTests,
  setQuoteBuyerDetails,
  setQuoteClientKind,
  updateQuoteSettings,
  getQuoteSettings,
  ProfessionalTermOutOfBoundsError,
  verifyLedger,
} from "./service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { confirmed } from "@/lib/test-fixtures/recipients";
import { minimalPdf } from "@/lib/test-fixtures/pdf";

const renderInvoice = async () => minimalPdf("facture de test");
const renderCreditNote = async () => minimalPdf("avoir de test");
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const NOW = new Date("2027-04-10T10:00:00Z");

afterEach(() => {
  setSignatureProviderForTests(undefined);
  setFacturXBuildersForTests(undefined);
});

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
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime, vatRateDefaultBasisPoints: vatRegime === "assujetti" ? 2000 : null, siren: "123456782" }));
  await fillRequiredMentions(organizationId);
  // Lot 31c (D18) : face à un professionnel, son texte et le taux des pénalités.
  await updateQuoteSettings(organizationId, { ...(await getQuoteSettings(organizationId)), invoiceMentionsProfessional: "Paiement par virement.", latePenaltyRate: "three_times_legal" });
  const planner = await withDb((db) => createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }));
  return { organizationId, plannerId: planner.id };
}

// SC-11 : Novaléa SAS (SIREN fictif), adresse de facturation distincte du lieu de l'évènement.
async function novalea(organizationId: string, overrides: { companyIdNumber?: string | null; postalCode?: string | null } = {}) {
  return createContact(organizationId, {
    kind: "company",
    name: "Novaléa SAS",
    companyIdNumber: overrides.companyIdNumber === undefined ? "55210055400013" : overrides.companyIdNumber,
    vatNumber: "FR83552100554",
    addressLine: "8 avenue des Champs",
    postalCode: overrides.postalCode === undefined ? "75008" : overrides.postalCode,
    city: "Paris",
    country: "France",
  });
}

// Devis de 1 500 € HT à 20 % (« service ») + 2 lots de 400 € HT à 10 % (« bien »), acompte de 30 %,
// signé par Claire Fictive pour l'entreprise.
async function signedQuote(options: { professional?: boolean; organization?: { organizationId: string; plannerId: string } } = {}) {
  const { organizationId, plannerId } = options.organization ?? (await organization());
  const source = await createProspectSource(organizationId, "Salon");
  const eventId = (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, eventDate: "2027-09-18", clients: [{ firstName: "Claire", lastName: "Fictive" }] })).id;
  const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 2000 });
  await addQuoteLine(organizationId, quote.id, { label: "Décoration florale", unit: "lot", quantityMilli: 2000, unitPriceCents: 40000, vatRateBasisPoints: 1000, nature: "goods" });
  await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: "2027-04-15", percentageBasisPoints: 3000 });
  if (options.professional) await setQuoteClientKind(organizationId, quote.id, "professional");
  await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
  setSignatureProviderForTests(fakeSignatureProvider());
  const email = `claire-${randomUUID()}@example.test`;
  const sent = await sendQuoteForSignature(confirmed({
    organizationId,
    quoteId: quote.id,
    signers: [{ name: "Claire Fictive", email, billingAddress: "8 avenue des Champs, 75008 Paris" }],
    documentPdf: PDF,
    locale: "fr",
  }));
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
  return { organizationId, plannerId, eventId, quoteId: quote.id, items: sent.current.schedule.items, email };
}

async function storedXml(organizationId: string, invoiceId: string): Promise<string> {
  const served = await getInvoicePdf(organizationId, invoiceId, async () => {
    throw new Error("l'original ne doit pas être reconstruit");
  });
  const xml = extractFacturXml(served.pdf);
  if (!xml) throw new Error("fichier structuré absent");
  return xml;
}

describe("FAC-10 — Facture au format Factur-X ; connecteur vers une plateforme agréée", () => {
  it("chaque facture et chaque avoir émis est un Factur-X : original gardé, format noté, empreinte dans la chaîne ; totaux du XML égaux à ceux de la facture", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    const credit = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: balance.id, amountCents: 1000, reason: "Geste", now: NOW });
    expect(deposit.reform?.format).toBe("facturx");
    expect(credit.reform?.invoiceIssuedOn).toBe(balance.issuedOn);
    for (const invoice of [deposit, balance]) {
      const totals = readCiiTotals(await storedXml(organizationId, invoice.id));
      expect(totals.grandTotalCents).toBe(invoice.totals.totalTtcCents);
      expect(totals.taxTotalCents).toBe(invoice.totals.totalVatCents);
      expect(totals.duePayableCents).toBe(invoice.amountDueCents);
    }
    expect(await storedXml(organizationId, balance.id)).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(await storedXml(organizationId, deposit.id)).toContain("<ram:TypeCode>386</ram:TypeCode>");
    const formats = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select({ format: originalDocuments.format }).from(originalDocuments)));
    expect(formats.map((row) => row.format)).toEqual(["facturx", "facturx", "facturx"]);
    expect(await verifyLedger(organizationId)).toMatchObject({ ok: true, entries: 6 });
  });

  it("une différence provoquée entre le XML et le PDF arrête l'émission sans consommer de numéro", async () => {
    const { organizationId, quoteId, items } = await signedQuote();
    setFacturXBuildersForTests({ invoice: (invoice, texts) => ({ ...invoiceFacturX(invoice, texts), prepaidCents: 1 }) });
    await expect(issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW })).rejects.toBeInstanceOf(FacturXTotalsMismatchError);
    expect(await listQuoteInvoices(organizationId, quoteId)).toEqual([]);
    setFacturXBuildersForTests(undefined);
    expect((await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW })).number).toBe("F-2027-0001");
  });

  it("client professionnel sans acheteur, sans SIREN ou sans adresse structurée : refus qui nomme le champ, sans numéro consommé", async () => {
    const { organizationId, quoteId, items } = await signedQuote({ professional: true });
    const issue = () => issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    await expect(issue()).rejects.toMatchObject({ fields: ["buyerCompany"] });
    const person = await createContact(organizationId, { firstName: "Claire", lastName: "Fictive" });
    await expect(setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: person.id, orderReference: null, buyerReference: null, deliveryAddress: null })).rejects.toBeInstanceOf(QuoteBuyerNotFoundError);
    const noSiren = await novalea(organizationId, { companyIdNumber: null, postalCode: null });
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: noSiren.id, orderReference: null, buyerReference: null, deliveryAddress: null });
    await expect(issue()).rejects.toBeInstanceOf(RequiredMentionsMissingError);
    await expect(issue()).rejects.toMatchObject({ fields: ["buyerSiren", "buyerAddress"] });
    expect(await listQuoteInvoices(organizationId, quoteId)).toEqual([]);
    const company = await novalea(organizationId, {});
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: null, buyerReference: null, deliveryAddress: null });
    expect((await issue()).number).toBe("F-2027-0001");
  });

  it("une pièce émise avant le lot 41 reste lisible et inchangée : PDF simple, sans copie de la réforme", async () => {
    const { organizationId, items } = await signedQuote();
    const issued = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    const legacyId = await withDb((db) =>
      withOrganization(db, organizationId, async (tx) => {
        const [row] = await tx.select().from(invoices).where(eq(invoices.id, issued.id));
        const [legacy] = await tx.insert(invoices).values({ ...row!, id: randomUUID(), number: "F-ANCIENNE-0002", reformSnapshot: null, createdBy: null }).returning();
        return legacy!.id;
      }),
    );
    const legacy = await getInvoicePdf(organizationId, legacyId, renderInvoice);
    expect(legacy.pdf.equals(await renderInvoice())).toBe(true);
    expect(extractFacturXml(legacy.pdf)).toBeNull();
  });
});

describe("JUR-02 — Mentions de la réforme : SIREN du client, adresse de livraison, nature de l'opération, option sur les débits", () => {
  it("SIREN figé depuis le SIRET de l'acheteur, raison sociale, TVA et adresse structurée ; catégorie « mixte » imprimée et portée (M1)", async () => {
    const { organizationId, quoteId, items } = await signedQuote({ professional: true });
    const company = await novalea(organizationId);
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: null, buyerReference: null, deliveryAddress: null });
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    expect(invoice.buyers).toEqual([
      { kind: "company", name: "Novaléa SAS", billingAddress: "8 avenue des Champs, 75008 Paris", siren: "552100554", vatNumber: "FR83552100554", address: { line: "8 avenue des Champs", postalCode: "75008", city: "Paris", countryCode: "FR" } },
    ]);
    expect(invoice.reform?.category).toBe("mixed");
    const xml = await storedXml(organizationId, invoice.id);
    expect(xml).toContain('<ram:ID schemeID="0002">552100554</ram:ID>');
    expect(xml).toContain("<ram:ID>M1</ram:ID>");
    // La fiche du contact change ensuite : la facture émise garde sa copie.
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: null, orderReference: null, buyerReference: null, deliveryAddress: null });
    expect((await listQuoteInvoices(organizationId, quoteId))[0]!.buyers[0]!.siren).toBe("552100554");
  });

  it("adresse de livraison figée et portée seulement si elle diffère de l'adresse de facturation", async () => {
    const { organizationId, quoteId, items } = await signedQuote({ professional: true });
    const company = await novalea(organizationId);
    const same = { line: "8 avenue des Champs", postalCode: "75008", city: "Paris", countryCode: "FR" };
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: null, buyerReference: null, deliveryAddress: same });
    const first = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    expect(first.reform?.deliveryAddress).toBeNull();
    const venue = { line: "Château des Essais, route du Lac", postalCode: "74000", city: "Annecy", countryCode: "FR" };
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: null, buyerReference: null, deliveryAddress: venue });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    expect(balance.reform?.deliveryAddress).toEqual(venue);
    expect(await storedXml(organizationId, balance.id)).toContain("<ram:ShipToTradeParty>");
  });

  it("option sur les débits : refusée en franchise ; imprimée seulement quand elle est active à la date d'émission (horloge simulée)", async () => {
    const franchise = await organization("franchise");
    await expect(withDb((db) => saveVatOnDebits(db, franchise.organizationId, { enabled: true, from: "2027-05-01" }))).rejects.toBeInstanceOf(VatOnDebitsNotApplicableError);

    const org = await organization("assujetti");
    await withDb((db) => saveVatOnDebits(db, org.organizationId, { enabled: true, from: "2027-05-01" }));
    const { organizationId, quoteId, items } = await signedQuote({ organization: org });
    // Veille de la date d'effet, à 23 h 30 à Paris : pas encore active.
    const before = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: new Date("2027-04-30T21:30:00Z") });
    expect(before.reform?.vatOnDebits).toBe(false);
    // Le jour même, à 0 h 30 à Paris : active.
    const sameDay = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: new Date("2027-04-30T22:30:00Z") });
    expect(sameDay.issuedOn).toBe("2027-05-01");
    expect(sameDay.reform?.vatOnDebits).toBe(true);
    expect(await storedXml(organizationId, sameDay.id)).toContain("<ram:DueDateTypeCode>5</ram:DueDateTypeCode>");
  });
});

describe("JUR-12 — Délais de paiement, pénalités et indemnité forfaitaire repris sur les factures aux professionnels", () => {
  it("délai hors bornes refusé (61 jours, 46 jours fin de mois) ; bornes acceptées ; escompte « Néant » par défaut ; échéance du solde au délai d'un professionnel", async () => {
    const { organizationId, quoteId } = await signedQuote({ professional: true });
    const settings = await getQuoteSettings(organizationId);
    expect(settings.professionalPaymentTermDays).toBe(30);
    await expect(updateQuoteSettings(organizationId, { ...settings, professionalPaymentTermDays: 61 })).rejects.toBeInstanceOf(ProfessionalTermOutOfBoundsError);
    await expect(updateQuoteSettings(organizationId, { ...settings, professionalPaymentTermDays: 46, professionalPaymentTermEndOfMonth: true })).rejects.toBeInstanceOf(ProfessionalTermOutOfBoundsError);
    await updateQuoteSettings(organizationId, { ...settings, professionalPaymentTermDays: 60 });
    await updateQuoteSettings(organizationId, { ...settings, professionalPaymentTermDays: 45, professionalPaymentTermEndOfMonth: true });
    const company = await novalea(organizationId);
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: null, buyerReference: null, deliveryAddress: null });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    expect(balance.reform?.professionalTerms).toEqual({ paymentTermDays: 45, endOfMonth: true, discountTerms: "Néant", latePenaltyRate: "three_times_legal" });
    // 10 avril + 45 jours = 25 mai, fin de mois : 31 mai.
    expect(balance.paymentDueOn).toBe("2027-05-31");
    const xml = await storedXml(organizationId, balance.id);
    expect(xml).toContain("<ram:SubjectCode>PMD</ram:SubjectCode>");
    expect(xml).toContain("<ram:SubjectCode>PMT</ram:SubjectCode>");
    expect(xml).toContain("<ram:SubjectCode>AAB</ram:SubjectCode>");
  });

  it("particulier : ni délai d'un professionnel, ni escompte, ni pénalités dans la pièce", async () => {
    const { organizationId, items } = await signedQuote();
    const invoice = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    expect(invoice.reform?.professionalTerms).toBeNull();
    expect(await storedXml(organizationId, invoice.id)).not.toContain("<ram:SubjectCode>PMD</ram:SubjectCode>");
  });
});

describe("JUR-13 — Bon de commande et références d'achat du client sur le devis et la facture", () => {
  it("modifiable après la signature, figé à chaque émission, inchangé ensuite ; neutralisé dans le XML", async () => {
    const { organizationId, quoteId, items } = await signedQuote({ professional: true });
    const company = await novalea(organizationId);
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: 'BC-<2027> & "0142"', buyerReference: "Achats", deliveryAddress: null });
    const deposit = await issueDepositInvoice({ renderOriginal: renderInvoice, organizationId, scheduleItemId: items[0]!.id, now: NOW });
    await setQuoteBuyerDetails(organizationId, quoteId, { buyerContactId: company.id, orderReference: "BC-2027-0143", buyerReference: null, deliveryAddress: null });
    const balance = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    const [first, second] = await listQuoteInvoices(organizationId, quoteId);
    expect(first!.reform?.orderReference).toBe('BC-<2027> & "0142"');
    expect(second!.reform?.orderReference).toBe("BC-2027-0143");
    const xml = await storedXml(organizationId, deposit.id);
    expect(xml).toContain("<ram:IssuerAssignedID>BC-&lt;2027&gt; &amp; &quot;0142&quot;</ram:IssuerAssignedID>");
    expect(xml).toContain("<ram:BuyerReference>Achats</ram:BuyerReference>");
    expect(balance.reform?.buyerReference).toBeNull();
  });

  it("saisi par la cliente depuis son lien ; refusé depuis le lien d'un autre devis ou d'un autre évènement, et pour un non-signataire", async () => {
    const one = await signedQuote({ professional: true });
    const portal = await listClientQuotesToSign(one.organizationId, one.eventId, one.email);
    expect(portal[0]).toMatchObject({ professional: true, canSetOrderReference: true, orderReference: null });
    await setClientOrderReference({ organizationId: one.organizationId, eventId: one.eventId, linkId: randomUUID(), quoteId: one.quoteId, clientEmail: one.email, reference: "BC-2027-0142" });
    expect((await getQuote(one.organizationId, one.quoteId)).buyer.orderReference).toBe("BC-2027-0142");

    const other = await signedQuote({ professional: true, organization: { organizationId: one.organizationId, plannerId: one.plannerId } });
    // Le lien de l'autre évènement ne touche pas ce devis ; un non-signataire non plus.
    await expect(setClientOrderReference({ organizationId: one.organizationId, eventId: other.eventId, linkId: randomUUID(), quoteId: one.quoteId, clientEmail: other.email, reference: "PIRATE" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(setClientOrderReference({ organizationId: one.organizationId, eventId: one.eventId, linkId: randomUUID(), quoteId: one.quoteId, clientEmail: other.email, reference: "PIRATE" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(setClientOrderReference({ organizationId: one.organizationId, eventId: one.eventId, linkId: randomUUID(), quoteId: other.quoteId, clientEmail: one.email, reference: "PIRATE" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    // Borné : trop long, ou avec un retour à la ligne.
    await expect(setClientOrderReference({ organizationId: one.organizationId, eventId: one.eventId, linkId: randomUUID(), quoteId: one.quoteId, clientEmail: one.email, reference: "x".repeat(61) })).rejects.toThrow();
    await expect(setClientOrderReference({ organizationId: one.organizationId, eventId: one.eventId, linkId: randomUUID(), quoteId: one.quoteId, clientEmail: one.email, reference: "BC\n2" })).rejects.toThrow();
    expect((await getQuote(one.organizationId, one.quoteId)).buyer.orderReference).toBe("BC-2027-0142");
  });
});

describe("FAC-10 — Isolation et abus", () => {
  it("une autre organisation ne lit ni ne modifie l'acheteur, les références ou la livraison ; un acheteur d'une autre organisation est refusé comme un contact inconnu", async () => {
    const a = await signedQuote({ professional: true });
    const b = await organization();
    const company = await novalea(a.organizationId);
    await expect(setQuoteBuyerDetails(b.organizationId, a.quoteId, { buyerContactId: null, orderReference: "B", buyerReference: null, deliveryAddress: null })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(getQuote(b.organizationId, a.quoteId)).rejects.toBeInstanceOf(QuoteNotFoundError);
    const theirs = await novalea(b.organizationId);
    await expect(setQuoteBuyerDetails(a.organizationId, a.quoteId, { buyerContactId: theirs.id, orderReference: null, buyerReference: null, deliveryAddress: null })).rejects.toBeInstanceOf(QuoteBuyerNotFoundError);
    await expect(setQuoteBuyerDetails(a.organizationId, a.quoteId, { buyerContactId: randomUUID(), orderReference: null, buyerReference: null, deliveryAddress: null })).rejects.toBeInstanceOf(QuoteBuyerNotFoundError);
    await setQuoteBuyerDetails(a.organizationId, a.quoteId, { buyerContactId: company.id, orderReference: null, buyerReference: null, deliveryAddress: null });
    await expect(setClientOrderReference({ organizationId: b.organizationId, eventId: a.eventId, linkId: randomUUID(), quoteId: a.quoteId, clientEmail: a.email, reference: "B" })).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});
