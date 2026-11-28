// Lot 73c (PRE-02, BUD-01, BUD-02, UX-07, SEC-10 à SEC-13 ; spécification du lot 73, § 5.3 ; P7, P12,
// P-14) — « Ajouter à un mariage… », le même geste depuis le carnet, la fiche, la sélection, le carnet
// ouvert depuis un poste et le panneau du poste : ce que la fenêtre propose, l'ajout et ce que le message
// de retour en dit, « Annuler », le carnet filtré pour un poste. L'app passe par le service.ts de chaque
// module (ARC-01) : le module Prestataires n'écrit jamais dans le schéma des évènements ni du budget.
// Une fiche, un mariage ou un poste hors de portée (autre organisation, autre mariage, mariage annulé ou
// clôturé, hors de l'équipe d'une Planner restreinte) répond toujours de la même façon (SEC-13).
import { starterVendorTypeSynonyms } from "@symbola/starter-templates";
import type { AddVendorToEventSlotInput } from "@symbola/contracts";
import { EventNotFoundError, eventNames, getEvent, listEvents, listEventsForVendorAddition, matchSlotToVendorType, proposeSlotForVendorType, undoVendorAddition, type SlotMatchCatalog } from "@/modules/events/service";
import { getVendor, listVendorDocumentKinds, listVendorDocuments, listVendorFamilies, listVendorTypes, VendorNotFoundError } from "@/modules/vendors/service";
import type { AdditionChoices, AdditionRequest } from "@/app/prestataires/add-to-event-model";
import { addVendorsToEvent } from "./event-addition";

export type AdditionAccess = { organizationId: string; userId: string; viewer: NonNullable<AddVendorToEventSlotInput["viewer"]>; budgetEnabled: boolean };

