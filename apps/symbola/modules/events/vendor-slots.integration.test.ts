// EVT-03 — postes prestataires d'un événement, contre un vrai PostgreSQL
// (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { EVT_VENDOR_SLOT_BOOKED } from "@symbola/contracts";
import {
  addDefaultVendorSlots,
  addEventVendorSlot,
  createProspect,
  createProspectSource,
  listDefaultVendorSlots,
  listEventVendorSlots,
  removeDefaultVendorSlot,
  removeEventVendorSlot,
  updateEventVendorSlot,
  EventNotFoundError,
  VendorNameRequiredError,
  VendorSlotNotFoundError,
} from "./service";

const { sql, db } = createAppConnection();
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

describe("EVT-03 — Statut des postes prestataires", () => {
  it("quand un événement est créé, il reçoit la liste de postes par défaut de la planner", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur", "Photographe"]);

    const event = await createEvent(organizationId);
    const slots = await listEventVendorSlots(organizationId, event.id);

    expect(slots.map((slot) => slot.label)).toEqual(["Lieu", "Traiteur", "Photographe"]);
    expect(slots.every((slot) => slot.status === "to_find")).toBe(true);
  });

  it("elle modifie les postes événement par événement, sans toucher la liste par défaut ni les autres événements", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
    const eventA = await createEvent(organizationId);
    const eventB = await createEvent(organizationId);

    await addEventVendorSlot(organizationId, eventA.id, "DJ");
    const lieuA = (await listEventVendorSlots(organizationId, eventA.id)).find((slot) => slot.label === "Lieu");
    await removeEventVendorSlot(organizationId, lieuA!.id);

    expect((await listEventVendorSlots(organizationId, eventA.id)).map((slot) => slot.label)).toEqual([
      "Traiteur",
      "DJ",
    ]);
    expect((await listEventVendorSlots(organizationId, eventB.id)).map((slot) => slot.label)).toEqual([
      "Lieu",
      "Traiteur",
    ]);
    expect((await listDefaultVendorSlots(organizationId)).map((slot) => slot.label)).toEqual(["Lieu", "Traiteur"]);
  });

  it("la liste par défaut se gère par organisation, sans doublon quand le modèle de départ est rechargé", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleuriste"]);

    const defaults = await listDefaultVendorSlots(organizationId);
    expect(defaults.map((slot) => slot.label)).toEqual(["Lieu", "Traiteur", "Fleuriste"]);

    await removeDefaultVendorSlot(organizationId, defaults[0]!.id);
    expect((await listDefaultVendorSlots(organizationId)).map((slot) => slot.label)).toEqual([
      "Traiteur",
      "Fleuriste",
    ]);
  });

  it("quand elle passe un poste à Réservé, le nom du prestataire est obligatoire", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe"]);
    const event = await createEvent(organizationId);
    const [slot] = await listEventVendorSlots(organizationId, event.id);

    await expect(
      updateEventVendorSlot({ organizationId, vendorSlotId: slot!.id, changedByUserId: plannerId, status: "booked" }),
    ).rejects.toBeInstanceOf(VendorNameRequiredError);
    expect((await listEventVendorSlots(organizationId, event.id))[0]?.status).toBe("to_find");
  });

  it("le montant est facultatif, stocké en centimes, et la réservation est publiée pour le futur module Budget", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Photographe", "DJ"]);
    const event = await createEvent(organizationId);
    const [photographer, dj] = await listEventVendorSlots(organizationId, event.id);

    const booked = await updateEventVendorSlot({
      organizationId,
      vendorSlotId: photographer!.id,
      changedByUserId: plannerId,
      status: "booked",
      vendorName: "Studio Lumière",
      amountCents: 250000,
    });
    expect(booked).toMatchObject({ status: "booked", vendorName: "Studio Lumière", amountCents: 250000, currency: "EUR" });

    const withoutAmount = await updateEventVendorSlot({
      organizationId,
      vendorSlotId: dj!.id,
      changedByUserId: plannerId,
      status: "booked",
      vendorName: "DJ Sam",
    });
    expect(withoutAmount.amountCents).toBeNull();

    const published = await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, EVT_VENDOR_SLOT_BOOKED))),
    );
    expect(published).toHaveLength(2);
    expect(published.map((row) => row.payload)).toContainEqual(
      expect.objectContaining({ vendorSlotId: photographer!.id, amountCents: 250000, currency: "EUR" }),
    );
    expect(JSON.stringify(published.map((row) => row.payload))).not.toContain("Studio Lumière");
  });

  it("un changement de montant d'un poste réservé est republié, une mise à jour sans changement ne l'est pas", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Traiteur"]);
    const event = await createEvent(organizationId);
    const [slot] = await listEventVendorSlots(organizationId, event.id);
    const base = { organizationId, vendorSlotId: slot!.id, changedByUserId: plannerId, vendorName: "Traiteur Martin" };

    await updateEventVendorSlot({ ...base, status: "booked", amountCents: 100000 });
    await updateEventVendorSlot({ ...base, status: "booked", amountCents: 120000 });
    await updateEventVendorSlot({ ...base, status: "booked", amountCents: 120000 });

    const published = await withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, EVT_VENDOR_SLOT_BOOKED))),
    );
    expect(published.map((row) => (row.payload as { amountCents: number }).amountCents).sort()).toEqual([
      100000, 120000,
    ]);
    expect((await listEventVendorSlots(organizationId, event.id))[0]?.amountCents).toBe(120000);
  });
});

describe("EVT-03 — Isolation par la porte d'entrée du module", () => {
  it("refuse d'ajouter un poste à l'événement d'une autre organisation, ou de modifier son poste", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    await addDefaultVendorSlots(otherOrganizationId, ["Traiteur"]);
    const otherEvent = await createEvent(otherOrganizationId);
    const [otherSlot] = await listEventVendorSlots(otherOrganizationId, otherEvent.id);

    await expect(addEventVendorSlot(organizationId, otherEvent.id, "DJ")).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(
      updateEventVendorSlot({
        organizationId,
        vendorSlotId: otherSlot!.id,
        changedByUserId: plannerId,
        status: "not_required",
      }),
    ).rejects.toBeInstanceOf(VendorSlotNotFoundError);
    await removeEventVendorSlot(organizationId, otherSlot!.id);

    expect(await listEventVendorSlots(otherOrganizationId, otherEvent.id)).toMatchObject([
      { label: "Traiteur", status: "to_find" },
    ]);
  });
});
