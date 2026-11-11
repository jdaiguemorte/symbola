// IMP-03 — éléments existants auxquels une ligne importée peut être
// rapprochée, lus par le service.ts de chaque module (ADR 0011, 0022). Les
// événements d'essai (ADR 0008) ne sont jamais proposés.
import type { ImportEntityType } from "@symbola/contracts";
import type { PersonName } from "@symbola/import-engine";
import {
  listDefaultVendorSlots,
  listEvents,
  listEventTasks,
  listEventVendorSlots,
  listLossReasons,
  listProspectSources,
} from "@/modules/events/service";
import { listCatalogItems, listPaymentMethods } from "@/modules/quotes/service";
import { listVendorImportCandidates, listVendorTypes } from "@/modules/vendors/service";

export type EventCandidate = { id: string; eventDate: string | null; clients: PersonName[] };
export type LabelCandidate = { id: string; label: string };

export async function listEventCandidates(organizationId: string): Promise<EventCandidate[]> {
  const events = await listEvents({ organizationId });
  return events
    .filter((event) => !event.isDemo)
    .map((event) => ({
      id: event.id,
      eventDate: event.eventDate,
      clients: event.clients.map((client) => ({ firstName: client.firstName, lastName: client.lastName })),
    }));
}

// Éléments rapprochables par leur intitulé, pour les types sans événement.
export async function listLabelCandidates(organizationId: string, entityType: ImportEntityType): Promise<LabelCandidate[]> {
  switch (entityType) {
    case "catalog_items":
      return (await listCatalogItems(organizationId)).map(({ id, label }) => ({ id, label }));
    case "payment_methods":
      return (await listPaymentMethods(organizationId)).map(({ id, label }) => ({ id, label }));
    case "prospect_sources":
      return (await listProspectSources(organizationId)).map(({ id, label }) => ({ id, label }));
    case "loss_reasons":
      return (await listLossReasons(organizationId)).map(({ id, label }) => ({ id, label }));
    case "vendor_slots":
      return (await listDefaultVendorSlots(organizationId)).map(({ id, label }) => ({ id, label }));
    default:
      return [];
  }
}

// Éléments d'un événement : ses tâches, ou ses postes (une ligne de budget
// est portée par un poste prestataire, PRD-BUD-02).
export async function listEventItemCandidates(
  organizationId: string,
  entityType: "tasks" | "budget_lines",
  eventId: string,
): Promise<LabelCandidate[]> {
  const items = entityType === "tasks" ? await listEventTasks(organizationId, eventId) : await listEventVendorSlots(organizationId, eventId);
  return items.map(({ id, label }) => ({ id, label }));
}

// Lot 14 (IMP-07) — fiches du carnet (hors exemples et archives) et types.
export type VendorCandidate = { id: string; name: string; city: string | null };

export async function listVendorCandidates(organizationId: string): Promise<VendorCandidate[]> {
  return listVendorImportCandidates(organizationId);
}

export async function listVendorTypeCandidates(organizationId: string): Promise<LabelCandidate[]> {
  return (await listVendorTypes(organizationId)).map(({ id, label }) => ({ id, label }));
}
