// Worker continu des événements internes (ADR 0014), contre un vrai
// PostgreSQL : un poste réservé (PRD-EVT-03) met à jour le réel de sa ligne de
// budget (PRD-BUD-02) au passage du worker, une seule fois ; un montant modifié
// à la main après la réservation n'est jamais écrasé par un rejeu.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { listBudgetLines, updateBudgetLine } from "@/modules/budget/service";
import { addEventVendorSlot, createProspect, createProspectSource, updateEventVendorSlot } from "@/modules/events/service";
import { runEventWorkerOnce } from "./event-worker";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function bookedSlot() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  const { id: eventId } = await createProspect({
    organizationId: organization.id,
    createdByUserId: user.id,
    prospectSourceId: source.id,
    clients: [{ firstName: "Camille", lastName: null }],
  });
  const slot = await addEventVendorSlot(organization.id, eventId, "Traiteur");
  await updateBudgetLine({ organizationId: organization.id, eventId, eventVendorSlotId: slot.id, field: "estimated", amountCents: 500000, changedByUserId: user.id });
  return { organizationId: organization.id, userId: user.id, eventId, slotId: slot.id };
}

const actual = async (organizationId: string, eventId: string) => (await listBudgetLines(organizationId, eventId)).lines[0]?.committedAmountCents ?? null;

describe("Worker continu — prestataire retenu → engagé du budget (PRE-02 → BUD-01)", { timeout: 60_000 }, () => {
  it("au passage du worker, l'engagé de la ligne prend le montant du prestataire retenu, une seule fois", async () => {
    const booked = await bookedSlot();
    await updateEventVendorSlot({ organizationId: booked.organizationId, vendorSlotId: booked.slotId, changedByUserId: booked.userId, vendorName: "Traiteur Dupont", amountCents: 480000 });
    // Rien tant que le worker n'est pas passé : la publication est découplée.
    expect(await actual(booked.organizationId, booked.eventId)).toBeNull();

    await runEventWorkerOnce();
    expect(await actual(booked.organizationId, booked.eventId)).toBe(480000);
    // Rejeu : rien de plus.
    await runEventWorkerOnce();
    expect(await actual(booked.organizationId, booked.eventId)).toBe(480000);
  });

  it("un engagé modifié à la main après la retenue n'est pas écrasé (premier démarrage du worker)", async () => {
    const booked = await bookedSlot();
    await updateEventVendorSlot({ organizationId: booked.organizationId, vendorSlotId: booked.slotId, changedByUserId: booked.userId, vendorName: "Traiteur Dupont", amountCents: 480000 });
    // La planner corrige l'engagé avant que le worker ne passe.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await updateBudgetLine({ organizationId: booked.organizationId, eventId: booked.eventId, eventVendorSlotId: booked.slotId, field: "committed", amountCents: 495000, changedByUserId: booked.userId });

    await runEventWorkerOnce();
    expect(await actual(booked.organizationId, booked.eventId)).toBe(495000);
  });
});
