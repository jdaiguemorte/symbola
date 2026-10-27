// DEV-03 — acomptes et encaissements à venir, contre un vrai PostgreSQL
// (RLS), par la porte d'entrée du module ; horloge simulée.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import {
  PaymentMethodNotFoundError,
  QuoteNotFoundError,
  QuoteScheduleExceedsTotalError,
  QuoteVersionLockedError,
  ScheduleItemNotPayableError,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  archivePaymentMethod,
  createQuote,
  getQuote,
  listPaymentMethods,
  listUnpaidPayments,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  removeEventQuotesData,
  removeQuoteLine,
  removeScheduleItem,
  reviseQuote,
  sendQuote,
  updateQuoteSettings,
  updateScheduleItem,
} from "./service";

const plannerId = randomUUID();
const NOW = new Date("2027-03-15T10:00:00Z");

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

// Organisation en franchise (TTC = HT, calculs lisibles) avec un événement
// et un devis de 3 000 € en brouillon.
async function setup() {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null }));
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
  });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: plannerId, now: NOW });
  const detail = await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 300000 });
  const [transfer] = await addPaymentMethods(organizationId, ["Virement bancaire", "Chèque"]);
  return { organizationId, eventId: event.id, quoteId: quote.id, lineId: detail.current.lines[0]!.id, transferId: transfer!.id };
}

describe("DEV-03 — Échéancier du devis", () => {
  it("chaque acompte a un montant ou un pourcentage et une date ; le solde est calculé automatiquement", async () => {
    const { organizationId, quoteId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Acompte à la signature", dueDate: "2027-04-01", percentageBasisPoints: 3000 });
    const detail = await addScheduleItem(organizationId, quoteId, { label: "Deuxième acompte", dueDate: "2027-06-01", amountCents: 100000 });

    expect(detail.current.schedule.items.map((item) => [item.label, item.amountCents, item.dueDate])).toEqual([
      ["Acompte à la signature", 90000, "2027-04-01"],
      ["Deuxième acompte", 100000, "2027-06-01"],
    ]);
    expect(detail.current.schedule).toMatchObject({ scheduledCents: 190000, balanceCents: 110000, exceedsTotal: false });
  });

  it("étant donné des acomptes dont la somme dépasse le total, alors l'app refuse", async () => {
    const { organizationId, quoteId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 200000 });
    await expect(
      addScheduleItem(organizationId, quoteId, { label: "Trop", dueDate: "2027-05-01", percentageBasisPoints: 5000 }),
    ).rejects.toBeInstanceOf(QuoteScheduleExceedsTotalError);
    const detail = await getQuote(organizationId, quoteId);
    expect(detail.current.schedule.items).toHaveLength(1);

    const itemId = detail.current.schedule.items[0]!.id;
    await expect(
      updateScheduleItem(organizationId, itemId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 300001 }),
    ).rejects.toBeInstanceOf(QuoteScheduleExceedsTotalError);
    expect((await getQuote(organizationId, quoteId)).current.schedule.items[0]?.amountCents).toBe(200000);
  });

  it("refuse un acompte sans montant ni pourcentage, ou avec les deux, ou à une date invalide", async () => {
    const { organizationId, quoteId } = await setup();
    await expect(addScheduleItem(organizationId, quoteId, { label: "Vide", dueDate: "2027-04-01" })).rejects.toBeInstanceOf(RangeError);
    await expect(
      addScheduleItem(organizationId, quoteId, { label: "Les deux", dueDate: "2027-04-01", amountCents: 1, percentageBasisPoints: 1 }),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      addScheduleItem(organizationId, quoteId, { label: "Date", dueDate: "2027-02-30", amountCents: 1 }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it("le solde se recalcule quand le total change ; un dépassement bloque l'envoi", async () => {
    const { organizationId, quoteId, lineId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 100000 });
    let detail = await addQuoteLine(organizationId, quoteId, { label: "Décoration", unit: "forfait", quantityMilli: 1000, unitPriceCents: 50000 });
    expect(detail.current.schedule.balanceCents).toBe(250000);

    detail = await removeQuoteLine(organizationId, lineId);
    detail = await removeQuoteLine(organizationId, detail.current.lines[0]!.id);
    await addQuoteLine(organizationId, quoteId, { label: "Petit forfait", unit: "forfait", quantityMilli: 1000, unitPriceCents: 50000 });
    detail = await getQuote(organizationId, quoteId);
    expect(detail.current.schedule).toMatchObject({ balanceCents: -50000, exceedsTotal: true });
    await expect(sendQuote({ organizationId, quoteId, now: NOW })).rejects.toBeInstanceOf(QuoteScheduleExceedsTotalError);
  });

  it("l'échéancier d'une version envoyée est figé ; la version suivante le reprend, paiements compris", async () => {
    const { organizationId, quoteId, transferId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-04-01", percentageBasisPoints: 3000 });
    const sent = await sendQuote({ organizationId, quoteId, now: NOW });
    const itemId = sent.current.schedule.items[0]!.id;
    await expect(
      addScheduleItem(organizationId, quoteId, { label: "Autre", dueDate: "2027-05-01", amountCents: 1 }),
    ).rejects.toBeInstanceOf(QuoteVersionLockedError);
    await expect(removeScheduleItem(organizationId, itemId)).rejects.toBeInstanceOf(QuoteVersionLockedError);

    await markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-14", paymentMethodId: transferId, now: NOW });
    const revised = await reviseQuote(organizationId, quoteId);
    expect(revised.current.schedule.items.map((item) => [item.label, item.amountCents, item.paidOn, item.paymentMethodLabel])).toEqual([
      ["Acompte", 90000, "2027-03-14", "Virement bancaire"],
    ]);
  });
});

describe("DEV-03 — Marquer une échéance payée", () => {
  it("quand elle marque une échéance payée, alors elle saisit la date et le mode de paiement", async () => {
    const { organizationId, quoteId, transferId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 90000 });
    const sent = await sendQuote({ organizationId, quoteId, now: NOW });
    const itemId = sent.current.schedule.items[0]!.id;

    const paid = await markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-14", paymentMethodId: transferId, now: NOW });
    expect(paid.current.schedule.items[0]).toMatchObject({ paidOn: "2027-03-14", paymentMethodLabel: "Virement bancaire", overdue: false });

    // Correction d'une saisie : l'échéance redevient à payer.
    const unpaid = await markScheduleItemUnpaid(organizationId, itemId);
    expect(unpaid.current.schedule.items[0]).toMatchObject({ paidOn: null, paymentMethodId: null });
  });

  it("refuse un mode inconnu ou archivé, une date future, et une échéance d'un devis non envoyé", async () => {
    const { organizationId, quoteId, transferId } = await setup();
    const draft = await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 90000 });
    const itemId = draft.current.schedule.items[0]!.id;
    await expect(
      markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-15", paymentMethodId: transferId, now: NOW }),
    ).rejects.toBeInstanceOf(ScheduleItemNotPayableError);

    await sendQuote({ organizationId, quoteId, now: NOW });
    await expect(
      markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-16", paymentMethodId: transferId, now: NOW }),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-15", paymentMethodId: randomUUID(), now: NOW }),
    ).rejects.toBeInstanceOf(PaymentMethodNotFoundError);
    await archivePaymentMethod(organizationId, transferId);
    await expect(
      markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-15", paymentMethodId: transferId, now: NOW }),
    ).rejects.toBeInstanceOf(PaymentMethodNotFoundError);
    expect((await listPaymentMethods(organizationId)).map((method) => method.label)).toEqual(["Chèque"]);
  });
});

