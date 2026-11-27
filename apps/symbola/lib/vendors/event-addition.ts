// Lot 73a (PRE-02, BUD-01, BUD-02 ; spécification du lot 73, § 4.2 ; P12) — « Ajouter à un mariage… »
// depuis le carnet, la fiche ou « Créer et ajouter » : l'app passe par le service.ts de chaque module
// (ARC-01). Les fiches sont toutes revérifiées dans l'organisation (une seule d'ailleurs fait refuser tout
// le lot, comme « inexistant », sans rien écrire) ; avant « Retenu », le dépassement du seuil d'alerte de
// l'enveloppe se confirme (« Retenir quand même ? », règle actuelle du lot 28a, D4) quand le module Budget
// est souscrit et qu'un devis est connu.
import { addVendorToEventSlot, listVendorCandidates } from "@/modules/events/service";
import { getVendor, VendorNotFoundError } from "@/modules/vendors/service";
import { previewEngagement } from "@/modules/budget/service";
import type { AddVendorToEventSlotInput, VendorAdditionMode, VendorAdditionResult } from "@symbola/contracts";

export type EventAdditionOutcome =
  | VendorAdditionResult
  // Le devis dépasse le seuil d'alerte : rien n'est écrit tant que la planner ne confirme pas.
  | { status: "confirm_budget"; committedAfterCents: number; overThresholdCents: number; thresholdPercent: number };

export async function addVendorsToEvent(input: {
  organizationId: string;
  userId: string;
  eventId: string;
  slotId?: string;
  newSlotLabel?: string;
  vendorIds: string[];
  mode: VendorAdditionMode;
  viewer?: AddVendorToEventSlotInput["viewer"];
  // « Retenir quand même » déjà répondu.
  confirmed?: boolean;
  budgetEnabled: boolean;
}): Promise<EventAdditionOutcome> {
  const ids = [...new Set(input.vendorIds)];
  const vendors = await Promise.all(ids.map((id) => getVendor(input.organizationId, id)));
  if (vendors.length === 0 || vendors.some((vendor) => vendor === null || vendor.archived)) throw new VendorNotFoundError();
  const found = vendors.filter((vendor): vendor is NonNullable<typeof vendor> => vendor !== null);
  if (input.mode !== "compare" && input.slotId && input.budgetEnabled && !input.confirmed) {
    // Le devis du prestataire déjà rattaché au poste : c'est lui que « Retenu » engage.
    const existing = (await listVendorCandidates(input.organizationId, input.eventId)).find((candidate) => candidate.vendorSlotId === input.slotId && candidate.vendorId === found[0]!.id);
    if (existing && existing.quoteAmountCents !== null && existing.outcome !== "selected") {
      const preview = await previewEngagement({ organizationId: input.organizationId, eventId: input.eventId, eventVendorSlotId: input.slotId, amountCents: existing.quoteAmountCents, candidateId: existing.id });
      if (preview.exceedsThreshold && preview.envelope) {
        return { status: "confirm_budget", committedAfterCents: preview.committedAfterCents, overThresholdCents: preview.overThresholdCents, thresholdPercent: preview.envelope.thresholdPercent };
      }
    }
  }
  return addVendorToEventSlot({
    organizationId: input.organizationId,
    userId: input.userId,
    eventId: input.eventId,
    ...(input.slotId ? { slotId: input.slotId } : {}),
    ...(input.newSlotLabel !== undefined ? { newSlotLabel: input.newSlotLabel } : {}),
    vendors: found.map((vendor) => ({ vendorId: vendor.id, vendorName: vendor.name })),
    mode: input.mode,
    ...(input.viewer ? { viewer: input.viewer } : {}),
  });
}
