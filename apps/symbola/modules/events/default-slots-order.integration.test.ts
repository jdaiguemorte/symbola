// Lot 13 (HUB-16) — ordre des lignes du budget par défaut, contre un vrai
// PostgreSQL (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addDefaultVendorSlots, createProspect, createProspectSource, listDefaultVendorSlots, listEventVendorSlots, reorderDefaultVendorSlots, VendorSlotNotFoundError } from "./service";

describe("HUB-16 — Ordre des lignes du budget par défaut", () => {
  it("étant donné trois lignes, quand elle change leur ordre, alors la liste et les nouveaux événements suivent cet ordre", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur", "Photographe"]);
    const [lieu, traiteur, photographe] = await listDefaultVendorSlots(organizationId);
    await reorderDefaultVendorSlots(organizationId, [photographe!.id, lieu!.id, traiteur!.id]);
    expect((await listDefaultVendorSlots(organizationId)).map((line) => line.label)).toEqual(["Photographe", "Lieu", "Traiteur"]);

    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: randomUUID(), prospectSourceId: source.id, clients: [{ firstName: "Inès" }] });
    expect((await listEventVendorSlots(organizationId, event.id)).map((slot) => slot.label)).toEqual(["Photographe", "Lieu", "Traiteur"]);
  });

  it("une liste incomplète, en double ou inconnue ne change rien", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
    const [lieu, traiteur] = await listDefaultVendorSlots(organizationId);
    await expect(reorderDefaultVendorSlots(organizationId, [traiteur!.id])).rejects.toThrow(VendorSlotNotFoundError);
    await expect(reorderDefaultVendorSlots(organizationId, [traiteur!.id, traiteur!.id])).rejects.toThrow(VendorSlotNotFoundError);
    await expect(reorderDefaultVendorSlots(organizationId, [traiteur!.id, randomUUID()])).rejects.toThrow(VendorSlotNotFoundError);
    expect((await listDefaultVendorSlots(organizationId)).map((line) => line.id)).toEqual([lieu!.id, traiteur!.id]);
  });

  it("isolation : l'organisation A ne peut pas réordonner les lignes de B", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    await addDefaultVendorSlots(organizationA, ["Lieu"]);
    await addDefaultVendorSlots(organizationB, ["Fleuriste", "DJ"]);
    const linesB = await listDefaultVendorSlots(organizationB);
    await expect(reorderDefaultVendorSlots(organizationA, [linesB[1]!.id, linesB[0]!.id])).rejects.toThrow(VendorSlotNotFoundError);
    expect((await listDefaultVendorSlots(organizationB)).map((line) => line.label)).toEqual(["Fleuriste", "DJ"]);
  });
});
