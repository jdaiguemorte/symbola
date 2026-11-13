// Lot 32a (FAC-12 ; décision D8) — trois chiffres de l'année : signé (devis signés, TTC, à la date de
// signature), facturé (factures moins avoirs, à la date d'émission), encaissé (encaissements moins
// annulations, arrhes comprises, à la date du paiement) ; sans les essais ; par organisation.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import {
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  getRevenueSummary,
  issueCreditNote,
  issueDepositInvoice,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  sendQuote,
  sendQuoteForSignature,
  setQuoteAdvanceKind,
} from "./service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const render = async () => Buffer.from("%PDF-1.4\n% pièce de test\n%%EOF\n", "latin1");
// Les signatures et les émissions sont datées du jour réel : l'année est la courante, à Paris.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const year = () => Number(today().slice(0, 4));

afterEach(() => setSignatureProviderForTests(undefined));

async function atelier() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, metier: "wedding_planner" });
  await fillRequiredMentions(organizationId);
  const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-09-18" });
  const [method] = await addPaymentMethods(organizationId, ["Virement bancaire"]);
  return { organizationId, plannerId: planner.id, eventId: event.id, methodId: method!.id };
}

type Atelier = Awaited<ReturnType<typeof atelier>>;

// Un devis de 1 000 € HT à 20 % (1 200 € TTC), une échéance de 30 %, signé si demandé.
async function quote(context: Atelier, options: { sign: boolean; advanceKind?: "deposit" | "earnest" }) {
  const created = await createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId });
  await addQuoteLine(context.organizationId, created.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000, vatRateBasisPoints: 2000 });
  await setQuoteAdvanceKind(context.organizationId, created.id, options.advanceKind ?? "deposit");
  const detail = await addScheduleItem(context.organizationId, created.id, { label: "À la signature", dueDate: today(), percentageBasisPoints: 3000 });
  await sendQuote({ organizationId: context.organizationId, quoteId: created.id });
  if (options.sign) {
    setSignatureProviderForTests(fakeSignatureProvider());
    const sent = await sendQuoteForSignature({
      organizationId: context.organizationId,
      quoteId: created.id,
      signers: [{ name: "Léa Martin", email: `lea-${randomUUID()}@example.test`, billingAddress: "4 rue des Lilas, 24200 Sarlat" }],
      documentPdf: PDF,
      locale: "fr",
    });
    for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
  }
  return { quoteId: created.id, itemId: detail.current.schedule.items[0]!.id };
}

describe("FAC-12 — Signé, facturé, encaissé (lot 32a, D8)", () => {
  it("signé : les devis signés de l'année, TTC ; un devis envoyé mais non signé n'y est pas", async () => {
    const context = await atelier();
    await quote(context, { sign: true });
    await quote(context, { sign: false });
    expect(await getRevenueSummary(context.organizationId, year())).toEqual({ year: year(), signedCents: 120000, invoicedCents: 0, collectedCents: 0 });
  });

  it("facturé : factures moins avoirs ; encaissé : encaissements moins annulations, arrhes comprises", async () => {
    const context = await atelier();
    const deposit = await quote(context, { sign: true });
    const invoice = await issueDepositInvoice({ renderOriginal: render, organizationId: context.organizationId, scheduleItemId: deposit.itemId });
    await issueCreditNote({ renderOriginal: render, organizationId: context.organizationId, invoiceId: invoice.id, amountCents: 1000, reason: "Geste commercial" });
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: deposit.itemId, paidOn: today(), paymentMethodId: context.methodId });
    const earnest = await quote(context, { sign: true, advanceKind: "earnest" });
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: earnest.itemId, paidOn: today(), paymentMethodId: context.methodId });
    await markScheduleItemUnpaid(context.organizationId, earnest.itemId, "Virement rejeté");
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: earnest.itemId, paidOn: today(), paymentMethodId: context.methodId });

    expect(await getRevenueSummary(context.organizationId, year())).toEqual({ year: year(), signedCents: 240000, invoicedCents: 36000 - 1000, collectedCents: 36000 + 36000 });
    expect(await getRevenueSummary(context.organizationId, year() - 1)).toEqual({ year: year() - 1, signedCents: 0, invoicedCents: 0, collectedCents: 0 });
  });

  it("une autre organisation ne voit rien des chiffres de celle-ci ; une année invalide est refusée", async () => {
    const context = await atelier();
    await quote(context, { sign: true });
    const other = await atelier();
    expect(await getRevenueSummary(other.organizationId, year())).toEqual({ year: year(), signedCents: 0, invoicedCents: 0, collectedCents: 0 });
    await expect(getRevenueSummary(context.organizationId, 1899)).rejects.toBeInstanceOf(RangeError);
  });
});
