// Lot 27a (POR-05, SC-06 étape 5 ; décisions D5 et D6) — échéances vues par un
// lien et règlement déclaré par un client, contre un vrai PostgreSQL (RLS) :
// déclarer, annuler, confirmer, refuser ; jamais hors de ses catégories, de son
// événement ou de son organisation (tests d'abus, CLAUDE.md § 2.11).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { parisToday } from "@symbola/i18n";
import type { EventLinkRights } from "@symbola/contracts";
import { addDefaultVendorSlots, createEventLink, createProspect, createProspectSource, listEventVendorSlots, revokeEventLink } from "@/modules/events/service";
import {
  addVendorPayment,
  cancelLinkVendorPaymentDeclaration,
  confirmVendorPaymentDeclaration,
  declareLinkVendorPayment,
  getLinkBudgetView,
  LinkBudgetAccessDeniedError,
  listBudgetLines,
  listPendingPaymentDeclarations,
  refuseVendorPaymentDeclaration,
  setVendorPaymentPaid,
  updateBudgetLine,
  VendorPaymentDeclarationError,
} from "./service";

const plannerId = randomUUID();
const today = parisToday();

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

// Lieu et traiteur engagés, chacun avec une échéance ; un photographe sans.
async function wedding(organizationId: string) {
  await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur", "Photographe"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate: "2027-06-12" });
  const [venue, caterer, photographer] = await listEventVendorSlots(organizationId, event.id);
  for (const [slot, committed] of [[venue!, 980000], [caterer!, 960000], [photographer!, 280000]] as const) {
    await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: slot.id, field: "estimated", amountCents: committed, changedByUserId: plannerId });
    await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: slot.id, field: "committed", amountCents: committed, changedByUserId: plannerId });
  }
  const lines = (await listBudgetLines(organizationId, event.id)).lines;
  const lineOf = (slotId: string) => lines.find((line) => line.eventVendorSlotId === slotId)!.id;
  await addVendorPayment({ organizationId, eventId: event.id, lineId: lineOf(venue!.id), label: "Acompte", fixedAmountCents: 290000, dueOn: "2027-01-15", changedByUserId: plannerId });
  await addVendorPayment({ organizationId, eventId: event.id, lineId: lineOf(caterer!.id), label: "Acompte", percentageBasisPoints: 3000, dueOn: "2027-02-01", changedByUserId: plannerId });
  const payments = (await listBudgetLines(organizationId, event.id)).lines.flatMap((line) => line.payments.map((payment) => ({ ...payment, slotId: line.eventVendorSlotId })));
  return {
    eventId: event.id,
    venueId: venue!.id,
    catererId: caterer!.id,
    venuePaymentId: payments.find((payment) => payment.slotId === venue!.id)!.id,
    catererPaymentId: payments.find((payment) => payment.slotId === caterer!.id)!.id,
  };
}

async function link(organizationId: string, eventId: string, rights: EventLinkRights, personName = "Bernard Martin") {
  const delivery = await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName, email: `lien-${randomUUID()}@example.test`, rights } });
  return delivery.link.id;
}

const ALL: EventLinkRights = { rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [] };

describe("POR-05 — Budget simplifié et échéances à venir", () => {
  it("trois chiffres par poste et ses échéances, par date ; un payeur ne voit que celles de ses catégories", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const couple = await getLinkBudgetView(organizationId, await link(organizationId, w.eventId, ALL, "Léa Martin"));
    expect(couple.payments.map((payment) => [payment.slotLabel, payment.label, payment.amountCents, payment.dueOn, payment.status])).toEqual([
      ["Lieu", "Acompte", 290000, "2027-01-15", today > "2027-01-15" ? "overdue" : "due"],
      ["Traiteur", "Acompte", 288000, "2027-02-01", today > "2027-02-01" ? "overdue" : "due"],
    ]);
    expect(couple.categories.map((category) => [category.label, category.estimatedCents, category.committedCents, category.remainingCents])).toEqual([
      ["Lieu", 980000, 980000, 980000],
      ["Traiteur", 960000, 960000, 960000],
      ["Photographe", 280000, 280000, 280000],
    ]);
    const payer = await getLinkBudgetView(organizationId, await link(organizationId, w.eventId, { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [w.catererId] }));
    expect(payer.payments.map((payment) => payment.slotLabel)).toEqual(["Traiteur"]);
    expect(payer.categories.map((category) => category.label)).toEqual(["Traiteur"]);
  });

  it("une échéance payée reste visible trois mois, puis disparaît de la vue du client", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const linkId = await link(organizationId, w.eventId, ALL);
    await setVendorPaymentPaid({ organizationId, eventId: w.eventId, paymentId: w.venuePaymentId, paidOn: today, changedByUserId: plannerId });
    expect((await getLinkBudgetView(organizationId, linkId)).payments.find((payment) => payment.id === w.venuePaymentId)).toMatchObject({ status: "paid", paidOn: today });
    await setVendorPaymentPaid({ organizationId, eventId: w.eventId, paymentId: w.venuePaymentId, paidOn: "2020-01-01", changedByUserId: plannerId });
    expect((await getLinkBudgetView(organizationId, linkId)).payments.map((payment) => payment.id)).not.toContain(w.venuePaymentId);
  });
});

