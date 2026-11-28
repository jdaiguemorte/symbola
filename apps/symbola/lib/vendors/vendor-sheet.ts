// Lot 73d (PRE-01, PRE-02, PRE-05, SEC-10 à SEC-13 ; spécification du lot 73, § 5.4, critères 1, 5 et 10 ;
// V10, V11, P4, C-46) — la création d'une fiche, la même au carnet et depuis un poste du budget, et les
// pièces demandées d'un geste sur une fiche neuve. L'app passe par le service.ts de chaque module
// (ARC-01) : le module Prestataires n'écrit jamais dans le schéma des évènements ni du budget.
//
// Depuis un poste, le poste est vérifié AVANT de créer la fiche (mariage à venir, de l'organisation et, pour
// une Planner restreinte, de son équipe) : un poste hors de portée ne laisse pas de fiche orpheline et
// répond « introuvable », comme un poste qui n'existe pas (SEC-13). L'ajout passe ensuite par le même
// geste que « Ajouter à un mariage… » (73c) : « En comparaison » ou « Retenu », le seuil d'alerte du budget
// et, sur un poste déjà pourvu, « Remplacer {nom} » ou « Retenir aussi » (P12).
import { eventNames, getEvent, listEventsForVendorAddition, proposeVendorTypeForSlot, vendorHasOpenLink } from "@/modules/events/service";
import {
  createVendor,
  getVendor,
  listVendorDocuments,
  removeVendorDocument,
  requestUsualVendorDocuments,
  VendorNotFoundError,
  type SaveVendorResult,
  type VendorInput,
} from "@/modules/vendors/service";
import { addToEvent, slotMatchCatalog, type AdditionAccess, type AdditionOutcome } from "./add-to-event";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SlotCreationContext = { eventId: string; slotId: string; slotLabel: string; eventLabel: string; proposedTypeId: string | null };

// Le poste d'où la fenêtre s'ouvre : son nom, celui du mariage (« Pour le poste « Transport » de Léa &
// Maxime ») et le métier proposé d'après le poste (73a, P7). null : hors de portée.
export async function slotCreationContext(access: AdditionAccess, input: { eventId: string; slotId: string; today: string }): Promise<SlotCreationContext | null> {
  if (!UUID.test(input.eventId) || !UUID.test(input.slotId)) return null;
  const upcoming = await listEventsForVendorAddition(access.organizationId, { today: input.today, viewer: access.viewer });
  const slot = upcoming.find((event) => event.eventId === input.eventId)?.slots.find((entry) => entry.id === input.slotId);
  if (!slot) return null;
  const [event, catalog] = await Promise.all([getEvent(access.organizationId, input.eventId), slotMatchCatalog(access.organizationId)]);
  return {
    eventId: input.eventId,
    slotId: input.slotId,
    slotLabel: slot.label,
    eventLabel: event ? eventNames(event.clients, event.name) || event.venueName || "" : "",
    proposedTypeId: proposeVendorTypeForSlot(slot.label, catalog),
  };
}

export type CreateVendorRecordOutcome =
  | { status: "created"; result: SaveVendorResult }
  | { status: "created_and_added"; result: SaveVendorResult; addition: Extract<AdditionOutcome, { status: "added" }> }
  // La fiche est créée ; l'ajout attend une réponse (seuil du budget, poste déjà pourvu) : la fenêtre la
  // demande, puis ajoute cette fiche par « Ajouter à un mariage… ».
  | { status: "created_pending"; result: SaveVendorResult; addition: Extract<AdditionOutcome, { status: "choice_required" | "confirm_budget" }> }
  | { status: "not_found" };

export async function createVendorRecord(
  access: AdditionAccess,
  input: { vendor: VendorInput; slot?: { eventId: string; slotId: string; mode: "compare" | "retain"; today: string } },
): Promise<CreateVendorRecordOutcome> {
  if (input.slot && !(await slotCreationContext(access, input.slot))) return { status: "not_found" };
  const result = await createVendor(access.organizationId, input.vendor);
  if (!input.slot) return { status: "created", result };
  const addition = await addToEvent(access, { eventId: input.slot.eventId, slotId: input.slot.slotId, vendorIds: [result.vendor.id], mode: input.slot.mode });
  if (addition.status === "added") return { status: "created_and_added", result, addition };
  if (addition.status === "not_found") return { status: "created", result };
  return { status: "created_pending", result, addition };
}

// « Demander au prestataire » : la demande arrive sur son lien de prestataire ; sans lien ouvert, elle
// l'attendra (la fenêtre le dit).
export async function vendorRequestReach(organizationId: string, vendorId: string): Promise<"link" | "waiting"> {
  return (await vendorHasOpenLink(organizationId, vendorId)) ? "link" : "waiting";
}

// P4, critère 10 : les pièces demandées d'habitude, d'un geste ; rend les pièces demandées (pour le message
// « 2 pièces demandées à {nom} » et son « Annuler »).
export async function requestUsualDocuments(organizationId: string, vendorId: string, now?: Date): Promise<{ vendorName: string; documentIds: string[] }> {
  const vendor = await getVendor(organizationId, vendorId);
  if (!vendor || vendor.archived) throw new VendorNotFoundError();
  const requested = await requestUsualVendorDocuments({ organizationId, vendorId, ...(now ? { now } : {}) });
  return { vendorName: vendor.name, documentIds: requested.map((document) => document.id) };
}

// « Annuler » : retire les demandes faites par ce geste qui attendent encore (jamais une pièce déjà
// déposée par le prestataire). Rend le nombre retiré.
export async function undoRequestedDocuments(organizationId: string, vendorId: string, documentIds: string[]): Promise<number> {
  const wanted = new Set(documentIds.filter((id) => UUID.test(id)));
  if (wanted.size === 0) return 0;
  const documents = await listVendorDocuments(organizationId, vendorId);
  const removable = documents.filter((document) => wanted.has(document.id) && document.status === "requested" && document.fileName === null);
  for (const document of removable) await removeVendorDocument(organizationId, document.id);
  return removable.length;
}
