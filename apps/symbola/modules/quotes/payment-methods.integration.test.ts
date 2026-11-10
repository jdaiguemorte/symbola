// Lot 21 (DEV-13) — modes de paiement à activer ou désactiver, contre un vrai
// PostgreSQL (RLS), par la porte d'entrée du module ; horloge simulée.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import {
  PaymentMethodNotFoundError,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  archivePaymentMethod,
  createQuote,
  listPaymentMethods,
  markScheduleItemPaid,
  restorePaymentMethod,
  sendQuote,
} from "./service";

const plannerId = randomUUID();
const NOW = new Date("2027-03-15T10:00:00Z");

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization(): Promise<string> {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null }));
  return organizationId;
}

// Un devis envoyé avec un acompte à encaisser.
async function sentQuoteWithDeposit(organizationId: string): Promise<string> {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }] });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: plannerId, now: NOW });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 300000 });
  await addScheduleItem(organizationId, quote.id, { label: "Acompte", dueDate: "2027-04-01", amountCents: 90000 });
  const sent = await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
  return sent.current.schedule.items[0]!.id;
}

describe("DEV-13 — Modes de paiement à activer ou désactiver", () => {
  it("quand elle désactive « Chèque », alors il n'est plus proposé à l'encaissement mais reste dans ses réglages ; réactivé, il sert de nouveau", async () => {
    const organizationId = await organization();
    const [, cheque] = await addPaymentMethods(organizationId, ["Virement bancaire", "Chèque"]);
    const itemId = await sentQuoteWithDeposit(organizationId);

    await archivePaymentMethod(organizationId, cheque!.id);
    expect((await listPaymentMethods(organizationId)).map((method) => method.label)).toEqual(["Virement bancaire"]);
    expect((await listPaymentMethods(organizationId, { includeArchived: true })).map((method) => [method.label, method.archived])).toEqual([
      ["Virement bancaire", false],
      ["Chèque", true],
    ]);
    await expect(markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-15", paymentMethodId: cheque!.id, now: NOW })).rejects.toBeInstanceOf(
      PaymentMethodNotFoundError,
    );

    await restorePaymentMethod(organizationId, cheque!.id);
    expect((await listPaymentMethods(organizationId)).map((method) => method.label)).toEqual(["Virement bancaire", "Chèque"]);
    const paid = await markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: "2027-03-15", paymentMethodId: cheque!.id, now: NOW });
    expect(paid.current.schedule.items[0]).toMatchObject({ paymentMethodLabel: "Chèque" });
  });

  it("quand elle ajoute un mode du même nom qu'un mode désactivé, alors ce mode est réactivé, sans doublon", async () => {
    const organizationId = await organization();
    const [cheque] = await addPaymentMethods(organizationId, ["Chèque"]);
    await archivePaymentMethod(organizationId, cheque!.id);

    const added = await addPaymentMethods(organizationId, ["chèque"]);
    expect(added.map((method) => [method.id, method.archived])).toEqual([[cheque!.id, false]]);
    expect(await listPaymentMethods(organizationId, { includeArchived: true })).toHaveLength(1);
  });

  it("isolation : une organisation ne réactive ni ne désactive les modes d'une autre", async () => {
    const organizationA = await organization();
    const organizationB = await organization();
    const [transfer] = await addPaymentMethods(organizationA, ["Virement bancaire"]);

    await archivePaymentMethod(organizationB, transfer!.id);
    expect((await listPaymentMethods(organizationA)).map((method) => method.label)).toEqual(["Virement bancaire"]);
    await archivePaymentMethod(organizationA, transfer!.id);
    await restorePaymentMethod(organizationB, transfer!.id);
    expect(await listPaymentMethods(organizationA)).toEqual([]);
    expect(await listPaymentMethods(organizationB, { includeArchived: true })).toEqual([]);
  });
});