describe("SC-06 étape 5, D6 — Règlement déclaré par le client, confirmé par la planner", () => {
  it("le payeur déclare, la planner voit la déclaration et confirme : payée à la date déclarée, le payé suit", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const bernard = await link(organizationId, w.eventId, { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [w.catererId] });
    await declareLinkVendorPayment({ organizationId, linkId: bernard, paymentId: w.catererPaymentId, paidOn: today, method: "Virement bancaire" });

    expect((await getLinkBudgetView(organizationId, bernard)).payments[0]).toMatchObject({ status: "declared", declaredPaidOn: today, declaredMethod: "Virement bancaire", declaredByThisLink: true });
    const pending = await listPendingPaymentDeclarations(organizationId);
    expect(pending).toEqual([expect.objectContaining({ paymentId: w.catererPaymentId, eventId: w.eventId, amountCents: 288000, declaredByLinkId: bernard, declaredMethod: "Virement bancaire" })]);
    // Les montants payés ne bougent qu'à la confirmation.
    expect((await listBudgetLines(organizationId, w.eventId)).totalPaidCents).toBe(0);

    await confirmVendorPaymentDeclaration({ organizationId, eventId: w.eventId, paymentId: w.catererPaymentId, changedByUserId: plannerId });
    const view = await listBudgetLines(organizationId, w.eventId);
    expect(view.totalPaidCents).toBe(288000);
    expect(view.lines.flatMap((line) => line.payments).find((payment) => payment.id === w.catererPaymentId)).toMatchObject({ status: "paid", paidOn: today, declaration: { linkId: bernard, method: "Virement bancaire" } });
    expect(await listPendingPaymentDeclarations(organizationId)).toEqual([]);
    expect((await getLinkBudgetView(organizationId, bernard)).payments[0]).toMatchObject({ status: "paid", declaredByThisLink: false });
  });

  it("refus avec motif : l'échéance redevient à régler, le motif est montré au client, qui peut déclarer de nouveau", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const linkId = await link(organizationId, w.eventId, ALL);
    await declareLinkVendorPayment({ organizationId, linkId, paymentId: w.venuePaymentId, paidOn: today, method: "Chèque" });
    await expect(refuseVendorPaymentDeclaration({ organizationId, eventId: w.eventId, paymentId: w.venuePaymentId, reason: "  " })).rejects.toMatchObject({ reason: "reason" });
    await refuseVendorPaymentDeclaration({ organizationId, eventId: w.eventId, paymentId: w.venuePaymentId, reason: "Chèque non reçu par le domaine" });
    expect((await getLinkBudgetView(organizationId, linkId)).payments[0]).toMatchObject({ status: expect.stringMatching(/due|overdue/), refusalReason: "Chèque non reçu par le domaine", declaredPaidOn: null });
    await declareLinkVendorPayment({ organizationId, linkId, paymentId: w.venuePaymentId, paidOn: today, method: "Virement bancaire" });
    expect((await getLinkBudgetView(organizationId, linkId)).payments[0]).toMatchObject({ status: "declared", refusalReason: null });
  });

  it("seul le déclarant annule, et seulement avant la confirmation", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const lea = await link(organizationId, w.eventId, ALL, "Léa Martin");
    const maxime = await link(organizationId, w.eventId, ALL, "Maxime Dubois");
    await declareLinkVendorPayment({ organizationId, linkId: lea, paymentId: w.venuePaymentId, paidOn: today, method: "Carte bancaire" });
    expect((await getLinkBudgetView(organizationId, maxime)).payments[0]).toMatchObject({ status: "declared", declaredByThisLink: false });
    await expect(cancelLinkVendorPaymentDeclaration({ organizationId, linkId: maxime, paymentId: w.venuePaymentId })).rejects.toMatchObject({ reason: "not_declared" });
    await cancelLinkVendorPaymentDeclaration({ organizationId, linkId: lea, paymentId: w.venuePaymentId });
    expect((await getLinkBudgetView(organizationId, lea)).payments[0]!.status).not.toBe("declared");
  });

  it("refusé : date future, moyen vide, deux fois, échéance payée", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const linkId = await link(organizationId, w.eventId, ALL);
    const declare = (paidOn: string, method = "Virement bancaire", paymentId = w.venuePaymentId) => declareLinkVendorPayment({ organizationId, linkId, paymentId, paidOn, method });
    await expect(declare("2999-01-01")).rejects.toMatchObject({ reason: "date" });
    await expect(declare("pas une date")).rejects.toMatchObject({ reason: "date" });
    await expect(declare(today, "   ")).rejects.toMatchObject({ reason: "method" });
    await declare(today);
    await expect(declare(today)).rejects.toMatchObject({ reason: "declared" });
    await setVendorPaymentPaid({ organizationId, eventId: w.eventId, paymentId: w.catererPaymentId, paidOn: today, changedByUserId: plannerId });
    await expect(declare(today, "Virement bancaire", w.catererPaymentId)).rejects.toBeInstanceOf(VendorPaymentDeclarationError);
  });

  it("abus : hors de ses catégories, sans la rubrique, lien retiré, autre événement, autre organisation : refus comme une échéance inexistante", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const other = await wedding(organizationId);
    const payer = await link(organizationId, w.eventId, { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [w.catererId] });
    const noBudget = await link(organizationId, w.eventId, { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] });
    const revoked = await link(organizationId, w.eventId, ALL);
    await revokeEventLink(organizationId, revoked);
    const declare = (linkId: string, paymentId: string, org = organizationId) => declareLinkVendorPayment({ organizationId: org, linkId, paymentId, paidOn: today, method: "Virement bancaire" });
    await expect(declare(payer, w.venuePaymentId)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    await expect(declare(payer, other.catererPaymentId)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    await expect(declare(noBudget, w.catererPaymentId)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    await expect(declare(revoked, w.catererPaymentId)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    await expect(declare(payer, w.catererPaymentId, await organization())).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    expect(await listPendingPaymentDeclarations(organizationId)).toEqual([]);
  });

  it("journal : déclaration (le lien pour auteur), refus, confirmation ; sans montant ni moyen", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const linkId = await link(organizationId, w.eventId, ALL);
    await declareLinkVendorPayment({ organizationId, linkId, paymentId: w.venuePaymentId, paidOn: today, method: "Virement bancaire" });
    await refuseVendorPaymentDeclaration({ organizationId, eventId: w.eventId, paymentId: w.venuePaymentId, reason: "Non reçu" });
    await declareLinkVendorPayment({ organizationId, linkId, paymentId: w.venuePaymentId, paidOn: today, method: "Virement bancaire" });
    await confirmVendorPaymentDeclaration({ organizationId, eventId: w.eventId, paymentId: w.venuePaymentId, changedByUserId: plannerId });
    const journal = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationId)).orderBy(auditEntries.occurredAt)));
    const entries = journal.filter((entry) => entry.action.startsWith("budget.vendor_payment."));
    expect(entries.map((entry) => entry.action)).toEqual([
      "budget.vendor_payment.declared",
      "budget.vendor_payment.declaration_refused",
      "budget.vendor_payment.declared",
      "budget.vendor_payment.declaration_confirmed",
    ]);
    expect(entries[0]).toMatchObject({ actorKind: "link", actorId: linkId });
    expect(JSON.stringify(entries)).not.toContain("Virement");
  });
});
