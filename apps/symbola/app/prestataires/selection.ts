// Lot 11 (L11-PRE-04 à L11-PRE-07, L11-PRE-11) — sélection courante du carnet,
// commune à l'écran et à l'export : filtres de l'URL, centre du cercle
// (une fiche du carnet ou une adresse géocodée), résultats triés.
import { ENGAGED_CANDIDATE_STATUSES } from "@symbola/contracts";
import { getEvent, listEventVendorSlots, listVendorCandidates, eventNames } from "@/modules/events/service";
import {
  findVendors,
  geocodeAddress,
  getVendor,
  listVendorFamilies,
  listVendorTagGroups,
  listVendorTags,
  listVendorTypes,
  type VendorFamily,
  type VendorListItem,
  type VendorTag,
  type VendorTagGroup,
  type VendorType,
} from "@/modules/vendors/service";
import { importFilterOf, type ImportFilter } from "@/lib/import/imported-elements";
import { parseBookFilters, toFindInput, type BookFilters, type BookQuery } from "./filters";

export type BookSelection = {
  // Lot 16 (L16-PRE-14) : familles de l'organisation, dans leur ordre.
  families: VendorFamily[];
  types: VendorType[];
  tags: VendorTag[];
  tagGroups: VendorTagGroup[];
  filters: BookFilters;
  center: { latitude: number; longitude: number; label: string } | null;
  centerNotFound: boolean;
  results: VendorListItem[];
  // Contexte « Ajouter à ce poste… » (venu d'un poste du budget d'un mariage). Lot 73c : les fiches déjà
  // sur ce poste (« Dans la comparaison », « Retenu »).
  target: { eventId: string; slotId: string; slotLabel: string; eventLabel: string; onSlot: Map<string, "compared" | "retained"> } | null;
  // Lot 63b (HUB-14) : la liste filtrée sur un import (« Vérifier les N prestataires »).
  importFilter: ImportFilter | null;
};

const VENDOR_REFERENCE = /^fiche:([0-9a-f-]{36})$/i;

// Lot 73b : options.ids, l'export de la sélection (seulement ces fiches).
export async function loadBookSelection(organizationId: string, query: BookQuery, options: { ids?: string[] } = {}): Promise<BookSelection> {
  const [families, types, tags, tagGroups] = await Promise.all([
    listVendorFamilies(organizationId),
    listVendorTypes(organizationId),
    listVendorTags(organizationId),
    listVendorTagGroups(organizationId),
  ]);
  const filters = parseBookFilters(query, types);

  let target: BookSelection["target"] = null;
  // Lot 73c (critère 8) : depuis un poste, plus aucun lieu posé d'office ; le carnet est filtré par le
  // métier ou la famille du poste, dans l'adresse (une pastille qui s'enlève, posée par le budget).
  const aroundText = filters.aroundText;
  if (filters.eventId && filters.slotId) {
    const [event, slots, candidates] = await Promise.all([getEvent(organizationId, filters.eventId), listEventVendorSlots(organizationId, filters.eventId), listVendorCandidates(organizationId, filters.eventId)]);
    const slot = slots.find((candidate) => candidate.id === filters.slotId);
    if (event && slot) {
      target = {
        eventId: event.id,
        slotId: slot.id,
        slotLabel: slot.label,
        eventLabel: eventNames(event.clients, event.name) || event.venueName || "",
        onSlot: new Map(
          candidates
            .filter((candidate) => candidate.vendorSlotId === slot.id && candidate.vendorId !== null && candidate.status !== "dismissed")
            .map((candidate) => [candidate.vendorId!, ENGAGED_CANDIDATE_STATUSES.includes(candidate.status) ? ("retained" as const) : ("compared" as const)]),
        ),
      };
    }
  }

  let center: BookSelection["center"] = null;
  let centerNotFound = false;
  if (aroundText) {
    const reference = VENDOR_REFERENCE.exec(aroundText);
    if (reference) {
      const vendor = await getVendor(organizationId, reference[1]!);
      if (vendor?.location) center = { latitude: vendor.location.latitude, longitude: vendor.location.longitude, label: vendor.name };
    } else {
      const point = await geocodeAddress(aroundText);
      if (point) center = { ...point, label: aroundText };
    }
    centerNotFound = center === null;
  }

  const importFilter = await importFilterOf(organizationId, query, "vendor");
  const ids = options.ids && importFilter ? options.ids.filter((id) => importFilter.ids.includes(id)) : (options.ids ?? importFilter?.ids);
  const results = await findVendors({ ...toFindInput(organizationId, { ...filters, aroundText }, center), ...(ids ? { ids } : {}) });
  return { families, types, tags, tagGroups, filters: { ...filters, aroundText }, center, centerNotFound, results, target, importFilter };
}
