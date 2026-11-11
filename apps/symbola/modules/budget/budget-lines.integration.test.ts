// PRD-BUD-02, puis lot 28a (BUD-01, BUD-02) — budget à cinq montants (estimé,
// devisé, engagé, payé, reste à payer), enveloppe et seuil d'alerte, contre un
// vrai PostgreSQL (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import {
  addDefaultVendorSlots,
  addEventVendorSlot,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
  removeEventVendorSlot,
  setEventWantedBudget,
} from "@/modules/events/service";
import {
  AlertThresholdInvalidError,
  BudgetSimulationMismatchError,
  EventBudgetNotFoundError,
  EventNotFoundError,
  EventVendorSlotNotFoundError,
  applyVendorSlotBookedToBudget,
  confirmEventBudget,
  createAllocationModel,
  getBudgetAlertSettings,
  listBudgetLineHistory,
  listBudgetLines,
  previewEngagement,
  setEventAlertThreshold,
  setOrganizationAlertThreshold,
  simulateEventBudget,
  updateBudgetLine,
} from "./service";

const { sql } = createAppConnection();
const plannerId = randomUUID();

afterAll(async () => {
  await sql.end();
});

async function createEvent(organizationId: string) {
  const source = await createProspectSource(organizationId, "Instagram");
  return createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Camille", lastName: null }],
  });
}

async function createEventWithSimulation(organizationId: string) {
  const [lieu, traiteur] = await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
  const event = await createEvent(organizationId);
  const model = await createAllocationModel({
    organizationId,
    name: "Classique",
    items: [
      { defaultVendorSlotId: lieu!.id, percentageBasisPoints: 6000 },
      { defaultVendorSlotId: traiteur!.id, percentageBasisPoints: 4000 },
    ],
  });
  await simulateEventBudget({
    organizationId,
    eventId: event.id,
    totalAmountCents: 1000000,
    guestCount: 40,
    allocationModelId: model.id,
  });
  return event;
}

describe("PRD-BUD-02 — Confirmer la simulation en budget estimé", () => {
  it("rapproche par label et crée les lignes, montant estimé", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);

    const view = await confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId });

    expect(view.lines).toHaveLength(2);
    expect(view.totalEstimatedCents).toBe(1000000);
    expect(view.totalCommittedCents).toBe(0);
    expect(view.totalVarianceCents).toBe(0);
    const lieuLine = view.lines.find((line) => line.label === "Lieu");
    expect(lieuLine).toMatchObject({ estimatedAmountCents: 600000, committedAmountCents: null, varianceCents: null });
  });

  it("refuse si l'événement n'existe pas", async () => {
    const organizationId = randomUUID();
    await expect(
      confirmEventBudget({ organizationId, eventId: randomUUID(), confirmedByUserId: plannerId }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("refuse si aucune simulation n'existe encore", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId);
    await expect(
      confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId }),
    ).rejects.toBeInstanceOf(EventBudgetNotFoundError);
  });

  it("refuse si un poste de la simulation n'a plus de correspondance sur l'événement (renommé)", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);

    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const lieuSlot = eventSlots.find((slot) => slot.label === "Lieu")!;
    await removeEventVendorSlot(organizationId, lieuSlot.id);
    await addEventVendorSlot(organizationId, event.id, "Lieu (renommé)");

    await expect(
      confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId }),
    ).rejects.toBeInstanceOf(BudgetSimulationMismatchError);
  });
});

