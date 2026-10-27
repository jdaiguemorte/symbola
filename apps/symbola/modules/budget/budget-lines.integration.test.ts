// BUD-02 — budget réel (prévu/réel/écart), contre un vrai PostgreSQL
// (RLS, ADR 0012), par la porte d'entrée du module.
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
} from "@/modules/events/service";
import {
  BudgetSimulationMismatchError,
  EventBudgetNotFoundError,
  EventNotFoundError,
  EventVendorSlotNotFoundError,
  applyVendorSlotBookedToBudget,
  confirmEventBudget,
  createAllocationModel,
  listBudgetLineHistory,
  listBudgetLines,
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

describe("BUD-02 — Confirmer la simulation en budget prévu", () => {
  it("rapproche par label et crée les lignes de budget prévu", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);

    const view = await confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId });

    expect(view.lines).toHaveLength(2);
    expect(view.totalPlannedCents).toBe(1000000);
    expect(view.totalActualCents).toBe(0);
    expect(view.totalVarianceCents).toBe(0);
    const lieuLine = view.lines.find((line) => line.label === "Lieu");
    expect(lieuLine).toMatchObject({ plannedAmountCents: 600000, actualAmountCents: null, varianceCents: null });
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

describe("BUD-02 — Prévu, réel, écart", () => {
  it("modifie le réel à la main et calcule l'écart", async () => {
    const organizationId = randomUUID();
    const event = await createEventWithSimulation(organizationId);
    await confirmEventBudget({ organizationId, eventId: event.id, confirmedByUserId: plannerId });

    const eventSlots = await listEventVendorSlots(organizationId, event.id);
    const lieuSlot = eventSlots.find((slot) => slot.label === "Lieu")!;

    const view = await updateBudgetLine({
      organizationId,
      eventId: event.id,
      eventVendorSlotId: lieuSlot.id,
      field: "actual",
      amountCents: 650000,
      changedByUserId: plannerId,
    });

    const lieuLine = view.lines.find((line) => line.eventVendorSlotId === lieuSlot.id)!;
    expect(lieuLine.actualAmountCents).toBe(650000);
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
        field: "actual",
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
      field: "planned",
      amountCents: 500000,
      changedByUserId: plannerId,
    });

    expect(view.lines).toMatchObject([{ eventVendorSlotId: lieuSlot.id, plannedAmountCents: 500000 }]);
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
      field: "actual",
      amountCents: 650000,
      changedByUserId: plannerId,
    });
    await updateBudgetLine({
      organizationId,
      eventId: event.id,
      eventVendorSlotId: lieuSlot.id,
      field: "actual",
      amountCents: 700000,
      changedByUserId: plannerId,
    });

    const history = await listBudgetLineHistory(organizationId, lieuSlot.id);
    const actualEntries = history.filter((entry) => entry.field === "actual");
    expect(actualEntries).toHaveLength(2);
    expect(actualEntries[0]).toMatchObject({ oldValueCents: null, newValueCents: 650000, changedByUserId: plannerId });
    expect(actualEntries[1]).toMatchObject({ oldValueCents: 650000, newValueCents: 700000, changedByUserId: plannerId });
    expect(typeof actualEntries[0]!.changedAt).toBe("string");
  });

  it("applique automatiquement le réel quand events.vendor_slot.booked survient pour un poste suivi", async () => {
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
    expect(traiteurLine.actualAmountCents).toBe(390000);

    const history = await listBudgetLineHistory(organizationId, traiteurSlot.id);
    expect(history.at(-1)).toMatchObject({ newValueCents: 390000, changedByUserId: bookedByUserId });
  });

  it("ignore l'événement vendor_slot.booked tant qu'aucune ligne de budget n'existe pour ce poste", async () => {
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

    expect(await listBudgetLines(organizationId, event.id)).toMatchObject({ lines: [] });
  });
});

describe("BUD-02 — Isolation entre organisations", () => {
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
        field: "actual",
        amountCents: 1,
        changedByUserId: plannerId,
      }),
    ).rejects.toThrow();
  });
});
