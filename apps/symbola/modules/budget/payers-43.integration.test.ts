// Lot 43 (BUD-06, BUD-11 ; D8, D9 ; ADR 0089) — payeurs, parts, ce que voit chaque payeur et calendrier
// des sorties d'argent, contre un vrai PostgreSQL (RLS), par la porte d'entrée du module : totaux au
// centime, un payeur « part seule » ne voit ni le total ni la part d'un autre (contrôle serveur), seul un
// des mariés décide ; abus d'un autre évènement, d'une autre organisation, d'un payeur.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import type { EventLinkRights } from "@symbola/contracts";
import { addDefaultVendorSlots, createEventLink, createProspect, createProspectSource, getEvent, listEventVendorSlots } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { addQuoteLine, addScheduleItem, createQuote, getSettlement, QuoteNotFoundError, sendQuote } from "@/modules/quotes/service";
import {
  addEventPayer,
  addVendorPayment,
  EventPayerInvalidError,
  EventPayerNotFoundError,
  getCashCalendar,
  getInstalmentPayerLinkId,
  getLinkBudgetView,
  getLinkCashCalendar,
  getLinkPayerShare,
  getPayerShares,
  LinkBudgetAccessDeniedError,
  listBudgetLines,
  listEventPayers,
  listLinkPayers,
  removeEventPayer,
  setInstalmentPayer,
  setLinePayerShares,
  setLinkPayerVisibility,
  setPayerVisibility,
  setVendorPaymentPayer,
  updateBudgetLine,
} from "./service";

const plannerId = randomUUID();

async function eventWithBudget() {
  const organizationId = (await createOrganization(appDatabase(), `Org ${randomUUID()}`)).id;
  await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur", "Photographe"]);
  const source = await createProspectSource(organizationId, "Salon");
  const created = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
  const [venue, caterer, photographer] = await listEventVendorSlots(organizationId, created.id);
  const line = (slotId: string, amountCents: number) => updateBudgetLine({ organizationId, eventId: created.id, eventVendorSlotId: slotId, field: "committed", amountCents, changedByUserId: plannerId });
  await line(venue!.id, 650000);
  await line(caterer!.id, 960001);
  await line(photographer!.id, 250000);
  const lines = (await listBudgetLines(organizationId, created.id)).lines;
  const lineOf = (slotId: string) => lines.find((candidate) => candidate.eventVendorSlotId === slotId)!.id;
  const event = (await getEvent(organizationId, created.id))!;
  return { organizationId, eventId: created.id, slots: { venue: venue!.id, caterer: caterer!.id, photographer: photographer!.id }, lines: { venue: lineOf(venue!.id), caterer: lineOf(caterer!.id), photographer: lineOf(photographer!.id) }, clients: event.clients };
}

async function link(organizationId: string, eventId: string, rights: EventLinkRights, eventClientId: string | null = null) {
  const delivery = await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Bernard Martin", email: `lien-${randomUUID()}@example.test`, eventClientId, rights } });
  return delivery.link.id;
}

const ALL: EventLinkRights = { rubrics: ["budget", "quotes"], budgetScope: "all", sharedSlotIds: [] };