describe("PRD-BUD-02 — Estimé, engagé, écart", () => {
  it("modifie l'engagé à la main et calcule l'écart", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);
    await confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId });

    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const lieuSlot = eventSlots.find((slot) => slot.label === "Lieu")!;

    const view = await updateBudgetLine({
      organizationId,
      eventId: event.id,
      eventVendorSlotId: lieuSlot.id,
      field: "committed",
      amountCents: 650000,
      changedByUserId: plannerId,
    });

    const lieuLine = view.lines.find((line) => line.eventVendorSlotId === lieuSlot.id)!;
    expect(lieuLine.committedAmountCents).toBe(650000);
    expect(lieuLine.varianceCents).toBe(50000);
    expect(lieuLine.variancePercent).toBeCloseTo(8.33, 1);
  });

  it("refuse de modifier un poste qui n'existe pas sur l'événement", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId);
    await expect(
      updateBudgetLine({
        organizationId,
        eventId: event.id,
        eventVendorSlotId: randomUUID(),
        field: "committed",
        amountCents: 1000,
        changedByUserId: plannerId,
      }),
    ).rejects.toBeInstanceOf(EventVendorSlotNotFoundError);
  });

  it("une ligne peut être créée directement sans simulation préalable", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu"]);
    const event = await createEvent(organizationId);
    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const lieuSlot = eventSlots.find((slot) => slot.label === "Lieu")!;

    const view = await updateBudgetLine({
      organizationId,
      eventId: event.id,
      eventVendorSlotId: lieuSlot.id,
      field: "estimated",
      amountCents: 500000,
      changedByUserId: plannerId,
    });

    expect(view.lines).toMatchObject([{ eventVendorSlotId: lieuSlot.id, estimatedAmountCents: 500000 }]);
  });

  it("historise chaque modification (ancienne valeur, nouvelle valeur, auteur, date)", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);
    await confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId });

    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const lieuSlot = eventSlots.find((slot) => slot.label === "Lieu")!;

    await updateBudgetLine({
      organizationId,
      eventId: event.id,
      eventVendorSlotId: lieuSlot.id,
      field: "committed",
      amountCents: 650000,
      changedByUserId: plannerId,
    });
    await updateBudgetLine({
      organizationId,
      eventId: event.id,
      eventVendorSlotId: lieuSlot.id,
      field: "committed",
      amountCents: 700000,
      changedByUserId: plannerId,
    });

    const history = await listBudgetLineHistory(organizationId, lieuSlot.id);
    const actualEntries = history.filter((entry) => entry.field === "committed");
    expect(actualEntries).toHaveLength(2);
    expect(actualEntries[0]).toMatchObject({ oldValueCents: null, newValueCents: 650000, changedByUserId: plannerId });
    expect(actualEntries[1]).toMatchObject({ oldValueCents: 650000, newValueCents: 700000, changedByUserId: plannerId });
    expect(typeof actualEntries[0]!.changedAt).toBe("string");
  });

  it("applique automatiquement l'engagé (et le devisé encore vide) quand events.vendor_slot.booked survient", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);
    await confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId });

    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const traiteurSlot = eventSlots.find((slot) => slot.label === "Traiteur")!;
    const bookedByUserId = randomUUID();

    await applyVendorSlotBookedToBudget(organizationId, {
      eventId: event.id,
      vendorSlotId: traiteurSlot.id,
      label: "Traiteur",
      amountCents: 390000,
      currency: "EUR",
      bookedByUserId,
    });

    const view = await listBudgetLines(organizationId, event.id);
    const traiteurLine = view.lines.find((line) => line.eventVendorSlotId === traiteurSlot.id)!;
    expect(traiteurLine.committedAmountCents).toBe(390000);
    expect(traiteurLine.quotedAmountCents).toBe(390000);

    const history = await listBudgetLineHistory(organizationId, traiteurSlot.id);
    expect(history.at(-1)).toMatchObject({ newValueCents: 390000, changedByUserId: bookedByUserId });
  });

  it("lot 12 (L12-EVT-17) — une retenue crée la ligne du budget : engagé connu, estimé encore vide, pas d'écart", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu"]);
    const event = await createEvent(organizationId);
    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const lieuSlot = eventSlots.find((slot) => slot.label === "Lieu")!;

    await expect(
      applyVendorSlotBookedToBudget(organizationId, {
        eventId: event.id,
        vendorSlotId: lieuSlot.id,
        label: "Lieu",
        amountCents: 100000,
        currency: "EUR",
        bookedByUserId: randomUUID(),
      }),
    ).resolves.not.toThrow();

    expect(await listBudgetLines(organizationId, event.id)).toMatchObject({
      lines: [{ eventVendorSlotId: lieuSlot.id, estimatedAmountCents: null, committedAmountCents: 100000, varianceCents: null }],
      totalEstimatedCents: 0,
      totalCommittedCents: 100000,
    });
  });
});

