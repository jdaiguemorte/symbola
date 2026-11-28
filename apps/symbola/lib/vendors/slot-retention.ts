// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — rattacher un prestataire du catalogue à un poste du
// budget, depuis sa ligne. Le poste doit être de l'évènement et le prestataire de l'organisation ;
// sinon refus, sans dire ce qui existe ailleurs (SEC-13). L'app passe par le service.ts de chaque
// module (ARC-01).
// Lot 65b (PRE-02, BUD-05 ; maquette M14) : choisir un nom ne le retient plus d'office. Deux gestes :
// « Comparer » l'ajoute à la comparaison du poste, « Retenir » le retient. Sans rien taper, la liste
// montre tout le carnet du métier du poste.
import { addVendorCandidate, countWorkedWithByVendor, EventNotFoundError, listEventVendorSlots, listVendorCandidates, selectVendorCandidate } from "@/modules/events/service";
import { ENGAGED_CANDIDATE_STATUSES, type VendorDocumentState } from "@symbola/contracts";
import { countVendorsByFamily, createVendor, findVendors, getVendor, listVendorTypes, VendorNotFoundError } from "@/modules/vendors/service";
import { matchSlotToVendorType } from "@/modules/events/service";
import { slotMatchCatalog } from "./add-to-event";
import { rankSlotVendors, slotChoiceList, slotMatchesVendorType } from "./slot-type-match";

// onSlot : déjà dans la comparaison du poste (« compared ») ou retenu (« retained »).
// Lot 73c (critère 7) : l'évaluation et l'état des pièces de chaque fiche, montrés dans le panneau du poste.
export type SlotVendorChoice = { id: string; name: string; city: string | null; typeLabel: string | null; matchesSlot: boolean; workedWith: boolean; workedWithCount: number; onSlot: "compared" | "retained" | null; rating: number | null; documentState: VendorDocumentState };
// matchingCount : les fiches du carnet du métier du poste (« {métier} du carnet · N ») ; tradeLabel : ce
// métier (ou sa famille), nul sans correspondance ; bookCount : tout le carnet (« Chercher dans tout le
// carnet (N fiches) »), lot 73c.
export type SlotVendorSearch = { choices: SlotVendorChoice[]; matchingCount: number; tradeLabel: string | null; bookCount: number };

async function slotOf(organizationId: string, eventId: string, slotId: string) {
  const slot = (await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.id === slotId);
  if (!slot) throw new EventNotFoundError();
  return slot;
}