describe("BUD-06 — Répartition par payeur : mariés, familles, entreprise (lot 43, D8)", () => {
  it("les mariés existent d'office (100 % par défaut) ; la moitié du traiteur à la famille de Léa, 1 500 € du lieu à l'entreprise ; totaux exacts au centime", async () => {
    const setup = await eventWithBudget();
    const payers = await listEventPayers(setup.organizationId, setup.eventId);
    expect(payers).toEqual([expect.objectContaining({ kind: "couple", name: "Léa & Maxime", ownShareOnly: false })]);
    const couple = payers[0]!;
    const family = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Famille Martin", kind: "family_one", linkId: null });
    const company = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Société Durand", kind: "company", linkId: null });
    expect(family.ownShareOnly).toBe(true);
    await setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: setup.lines.caterer, shares: [{ payerId: family.id, percentageBasisPoints: 5000, amountCents: null }] });
    await setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: setup.lines.venue, shares: [{ payerId: company.id, percentageBasisPoints: null, amountCents: 150000 }] });
    const shares = await getPayerShares(setup.organizationId, setup.eventId);
    const total = (payerId: string) => shares.byPayer.find((entry) => entry.payerId === payerId)!.totalCents;
    expect(total(family.id)).toBe(480001);
    expect(total(company.id)).toBe(150000);
    expect(total(couple.id)).toBe(500000 + 480000 + 250000);
    expect(total(family.id) + total(company.id) + total(couple.id)).toBe(650000 + 960001 + 250000);
  });

  it("les parts invalides sont refusées : plus de 100 %, un payeur deux fois, un payeur d'un autre évènement ; les mariés ne se suppriment pas", async () => {
    const setup = await eventWithBudget();
    const other = await eventWithBudget();
    const [couple] = await listEventPayers(setup.organizationId, setup.eventId);
    const family = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Famille Martin", kind: "family_one", linkId: null });
    const strangers = await addEventPayer(other.organizationId, { eventId: other.eventId, name: "Famille Autre", kind: "family_two", linkId: null });
    const shares = (percent: number) => [{ payerId: family.id, percentageBasisPoints: percent, amountCents: null }];
    await expect(setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: setup.lines.caterer, shares: shares(10001) })).rejects.toBeInstanceOf(EventPayerInvalidError);
    await expect(setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: setup.lines.caterer, shares: [...shares(1000), ...shares(1000)] })).rejects.toMatchObject({ reason: "shares_duplicate" });
    await expect(setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: setup.lines.caterer, shares: [{ payerId: strangers.id, percentageBasisPoints: 1000, amountCents: null }] })).rejects.toBeInstanceOf(EventPayerNotFoundError);
    await expect(setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: other.lines.caterer, shares: shares(1000) })).rejects.toMatchObject({ reason: "line" });
    await expect(removeEventPayer(setup.organizationId, setup.eventId, couple!.id)).rejects.toMatchObject({ reason: "couple" });
    await expect(addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Intrus", kind: "family_one", linkId: await link(other.organizationId, other.eventId, ALL) })).rejects.toMatchObject({ reason: "link" });
    await expect(setPayerVisibility(other.organizationId, { eventId: other.eventId, payerId: family.id, ownShareOnly: false })).rejects.toBeInstanceOf(EventPayerNotFoundError);
  });

  it("un payeur « part seule » ne voit ni catégorie, ni total, ni la part d'un autre ; le client décide de lui montrer tout le budget", async () => {
    const setup = await eventWithBudget();
    const familyLink = await link(setup.organizationId, setup.eventId, ALL);
    const leaLink = await link(setup.organizationId, setup.eventId, ALL, setup.clients[0]!.id);
    const family = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Famille Martin", kind: "family_one", linkId: familyLink });
    const company = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Société Durand", kind: "company", linkId: null });
    await setLinePayerShares(setup.organizationId, { eventId: setup.eventId, lineId: setup.lines.caterer, shares: [{ payerId: family.id, percentageBasisPoints: 5000, amountCents: null }, { payerId: company.id, percentageBasisPoints: 2000, amountCents: null }] });
    const lines = await listBudgetLines(setup.organizationId, setup.eventId);
    await addVendorPayment({ organizationId: setup.organizationId, eventId: setup.eventId, lineId: setup.lines.caterer, label: "Acompte traiteur", fixedAmountCents: 288000, dueOn: "2027-01-05", changedByUserId: plannerId });
    await addVendorPayment({ organizationId: setup.organizationId, eventId: setup.eventId, lineId: setup.lines.venue, label: "Solde du lieu", fixedAmountCents: 300000, dueOn: "2027-05-30", changedByUserId: plannerId });
    const payments = (await listBudgetLines(setup.organizationId, setup.eventId)).lines.flatMap((line) => line.payments);
    await setVendorPaymentPayer(setup.organizationId, { eventId: setup.eventId, paymentId: payments.find((payment) => payment.label === "Acompte traiteur")!.id, payerId: family.id });
    expect(lines.lines).toHaveLength(3);

    const view = await getLinkBudgetView(setup.organizationId, familyLink);
    expect(view).toMatchObject({ scope: "share", categories: [], lines: [], totalCommittedCents: 0, envelope: null });
    expect(view.payments.map((payment) => payment.label)).toEqual(["Acompte traiteur"]);
    const serialized = JSON.stringify(view);
    for (const forbidden of ["Société Durand", "Solde du lieu", "650000", "960001", "Photographe"]) expect(serialized).not.toContain(forbidden);
    const own = await getLinkPayerShare(setup.organizationId, familyLink);
    expect(own!.share).toMatchObject({ totalCents: 480001, lines: [expect.objectContaining({ slotLabel: "Traiteur", amountCents: 480001 })] });
    expect(JSON.stringify(own)).not.toContain(company.id);
    expect((await getLinkCashCalendar(setup.organizationId, familyLink)).flatMap((month) => month.entries.map((entry) => entry.label))).toEqual(["Acompte traiteur"]);

    // Abus : le payeur ne peut ni lister les payeurs ni changer ce qu'il voit ; seul un des mariés le décide.
    await expect(listLinkPayers(setup.organizationId, familyLink)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    await expect(setLinkPayerVisibility(setup.organizationId, { linkId: familyLink, payerId: family.id, ownShareOnly: false })).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    expect((await listLinkPayers(setup.organizationId, leaLink)).map((payer) => payer.name)).toEqual(["Léa & Maxime", "Famille Martin", "Société Durand"]);
    await setLinkPayerVisibility(setup.organizationId, { linkId: leaLink, payerId: family.id, ownShareOnly: false });
    const everything = await getLinkBudgetView(setup.organizationId, familyLink);
    expect(everything.scope).toBe("all");
    expect(everything.categories.map((category) => category.label)).toEqual(["Lieu", "Traiteur", "Photographe"]);
    // Un des mariés d'un autre évènement ne règle rien ici.
    const other = await eventWithBudget();
    const strangerLink = await link(other.organizationId, other.eventId, ALL, other.clients[0]!.id);
    await expect(setLinkPayerVisibility(other.organizationId, { linkId: strangerLink, payerId: family.id, ownShareOnly: true })).rejects.toBeInstanceOf(EventPayerNotFoundError);
    await expect(setLinkPayerVisibility(setup.organizationId, { linkId: strangerLink, payerId: family.id, ownShareOnly: true })).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
  });
});