describe("BUD-01 — Cinq montants par ligne (lot 28a, décision D2)", () => {
  async function lineOf(organizationId: string) {
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleuriste"]);
    const event = await createEvent(organizationId);
    const [traiteur, fleuriste] = await listEventVendorSlots(organizationId, event.id);
    const set = (eventVendorSlotId: string, field: "estimated" | "quoted" | "committed" | "paid", amountCents: number) =>
      updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId, field, amountCents, changedByUserId: plannerId });
    return { eventId: event.id, traiteur: traiteur!, fleuriste: fleuriste!, set };
  }

  it("estimé, devisé, engagé, payé se saisissent séparément ; le reste à payer est calculé, jamais saisi", async () => {
    const organizationId = randomUUID();
    const { eventId, traiteur, set } = await lineOf(organizationId);
    await set(traiteur.id, "estimated", 450000);
    await set(traiteur.id, "quoted", 448000);
    await set(traiteur.id, "committed", 448000);
    const view = await set(traiteur.id, "paid", 134400);

    expect(view.lines.find((line) => line.eventVendorSlotId === traiteur.id)).toMatchObject({
      estimatedAmountCents: 450000,
      quotedAmountCents: 448000,
      committedAmountCents: 448000,
      paidAmountCents: 134400,
      remainingAmountCents: 313600,
      varianceCents: -2000,
    });
    expect((await listBudgetLines(organizationId, eventId)).lines[0]?.remainingAmountCents).toBe(313600);
  });

  it("les totaux des cinq montants sont recalculés à chaque saisie, au centime près", async () => {
    const organizationId = randomUUID();
    const { traiteur, fleuriste, set } = await lineOf(organizationId);
    await set(traiteur.id, "estimated", 450000);
    await set(traiteur.id, "committed", 448050);
    await set(traiteur.id, "paid", 100000);
    await set(fleuriste.id, "estimated", 120000);
    await set(fleuriste.id, "quoted", 115099);
    const view = await set(fleuriste.id, "committed", 115099);

    expect(view).toMatchObject({
      totalEstimatedCents: 570000,
      totalQuotedCents: 115099,
      totalCommittedCents: 563149,
      totalPaidCents: 100000,
      totalRemainingCents: 463149,
      totalVarianceCents: -6851,
    });
  });

  it("l'historique est tenu montant par montant", async () => {
    const organizationId = randomUUID();
    const { traiteur, set } = await lineOf(organizationId);
    await set(traiteur.id, "quoted", 448000);
    await set(traiteur.id, "paid", 100000);
    await set(traiteur.id, "paid", 200000);

    const history = await listBudgetLineHistory(organizationId, traiteur.id);
    expect(history.map((entry) => [entry.field, entry.oldValueCents, entry.newValueCents])).toEqual([
      ["quoted", null, 448000],
      ["paid", null, 100000],
      ["paid", 100000, 200000],
    ]);
  });

  it("une retenue n'écrase pas un devisé déjà saisi", async () => {
    const organizationId = randomUUID();
    const { eventId, traiteur, set } = await lineOf(organizationId);
    await set(traiteur.id, "quoted", 460000);

    await applyVendorSlotBookedToBudget(organizationId, {
      eventId,
      vendorSlotId: traiteur.id,
      label: "Traiteur",
      amountCents: 448000,
      currency: "EUR",
      bookedByUserId: plannerId,
    });

    expect((await listBudgetLines(organizationId, eventId)).lines[0]).toMatchObject({ quotedAmountCents: 460000, committedAmountCents: 448000 });
  });

  it("refuse un montant négatif ou non entier", async () => {
    const organizationId = randomUUID();
    const { traiteur, set } = await lineOf(organizationId);
    await expect(set(traiteur.id, "paid", -1)).rejects.toThrow();
    await expect(set(traiteur.id, "quoted", 10.5)).rejects.toThrow();
  });
});