export type AdditionOutcome =
  | { status: "added"; eventId: string; slotId: string; slotLabel: string; slotCreated: boolean; mode: AdditionRequest["mode"]; comparingCount: number; replacedName: string | null; vendorNames: string[]; eventLabel: string; undoId: string }
  // Poste déjà pourvu (P12) : la fenêtre propose « Remplacer {nom} » ou « Retenir aussi ».
  | { status: "choice_required"; retainedName: string }
  // Au-delà du seuil d'alerte de l'enveloppe : « Retenir quand même ? » (règle du lot 28a).
  | { status: "confirm_budget"; committedAfterCents: number; overThresholdCents: number; thresholdPercent: number }
  | { status: "not_found" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le catalogue du carnet pour la correspondance poste ↔ métier (73a, P7).
export async function slotMatchCatalog(organizationId: string): Promise<SlotMatchCatalog> {
  const [types, families] = await Promise.all([listVendorTypes(organizationId), listVendorFamilies(organizationId)]);
  return {
    types: types.map((type) => ({ id: type.id, label: type.label, starterKey: type.starterKey, familyId: type.familyId })),
    families: families.map((family) => ({ id: family.id, label: family.label })),
    synonyms: starterVendorTypeSynonyms(),
  };
}

async function eventLabels(organizationId: string): Promise<Map<string, string>> {
  const list = await listEvents({ organizationId, archived: "exclude" });
  return new Map(list.map((event) => [event.id, eventNames(event.clients, event.name) || event.venueName || ""]));
}

// Ce que la fenêtre propose : les mariages à venir (demandes comprises, le plus proche d'abord), leurs
// postes et le poste du métier principal ; la pièce qui expire avant le mariage. null : une fiche hors de
// l'organisation ou archivée (la fenêtre dit « introuvable », sans rien montrer).
export async function loadAdditionChoices(access: AdditionAccess, input: { vendorIds: string[]; today: string }): Promise<AdditionChoices | null> {
  const ids = [...new Set(input.vendorIds)].filter((id) => UUID.test(id));
  if (ids.length === 0 || ids.length !== new Set(input.vendorIds).size) return null;
  const vendors = await Promise.all(ids.map((id) => getVendor(access.organizationId, id)));
  if (vendors.some((vendor) => vendor === null || vendor.archived)) return null;
  const found = vendors.filter((vendor): vendor is NonNullable<typeof vendor> => vendor !== null);
  const single = found.length === 1 ? found[0]! : null;
  const [upcoming, labels, catalog, documents, kinds] = await Promise.all([
    listEventsForVendorAddition(access.organizationId, { today: input.today, viewer: access.viewer }),
    eventLabels(access.organizationId),
    slotMatchCatalog(access.organizationId),
    single ? listVendorDocuments(access.organizationId, single.id) : Promise.resolve([]),
    single ? listVendorDocumentKinds(access.organizationId) : Promise.resolve([]),
  ]);
  const primaryTypeId = single?.primaryTypeId ?? null;
  const tradeLabel = primaryTypeId ? (catalog.types.find((type) => type.id === primaryTypeId)?.label ?? null) : null;
  const shortLabel = new Map(kinds.map((kind) => [kind.id, kind.shortLabel ?? kind.label]));
  const dated = documents.filter((document) => document.validUntil !== null).sort((a, b) => a.validUntil!.localeCompare(b.validUntil!));
  return {
    vendors: found.map((vendor) => ({ id: vendor.id, name: vendor.name })),
    tradeLabel,
    events: upcoming.map((event) => {
      const lapsing = event.eventDate ? dated.find((document) => document.validUntil! < event.eventDate!) : undefined;
      return {
        eventId: event.eventId,
        label: labels.get(event.eventId) ?? "",
        eventDate: event.eventDate,
        status: event.status,
        slots: event.slots.map((slot) => ({ id: slot.id, label: slot.label, comparingCount: slot.comparingCount, retained: slot.retained.map((entry) => ({ candidateId: entry.candidateId, vendorName: entry.vendorName })) })),
        proposedSlotId: proposeSlotForVendorType(event.slots, primaryTypeId, catalog),
        documentWarning: lapsing ? { label: shortLabel.get(lapsing.kindId) ?? lapsing.kindLabel, validUntil: lapsing.validUntil! } : null,
      };
    }),
  };
}

// L'ajout lui-même (compare, retain, replace, retain_also ; « Nouveau poste » dans la même opération).
export async function addToEvent(access: AdditionAccess, request: AdditionRequest & { confirmed?: boolean }): Promise<AdditionOutcome> {
  try {
    const result = await addVendorsToEvent({
      organizationId: access.organizationId,
      userId: access.userId,
      eventId: request.eventId,
      ...(request.slotId ? { slotId: request.slotId } : {}),
      ...(request.newSlotLabel !== undefined ? { newSlotLabel: request.newSlotLabel } : {}),
      vendorIds: request.vendorIds,
      mode: request.mode,
      viewer: access.viewer,
      confirmed: request.confirmed ?? false,
      budgetEnabled: access.budgetEnabled,
    });
    if (result.status === "confirm_budget") return result;
    if (result.status === "choice_required") return { status: "choice_required", retainedName: result.retained.map((entry) => entry.vendorName).join(", ") };
    const [event, vendors] = await Promise.all([getEvent(access.organizationId, result.eventId), Promise.all([...new Set(request.vendorIds)].map((id) => getVendor(access.organizationId, id)))]);
    return {
      status: "added",
      eventId: result.eventId,
      slotId: result.slotId,
      slotLabel: result.slotLabel,
      slotCreated: result.slotCreated,
      mode: result.mode,
      comparingCount: result.comparingCount,
      replacedName: result.replaced?.vendorName ?? null,
      vendorNames: vendors.flatMap((vendor) => (vendor ? [vendor.name] : [])),
      eventLabel: event ? eventNames(event.clients, event.name) || event.venueName || "" : "",
      undoId: result.undoId,
    };
  } catch (error) {
    // RangeError : une demande mal formée (plusieurs fiches à retenir, libellé vide) ; jamais écrite.
    if (error instanceof VendorNotFoundError || error instanceof EventNotFoundError || error instanceof RangeError) return { status: "not_found" };
    throw error;
  }
}

// « Annuler » dans les dix secondes : par la même personne, dans la même organisation.
export async function undoAddition(access: AdditionAccess, undoId: string): Promise<boolean> {
  return undoVendorAddition({ organizationId: access.organizationId, userId: access.userId, undoId });
}

// Le carnet ouvert depuis un poste : filtré par le métier du poste, ou sa famille (une pastille nommée qui
// s'enlève) ; plus aucun lieu posé d'office (critère 8). Rien quand aucun métier ne lui correspond.
export type SlotBookQuery = { type: string; label: string } | { famille: string; label: string } | Record<string, never>;

export async function slotBookQueries(organizationId: string, slots: { id: string; label: string }[], catalog?: SlotMatchCatalog): Promise<Record<string, SlotBookQuery>> {
  const known = catalog ?? (await slotMatchCatalog(organizationId));
  return Object.fromEntries(
    slots.map((slot) => {
      const match = matchSlotToVendorType(slot.label, known);
      if (match?.kind === "type") return [slot.id, { type: match.typeId, label: known.types.find((type) => type.id === match.typeId)?.label ?? "" }];
      if (match?.kind === "family") return [slot.id, { famille: match.familyId, label: known.families.find((family) => family.id === match.familyId)?.label ?? "" }];
      return [slot.id, {}];
    }),
  );
}

// L'adresse du carnet filtré pour un poste.
export function slotBookHref(eventId: string, slotId: string, query: SlotBookQuery | undefined): string {
  const params = new URLSearchParams({ evenement: eventId, poste: slotId });
  if (query && "type" in query) params.set("type", query.type);
  if (query && "famille" in query) params.set("famille", query.famille);
  return `/prestataires?${params.toString()}`;
}