describe("BUD-11 — Calendrier des sorties d'argent, mois par mois (lot 43, D9)", () => {
  it("échéances des prestataires mois par mois, avec leur payeur ; filtré par payeur ; « catégories choisies » ne voit que les siennes", async () => {
    const setup = await eventWithBudget();
    const family = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Famille Martin", kind: "family_one", linkId: null });
    await addVendorPayment({ organizationId: setup.organizationId, eventId: setup.eventId, lineId: setup.lines.caterer, label: "Acompte traiteur", fixedAmountCents: 288000, dueOn: "2027-01-05", changedByUserId: plannerId });
    await addVendorPayment({ organizationId: setup.organizationId, eventId: setup.eventId, lineId: setup.lines.venue, label: "Solde du lieu", fixedAmountCents: 300000, dueOn: "2027-05-30", changedByUserId: plannerId });
    await addVendorPayment({ organizationId: setup.organizationId, eventId: setup.eventId, lineId: setup.lines.photographer, label: "Acompte photo", percentageBasisPoints: 3000, dueOn: "2027-01-20", changedByUserId: plannerId });
    const payments = (await listBudgetLines(setup.organizationId, setup.eventId)).lines.flatMap((line) => line.payments);
    await setVendorPaymentPayer(setup.organizationId, { eventId: setup.eventId, paymentId: payments.find((payment) => payment.label === "Acompte traiteur")!.id, payerId: family.id });
    const calendar = await getCashCalendar(setup.organizationId, setup.eventId);
    expect(calendar.map((month) => [month.month, month.entries.map((entry) => [entry.label, entry.payerName, entry.amountCents])])).toEqual([
      ["2027-01", [["Acompte traiteur", "Famille Martin", 288000], ["Acompte photo", "Léa & Maxime", 75000]]],
      ["2027-05", [["Solde du lieu", "Léa & Maxime", 300000]]],
    ]);
    expect(calendar[0]!.totalCents).toBe(363000);
    expect((await getCashCalendar(setup.organizationId, setup.eventId, { payerId: family.id })).flatMap((month) => month.entries.map((entry) => entry.label))).toEqual(["Acompte traiteur"]);
    const selected = await link(setup.organizationId, setup.eventId, { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [setup.slots.venue] });
    expect((await getLinkCashCalendar(setup.organizationId, selected)).flatMap((month) => month.entries.map((entry) => entry.label))).toEqual(["Solde du lieu"]);
    // Abus : un lien sans la rubrique Budget, ou d'une autre organisation.
    const noBudget = await link(setup.organizationId, setup.eventId, { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] });
    await expect(getLinkCashCalendar(setup.organizationId, noBudget)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    const other = await eventWithBudget();
    await expect(getLinkCashCalendar(other.organizationId, selected)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    // Une échéance de la planner inconnue de l'évènement ne reçoit pas de payeur.
    await expect(setInstalmentPayer(setup.organizationId, { eventId: setup.eventId, scheduleItemId: randomUUID(), payerId: family.id })).rejects.toMatchObject({ reason: "instalment" });
    expect(await getInstalmentPayerLinkId(setup.organizationId, setup.eventId, randomUUID())).toBeNull();
  });
});

describe("BUD-06 / BUD-11 — Échéance de la planner : payeur désigné, calendrier, seul le payeur désigné règle", () => {
  it("l'acompte désigné à la famille apparaît à son nom dans le calendrier ; le lien de Léa ne peut pas le déclarer", async () => {
    const setup = await eventWithBudget();
    await saveOnboardingStep(appDatabase(), setup.organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    await fillRequiredMentions(setup.organizationId);
    const quote = await createQuote({ organizationId: setup.organizationId, eventId: setup.eventId, createdByUserId: plannerId });
    await addQuoteLine(setup.organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 540000 });
    await addScheduleItem(setup.organizationId, quote.id, { label: "Acompte", percentageBasisPoints: 3000, dueDate: "2027-02-10" });
    const sent = await sendQuote({ organizationId: setup.organizationId, quoteId: quote.id });
    const item = sent.current.schedule.items[0]!;
    const familyLink = await link(setup.organizationId, setup.eventId, ALL);
    const leaLink = await link(setup.organizationId, setup.eventId, ALL, setup.clients[0]!.id);
    const family = await addEventPayer(setup.organizationId, { eventId: setup.eventId, name: "Famille Martin", kind: "family_one", linkId: familyLink });
    await setInstalmentPayer(setup.organizationId, { eventId: setup.eventId, scheduleItemId: item.id, payerId: family.id });
    expect(await getInstalmentPayerLinkId(setup.organizationId, setup.eventId, item.id)).toBe(familyLink);
    const calendar = await getCashCalendar(setup.organizationId, setup.eventId);
    expect(calendar.flatMap((month) => month.entries).find((entry) => entry.source === "planner")).toMatchObject({ label: `Acompte · ${sent.number}`, payerName: "Famille Martin", amountCents: 162000, status: "upcoming", settleScheduleItemId: item.id });
    const asLea = await getSettlement(setup.organizationId, { eventId: setup.eventId, linkId: leaLink, scheduleItemId: item.id, designatedLinkId: familyLink, locale: "fr" });
    expect(asLea.canDeclare).toBe(false);
    // Une autre organisation ne voit pas l'échéance.
    const other = await eventWithBudget();
    await expect(getSettlement(other.organizationId, { eventId: setup.eventId, linkId: leaLink, scheduleItemId: item.id, designatedLinkId: null, locale: "fr" })).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});