describe("BUD-02 — Enveloppe et seuil d'alerte (lot 28a, décision D4)", () => {
  async function eventWithLines(organizationId: string) {
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
    const event = await createEvent(organizationId);
    const [lieu, traiteur] = await listEventVendorSlots(organizationId, event.id);
    return { eventId: event.id, lieu: lieu!, traiteur: traiteur! };
  }

  it("l'enveloppe est le budget souhaité du client ; sans lui, le total de la simulation ; sans l'un ni l'autre, aucune", async () => {
    const organizationId = randomUUID();
    const withSimulation = await createEventWithSimulation(organizationId);
    expect((await listBudgetLines(organizationId, withSimulation.id)).envelope).toMatchObject({ amountCents: 1000000, source: "simulation" });

    await setEventWantedBudget(organizationId, withSimulation.id, 3000000);
    expect((await listBudgetLines(organizationId, withSimulation.id)).envelope).toMatchObject({ amountCents: 3000000, source: "wanted" });

    const bare = await createEvent(organizationId);
    expect((await listBudgetLines(organizationId, bare.id)).envelope).toBeNull();
  });

  it("le seuil vaut 90 % par défaut (modèle de départ), se règle par organisation et s'ajuste par événement", async () => {
    const organizationId = randomUUID();
    const { eventId } = await eventWithLines(organizationId);
    expect(await getBudgetAlertSettings(organizationId, eventId)).toEqual({ organizationPercent: 90, eventPercent: null });

    await setOrganizationAlertThreshold(organizationId, 85);
    await setEventAlertThreshold(organizationId, eventId, 110);
    expect(await getBudgetAlertSettings(organizationId, eventId)).toEqual({ organizationPercent: 85, eventPercent: 110 });

    await setEventWantedBudget(organizationId, eventId, 2000000);
    expect((await listBudgetLines(organizationId, eventId)).envelope).toMatchObject({ thresholdPercent: 110, thresholdCents: 2200000 });

    // Vide : l'événement reprend le seuil de l'organisation.
    await setEventAlertThreshold(organizationId, eventId, null);
    expect((await listBudgetLines(organizationId, eventId)).envelope).toMatchObject({ thresholdPercent: 85, thresholdCents: 1700000 });
  });

  it("refuse un seuil hors de 1 à 500 %, ou non entier", async () => {
    const organizationId = randomUUID();
    const { eventId } = await eventWithLines(organizationId);
    for (const percent of [0, 501, 90.5, -10]) {
      await expect(setOrganizationAlertThreshold(organizationId, percent)).rejects.toBeInstanceOf(AlertThresholdInvalidError);
      await expect(setEventAlertThreshold(organizationId, eventId, percent)).rejects.toBeInstanceOf(AlertThresholdInvalidError);
    }
    expect(await getBudgetAlertSettings(organizationId, eventId)).toEqual({ organizationPercent: 90, eventPercent: null });
  });

  it("le dépassement est signalé quand l'engagé dépasse le seuil, pas quand il l'atteint", async () => {
    const organizationId = randomUUID();
    const { eventId, lieu, traiteur } = await eventWithLines(organizationId);
    await setEventWantedBudget(organizationId, eventId, 3000000);
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: lieu.id, field: "committed", amountCents: 2000000, changedByUserId: plannerId });
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: traiteur.id, field: "committed", amountCents: 700000, changedByUserId: plannerId });
    expect((await listBudgetLines(organizationId, eventId)).envelope).toMatchObject({ thresholdCents: 2700000, committedPercent: 90, exceeded: false });

    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: traiteur.id, field: "committed", amountCents: 700001, changedByUserId: plannerId });
    expect((await listBudgetLines(organizationId, eventId)).envelope).toMatchObject({ exceeded: true });
  });

  it("l'alerte précède l'engagement : l'aperçu chiffre le dépassement sans rien écrire, en remplaçant l'engagé de la ligne", async () => {
    const organizationId = randomUUID();
    const { eventId, lieu, traiteur } = await eventWithLines(organizationId);
    await setEventWantedBudget(organizationId, eventId, 3000000);
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: lieu.id, field: "committed", amountCents: 2000000, changedByUserId: plannerId });
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: traiteur.id, field: "committed", amountCents: 300000, changedByUserId: plannerId });

    const preview = await previewEngagement({ organizationId, eventId, eventVendorSlotId: traiteur.id, amountCents: 800000 });
    expect(preview).toMatchObject({ committedAfterCents: 2800000, exceedsThreshold: true, overThresholdCents: 100000 });
    expect(await previewEngagement({ organizationId, eventId, eventVendorSlotId: traiteur.id, amountCents: 700000 })).toMatchObject({
      committedAfterCents: 2700000,
      exceedsThreshold: false,
      overThresholdCents: 0,
    });
    expect((await listBudgetLines(organizationId, eventId)).totalCommittedCents).toBe(2300000);
  });

  it("sans enveloppe, aucune alerte", async () => {
    const organizationId = randomUUID();
    const { eventId, lieu } = await eventWithLines(organizationId);
    expect(await previewEngagement({ organizationId, eventId, eventVendorSlotId: lieu.id, amountCents: 99999999 })).toMatchObject({
      envelope: null,
      exceedsThreshold: false,
    });
  });
});

describe("PRD-BUD-02 — Isolation entre organisations", () => {
  it("une organisation ne voit ni ne modifie jamais les lignes de budget d'une autre", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const otherEvent = await createEventWithSimulation(otherOrganizationId);
    await confirmEventBudget({
      organizationId: otherOrganizationId,
      eventId: otherEvent.id,
      confirmedByUserId: plannerId,
    });

    expect(await listBudgetLines(organizationId, otherEvent.id)).toMatchObject({ lines: [] });

    const otherEventSlots = await listEventVendorSlots(otherOrganizationId, otherEvent.id);
    const otherLieuSlot = otherEventSlots.find((slot) => slot.label === "Lieu")!;
    await expect(
      updateBudgetLine({
        organizationId,
        eventId: otherEvent.id,
        eventVendorSlotId: otherLieuSlot.id,
        field: "committed",
        amountCents: 1,
        changedByUserId: plannerId,
      }),
    ).rejects.toThrow();
  });

  it("BUD-02 — le seuil d'un événement d'une autre organisation ne se règle ni ne se lit", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const otherEvent = await createEvent(otherOrganizationId);
    await setOrganizationAlertThreshold(otherOrganizationId, 70);
    await setEventAlertThreshold(otherOrganizationId, otherEvent.id, 75);

    await expect(setEventAlertThreshold(organizationId, otherEvent.id, 120)).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await getBudgetAlertSettings(organizationId, otherEvent.id)).toEqual({ organizationPercent: 90, eventPercent: null });
    expect(await getBudgetAlertSettings(otherOrganizationId, otherEvent.id)).toEqual({ organizationPercent: 70, eventPercent: 75 });
  });
});
