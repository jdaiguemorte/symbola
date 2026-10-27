// BUD-01 — simulation pour un prospect, contre un vrai PostgreSQL (RLS,
// ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { addDefaultVendorSlots, createProspect, createProspectSource } from "@/modules/events/service";
import {
  adjustEventBudgetItem,
  AllocationModelTotalInvalidError,
  createAllocationModel,
  DefaultVendorSlotNotFoundError,
  EventBudgetNotFoundError,
  EventNotFoundError,
  getEventBudget,
  listAllocationModels,
  removeAllocationModel,
  simulateEventBudget,
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

describe("BUD-01 — Modèles de répartition", () => {
  it("refuse un modèle dont le total des pourcentages ne fait pas 100 %", async () => {
    const organizationId = randomUUID();
    const [lieu, traiteur] = await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);

    await expect(
      createAllocationModel({
        organizationId,
        name: "Déséquilibré",
        items: [
          { defaultVendorSlotId: lieu!.id, percentageBasisPoints: 5000 },
          { defaultVendorSlotId: traiteur!.id, percentageBasisPoints: 3000 },
        ],
      }),
    ).rejects.toBeInstanceOf(AllocationModelTotalInvalidError);

    expect(await listAllocationModels(organizationId)).toHaveLength(0);
  });

  it("refuse un modèle qui référence un poste inexistant", async () => {
    const organizationId = randomUUID();
    await expect(
      createAllocationModel({
        organizationId,
        name: "Invalide",
        items: [{ defaultVendorSlotId: randomUUID(), percentageBasisPoints: 10000 }],
      }),
    ).rejects.toBeInstanceOf(DefaultVendorSlotNotFoundError);
  });

  it("accepte, liste et supprime un modèle valide", async () => {
    const organizationId = randomUUID();
    const [lieu, traiteur] = await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);

    const model = await createAllocationModel({
      organizationId,
      name: "Classique",
      items: [
        { defaultVendorSlotId: lieu!.id, percentageBasisPoints: 6000 },
        { defaultVendorSlotId: traiteur!.id, percentageBasisPoints: 4000 },
      ],
    });

    expect(await listAllocationModels(organizationId)).toMatchObject([{ id: model.id, name: "Classique" }]);

    await removeAllocationModel(organizationId, model.id);
    expect(await listAllocationModels(organizationId)).toHaveLength(0);
  });
});

describe("BUD-01 — Simulation pour un prospect", () => {
  it("calcule le montant par poste depuis le modèle choisi", async () => {
    const organizationId = randomUUID();
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

    const simulation = await simulateEventBudget({
      organizationId,
      eventId: event.id,
      totalAmountCents: 1000000,
      guestCount: 40,
      allocationModelId: model.id,
    });

    expect(simulation.items).toEqual(
      expect.arrayContaining([
        { defaultVendorSlotId: lieu!.id, amountCents: 600000 },
        { defaultVendorSlotId: traiteur!.id, amountCents: 400000 },
      ]),
    );
    expect(simulation.allocatedCents).toBe(1000000);
    expect(simulation.remainingCents).toBe(0);
    expect(simulation.costPerGuestCents).toBe(25000);
  });

  it("refuse de simuler sur un événement d'une autre organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const [lieu] = await addDefaultVendorSlots(otherOrganizationId, ["Lieu"]);
    const otherEvent = await createEvent(otherOrganizationId);
    const otherModel = await createAllocationModel({
      organizationId: otherOrganizationId,
      name: "Modèle",
      items: [{ defaultVendorSlotId: lieu!.id, percentageBasisPoints: 10000 }],
    });

    await expect(
      simulateEventBudget({
        organizationId,
        eventId: otherEvent.id,
        totalAmountCents: 100000,
        guestCount: 10,
        allocationModelId: otherModel.id,
      }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("une nouvelle simulation écrase la précédente (un seul budget par événement)", async () => {
    const organizationId = randomUUID();
    const [lieu] = await addDefaultVendorSlots(organizationId, ["Lieu"]);
    const event = await createEvent(organizationId);
    const model = await createAllocationModel({
      organizationId,
      name: "Modèle",
      items: [{ defaultVendorSlotId: lieu!.id, percentageBasisPoints: 10000 }],
    });

    await simulateEventBudget({
      organizationId,
      eventId: event.id,
      totalAmountCents: 100000,
      guestCount: 10,
      allocationModelId: model.id,
    });
    const second = await simulateEventBudget({
      organizationId,
      eventId: event.id,
      totalAmountCents: 200000,
      guestCount: 20,
      allocationModelId: model.id,
    });

    expect(second.totalAmountCents).toBe(200000);
    expect(second.items).toHaveLength(1);
    expect(await getEventBudget(organizationId, event.id)).toMatchObject({ totalAmountCents: 200000 });
  });

  it("ajuste un poste à la main : le total et le reste à répartir se recalculent", async () => {
    const organizationId = randomUUID();
    const [lieu, traiteur] = await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
    const event = await createEvent(organizationId);
    const model = await createAllocationModel({
      organizationId,
      name: "Modèle",
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

    const adjusted = await adjustEventBudgetItem({
      organizationId,
      eventId: event.id,
      defaultVendorSlotId: lieu!.id,
      amountCents: 700000,
    });

    expect(adjusted.items).toEqual(
      expect.arrayContaining([
        { defaultVendorSlotId: lieu!.id, amountCents: 700000 },
        { defaultVendorSlotId: traiteur!.id, amountCents: 400000 },
      ]),
    );
    expect(adjusted.allocatedCents).toBe(1100000);
    expect(adjusted.remainingCents).toBe(-100000);
  });

  it("refuse d'ajuster un poste si aucune simulation n'existe encore", async () => {
    const organizationId = randomUUID();
    const [lieu] = await addDefaultVendorSlots(organizationId, ["Lieu"]);
    const event = await createEvent(organizationId);

    await expect(
      adjustEventBudgetItem({ organizationId, eventId: event.id, defaultVendorSlotId: lieu!.id, amountCents: 1000 }),
    ).rejects.toBeInstanceOf(EventBudgetNotFoundError);
  });

  it("renvoie null quand aucune simulation n'existe pour l'événement", async () => {
    const organizationId = randomUUID();
    const event = await createEvent(organizationId);
    expect(await getEventBudget(organizationId, event.id)).toBeNull();
  });
});

describe("BUD-01 — Isolation entre organisations", () => {
  it("une organisation ne voit jamais les modèles ou simulations d'une autre", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const [lieu] = await addDefaultVendorSlots(otherOrganizationId, ["Lieu"]);
    const otherEvent = await createEvent(otherOrganizationId);
    const otherModel = await createAllocationModel({
      organizationId: otherOrganizationId,
      name: "Autre organisation",
      items: [{ defaultVendorSlotId: lieu!.id, percentageBasisPoints: 10000 }],
    });
    await simulateEventBudget({
      organizationId: otherOrganizationId,
      eventId: otherEvent.id,
      totalAmountCents: 500000,
      guestCount: 50,
      allocationModelId: otherModel.id,
    });

    expect(await listAllocationModels(organizationId)).toHaveLength(0);
    expect(await getEventBudget(organizationId, otherEvent.id)).toBeNull();

    // Même en connaissant l'id du modèle d'une autre organisation, aucune
    // simulation ne peut l'utiliser (RLS : introuvable dans ce contexte).
    const event = await createEvent(organizationId);
    await expect(
      simulateEventBudget({
        organizationId,
        eventId: event.id,
        totalAmountCents: 100000,
        guestCount: 10,
        allocationModelId: otherModel.id,
      }),
    ).rejects.toThrow();
  });
});
