// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — rattacher un prestataire du catalogue à un poste du
// budget, depuis sa ligne : le choisir le retient pour ce poste, comme « Retenir » dans la
// consultation. Le poste doit être de l'évènement et le prestataire de l'organisation ; sinon refus,
// sans dire ce qui existe ailleurs (SEC-13). L'app passe par le service.ts de chaque module (ARC-01).
import { addVendorCandidate, EventNotFoundError, listEventVendorSlots, listSelectedVendorIds, listVendorCandidates, selectVendorCandidate } from "@/modules/events/service";
import { createVendor, findVendors, getVendor, listVendorTypes, VendorNotFoundError } from "@/modules/vendors/service";
import { rankSlotVendors, slotMatchesVendorType } from "./slot-type-match";

export type SlotVendorChoice = { id: string; name: string; city: string | null; typeLabel: string | null; matchesSlot: boolean; workedWith: boolean };

const SHOWN = 8;

async function slotOf(organizationId: string, eventId: string, slotId: string) {
  const slot = (await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.id === slotId);
  if (!slot) throw new EventNotFoundError();
  return slot;
}

export async function searchSlotVendors(input: { organizationId: string; eventId: string; slotId: string; term: string; locale: string }): Promise<SlotVendorChoice[]> {
  const slot = await slotOf(input.organizationId, input.eventId, input.slotId);
  const [vendors, types, worked] = await Promise.all([
    findVendors({ organizationId: input.organizationId, ...(input.term.trim() ? { text: input.term.trim() } : {}), limit: 60 }),
    listVendorTypes(input.organizationId),
    listSelectedVendorIds(input.organizationId),
  ]);
  const typeLabel = new Map(types.map((type) => [type.id, type.label]));
  const workedWith = new Set(worked);
  const choices = vendors
    .filter((vendor) => !vendor.isDemo)
    .map((vendor) => {
      const label = vendor.typeId ? (typeLabel.get(vendor.typeId) ?? null) : null;
      return { id: vendor.id, name: vendor.name, city: vendor.city, typeLabel: label, matchesSlot: label !== null && slotMatchesVendorType(slot.label, label), workedWith: workedWith.has(vendor.id) };
    });
  return rankSlotVendors(choices, input.locale).slice(0, SHOWN);
}

export async function retainVendorForSlot(input: { organizationId: string; userId: string; eventId: string; slotId: string; vendorId: string }): Promise<{ candidateId: string }> {
  const slot = await slotOf(input.organizationId, input.eventId, input.slotId);
  const vendor = await getVendor(input.organizationId, input.vendorId);
  if (!vendor) throw new VendorNotFoundError();
  // Déjà consulté pour ce poste : on le retient ; sinon il est ajouté puis retenu.
  const existing = (await listVendorCandidates(input.organizationId, input.eventId)).find((candidate) => candidate.vendorSlotId === slot.id && candidate.vendorId === vendor.id);
  const candidate = existing ?? (await addVendorCandidate({ organizationId: input.organizationId, eventId: input.eventId, vendorSlotId: slot.id, vendorName: vendor.name, vendorId: vendor.id }));
  await selectVendorCandidate({ organizationId: input.organizationId, candidateId: candidate.id, changedByUserId: input.userId });
  return { candidateId: candidate.id };
}

export async function createAndRetainVendor(input: { organizationId: string; userId: string; eventId: string; slotId: string; vendor: { name: string; typeId: string | null; email: string | null; phone: string | null; city: string | null } }): Promise<{ candidateId: string; vendorId: string }> {
  await slotOf(input.organizationId, input.eventId, input.slotId);
  if (input.vendor.typeId && !(await listVendorTypes(input.organizationId)).some((type) => type.id === input.vendor.typeId)) throw new VendorNotFoundError();
  const { vendor } = await createVendor(input.organizationId, input.vendor);
  const { candidateId } = await retainVendorForSlot({ organizationId: input.organizationId, userId: input.userId, eventId: input.eventId, slotId: input.slotId, vendorId: vendor.id });
  return { candidateId, vendorId: vendor.id };
}