describe("DEV-03 — Encaissements à venir", () => {
  it("quand elle ouvre « Encaissements », alors elle voit les échéances non payées triées par date, avec un total par mois", async () => {
    const { organizationId, quoteId, transferId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Solde", dueDate: "2027-07-10", amountCents: 100000 });
    await addScheduleItem(organizationId, quoteId, { label: "Acompte 2", dueDate: "2027-06-20", amountCents: 50000 });
    await addScheduleItem(organizationId, quoteId, { label: "Acompte 1", dueDate: "2027-06-01", amountCents: 40000 });
    await addScheduleItem(organizationId, quoteId, { label: "Payé", dueDate: "2027-05-01", amountCents: 10000 });
    const sent = await sendQuote({ organizationId, quoteId, now: NOW });
    const paidId = sent.current.schedule.items.find((item) => item.label === "Payé")!.id;
    await markScheduleItemPaid({ organizationId, scheduleItemId: paidId, paidOn: "2027-03-15", paymentMethodId: transferId, now: NOW });

    // Un brouillon n'est pas un encaissement attendu.
    const other = await createQuote({ organizationId, eventId: sent.eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, other.id, { label: "Autre", unit: "forfait", quantityMilli: 1000, unitPriceCents: 1000 });
    await addScheduleItem(organizationId, other.id, { label: "Brouillon", dueDate: "2027-06-02", amountCents: 1000 });

    const view = await listUnpaidPayments(organizationId, { now: NOW });
    expect(view.upcoming.map((payment) => [payment.label, payment.dueDate, payment.quoteNumber])).toEqual([
      ["Acompte 1", "2027-06-01", sent.number],
      ["Acompte 2", "2027-06-20", sent.number],
      ["Solde", "2027-07-10", sent.number],
    ]);
    expect(view.months).toEqual([
      { month: "2027-06", totalCents: 90000 },
      { month: "2027-07", totalCents: 100000 },
    ]);
    expect(view.overdue).toEqual([]);
  });

  it("étant donné une échéance dépassée et non payée, alors elle est en retard, en tête", async () => {
    const { organizationId, quoteId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-03-20", amountCents: 40000 });
    await addScheduleItem(organizationId, quoteId, { label: "Solde", dueDate: "2027-05-01", amountCents: 50000 });
    await sendQuote({ organizationId, quoteId, now: NOW });

    // Le jour même (20 mars, 23 h 59 à Paris) : pas encore en retard.
    let view = await listUnpaidPayments(organizationId, { now: new Date("2027-03-20T22:59:00Z") });
    expect(view.overdue).toEqual([]);
    // Le lendemain, 0 h à Paris : en retard.
    view = await listUnpaidPayments(organizationId, { now: new Date("2027-03-20T23:00:00Z") });
    expect(view.overdue.map((payment) => [payment.label, payment.overdue])).toEqual([["Acompte", true]]);
    expect(view.overdueTotalCents).toBe(40000);
    expect(view.upcoming.map((payment) => payment.label)).toEqual(["Solde"]);
    expect((await getQuote(organizationId, quoteId)).current.schedule.items.length).toBe(2);
  });

  it("l'horizon (90 jours par défaut, paramétrable) limite les échéances à venir, jamais les retards", async () => {
    const { organizationId, quoteId } = await setup();
    await addScheduleItem(organizationId, quoteId, { label: "En retard", dueDate: "2027-01-10", amountCents: 10000 });
    await addScheduleItem(organizationId, quoteId, { label: "Dans 90 jours", dueDate: "2027-06-13", amountCents: 10000 });
    await addScheduleItem(organizationId, quoteId, { label: "Dans 91 jours", dueDate: "2027-06-14", amountCents: 10000 });
    await sendQuote({ organizationId, quoteId, now: NOW });

    let view = await listUnpaidPayments(organizationId, { now: NOW, horizonDays: 90 });
    expect(view.overdue.map((payment) => payment.label)).toEqual(["En retard"]);
    expect(view.upcoming.map((payment) => payment.label)).toEqual(["Dans 90 jours"]);

    await updateQuoteSettings(organizationId, {
      validityDays: 30,
      quotePrefix: "D",
      invoicePrefix: "F",
      creditNotePrefix: "A",
      upcomingHorizonDays: 120,
      invoicePaymentTermDays: 30,
      invoiceMentions: null,
    });
    view = await listUnpaidPayments(organizationId, { now: NOW, horizonDays: 120 });
    expect(view.upcoming).toHaveLength(2);
    // Sans horizon (écran « Encaissements ») : toutes les échéances.
    expect((await listUnpaidPayments(organizationId, { now: NOW })).upcoming).toHaveLength(2);
  });

  it("aucune échéance d'un devis d'essai n'apparaît ; elles disparaissent avec l'essai", async () => {
    const { organizationId } = await setup();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    const demo = await createQuote({ organizationId, eventId: trial.eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, demo.id, { label: "Fictif", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000 });
    await addScheduleItem(organizationId, demo.id, { label: "Acompte fictif", dueDate: "2027-03-01", amountCents: 30000 });
    await sendQuote({ organizationId, quoteId: demo.id, now: NOW });

    const view = await listUnpaidPayments(organizationId, { now: NOW });
    expect([...view.overdue, ...view.upcoming].map((payment) => payment.label)).not.toContain("Acompte fictif");

    await removeEventQuotesData(organizationId, [trial.eventId]);
    await expect(getQuote(organizationId, demo.id)).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});

describe("DEV-03 — Isolation entre organisations", () => {
  it("une organisation ne voit ni ne paie les échéances d'une autre, ni n'utilise ses modes de paiement", async () => {
    const own = await setup();
    const other = await setup();
    await addScheduleItem(other.organizationId, other.quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 10000 });
    const sent = await sendQuote({ organizationId: other.organizationId, quoteId: other.quoteId, now: NOW });
    const otherItemId = sent.current.schedule.items[0]!.id;

    expect((await listUnpaidPayments(own.organizationId, { now: NOW })).upcoming).toEqual([]);
    await expect(
      markScheduleItemPaid({ organizationId: own.organizationId, scheduleItemId: otherItemId, paidOn: "2027-03-15", paymentMethodId: own.transferId, now: NOW }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(
      updateScheduleItem(own.organizationId, otherItemId, { label: "Falsifié", dueDate: "2027-04-01", amountCents: 1 }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);

    await addScheduleItem(own.organizationId, own.quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 10000 });
    const ownSent = await sendQuote({ organizationId: own.organizationId, quoteId: own.quoteId, now: NOW });
    await expect(
      markScheduleItemPaid({
        organizationId: own.organizationId,
        scheduleItemId: ownSent.current.schedule.items[0]!.id,
        paidOn: "2027-03-15",
        paymentMethodId: other.transferId,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(PaymentMethodNotFoundError);
    expect((await getQuote(other.organizationId, other.quoteId)).current.schedule.items[0]?.paidOn).toBeNull();
  });
});
