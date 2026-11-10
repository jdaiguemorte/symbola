// Lot 11 (PRE-04 à PRE-07, PRE-11) — sélection courante du carnet,
// commune à l'écran et à l'export : filtres de l'URL, centre du cercle
// (une fiche du carnet ou une adresse géocodée), résultats triés.
import { getEvent, listEventVendorSlots } from "@/modules/events/service";
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
import { parseBookFilters, toFindInput, type BookFilters, type BookQuery } from "./filters";

export type BookSelection = {
  // Lot 16 (PRE-14) : familles de l'organisation, dans leur ordre.
  families: VendorFamily[];
  types: VendorType[];
  tags: VendorTag[];
  tagGroups: VendorTagGroup[];
  filters: BookFilters;
  center: { latitude: number; longitude: number; label: string } | null;
  centerNotFound: boolean;
  results: VendorListItem[];
  // Contexte « Ajouter au poste » (venu d'un poste de la fiche événement).
  target: { eventId: string; slotId: string; slotLabel: string; eventLabel: string } | null;
};

const VENDOR_REFERENCE = /^fiche:([0-9a-f-]{36})$/i;

export async function loadBookSelection(organizationId: string, query: BookQuery): Promise<BookSelection> {
  const [families, types, tags, tagGroups] = await Promise.all([
    listVendorFamilies(organizationId),
    listVendorTypes(organizationId),
    listVendorTags(organizationId),
    listVendorTagGroups(organizationId),
  ]);
  const filters = parseBookFilters(query, types);

  let target: BookSelection["target"] = null;
  let aroundText = filters.aroundText;
  if (filters.eventId && filters.slotId) {
    const [event, slots] = await Promise.all([getEvent(organizationId, filters.eventId), listEventVendorSlots(organizationId, filters.eventId)]);
    const slot = slots.find((candidate) => candidate.id === filters.slotId);
    if (event && slot) {
      target = {
        eventId: event.id,
        slotId: slot.id,
        slotLabel: slot.label,
        eventLabel: event.clients.map((client) => client.firstName).join(" & ") || event.venueName || "",
      };
      // Sans centre choisi : autour du lieu de l'événement.
      if (!aroundText && (event.venueName || event.venueCity)) aroundText = [event.venueName, event.venueCity].filter(Boolean).join(" ");
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

  const results = await findVendors(toFindInput(organizationId, { ...filters, aroundText }, center));
  return { families, types, tags, tagGroups, filters: { ...filters, aroundText }, center, centerNotFound, results, target };
}