export async function searchSlotVendors(input: { organizationId: string; eventId: string; slotId: string; term: string; locale: string }): Promise<SlotVendorSearch> {
  const slot = await slotOf(input.organizationId, input.eventId, input.slotId);
  const term = input.term.trim();
  const [types, worked, candidates, catalog, book] = await Promise.all([
    listVendorTypes(input.organizationId),
    countWorkedWithByVendor(input.organizationId),
    listVendorCandidates(input.organizationId, input.eventId),
    slotMatchCatalog(input.organizationId),
    countVendorsByFamily(input.organizationId),
  ]);
  // Lot 73c : la correspondance du 73a (même libellé, synonymes, famille) d'abord, puis la ressemblance
  // des mots du lot 63c.
  const match = matchSlotToVendorType(slot.label, catalog);
  const matched = match?.kind === "type" ? types.filter((type) => type.id === match.typeId) : match?.kind === "family" ? types.filter((type) => type.familyId === match.familyId) : [];
  const matchingTypeIds = [...new Set([...matched, ...types.filter((type) => slotMatchesVendorType(slot.label, type.label))].map((type) => type.id))];
  const tradeLabel = match?.kind === "family" ? (catalog.families.find((family) => family.id === match.familyId)?.label ?? null) : (types.find((type) => type.id === matchingTypeIds[0])?.label ?? null);
  // Le carnet du métier, en entier (au plus 60 fiches) ; le reste du carnet pour une recherche.
  const ofType = matchingTypeIds.length > 0 ? await findVendors({ organizationId: input.organizationId, typeIds: matchingTypeIds, limit: 60 }) : [];
  const vendors = term || ofType.length === 0 ? await findVendors({ organizationId: input.organizationId, ...(term ? { text: term } : {}), limit: 60 }) : ofType;
  const typeLabel = new Map(types.map((type) => [type.id, type.label]));
  const onSlot = new Map(
    candidates
      .filter((candidate) => candidate.vendorSlotId === slot.id && candidate.vendorId !== null && candidate.status !== "dismissed")
      .map((candidate) => [candidate.vendorId!, ENGAGED_CANDIDATE_STATUSES.includes(candidate.status) ? ("retained" as const) : ("compared" as const)]),
  );
  const choices = vendors
    .filter((vendor) => !vendor.isDemo)
    .map((vendor): SlotVendorChoice => {
      const label = vendor.typeId ? (typeLabel.get(vendor.typeId) ?? null) : null;
      const count = worked.get(vendor.id) ?? 0;
      return {
        id: vendor.id,
        name: vendor.name,
        city: vendor.city,
        typeLabel: label,
        matchesSlot: vendor.typeIds.some((typeId) => matchingTypeIds.includes(typeId)),
        workedWith: count > 0,
        workedWithCount: count,
        onSlot: onSlot.get(vendor.id) ?? null,
        rating: vendor.rating,
        documentState: vendor.documentState,
      };
    });
  return { choices: slotChoiceList(rankSlotVendors(choices, input.locale), term), matchingCount: ofType.filter((vendor) => !vendor.isDemo).length, tradeLabel: matchingTypeIds.length > 0 ? tradeLabel : null, bookCount: book.total };
}

// « Comparer » : le prestataire entre dans la comparaison du poste (« Pressenti »), sans être retenu ;
// déjà rattaché au poste, rien ne change.
export async function compareVendorForSlot(input: { organizationId: string; eventId: string; slotId: string; vendorId: string }): Promise<{ candidateId: string }> {
  const slot = await slotOf(input.organizationId, input.eventId, input.slotId);
  const vendor = await getVendor(input.organizationId, input.vendorId);
  if (!vendor) throw new VendorNotFoundError();
  const existing = (await listVendorCandidates(input.organizationId, input.eventId)).find((candidate) => candidate.vendorSlotId === slot.id && candidate.vendorId === vendor.id);
  if (existing) return { candidateId: existing.id };
  const candidate = await addVendorCandidate({ organizationId: input.organizationId, eventId: input.eventId, vendorSlotId: slot.id, vendorName: vendor.name, vendorId: vendor.id });
  return { candidateId: candidate.id };
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

// « + Nouveau prestataire » : la fiche est créée, puis ajoutée à la comparaison du poste (lot 65b :
// plus retenue d'office ; « retain » la retient).
export async function createAndRetainVendor(input: { organizationId: string; userId: string; eventId: string; slotId: string; retain?: boolean; vendor: { name: string; typeId: string | null; email: string | null; phone: string | null; city: string | null } }): Promise<{ candidateId: string; vendorId: string }> {
  await slotOf(input.organizationId, input.eventId, input.slotId);
  if (input.vendor.typeId && !(await listVendorTypes(input.organizationId)).some((type) => type.id === input.vendor.typeId)) throw new VendorNotFoundError();
  const { vendor } = await createVendor(input.organizationId, input.vendor);
  const { candidateId } =
    input.retain === false
      ? await compareVendorForSlot({ organizationId: input.organizationId, eventId: input.eventId, slotId: input.slotId, vendorId: vendor.id })
      : await retainVendorForSlot({ organizationId: input.organizationId, userId: input.userId, eventId: input.eventId, slotId: input.slotId, vendorId: vendor.id });
  return { candidateId, vendorId: vendor.id };
}
