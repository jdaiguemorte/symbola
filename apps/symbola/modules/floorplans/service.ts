// Porte d'entrée publique du module floorplans (lot 60, ADR 0011 et 0099) — seul fichier que les
// autres modules, lib/ et les écrans peuvent importer. Pensé comme le futur contrat HTTP
// /v1/floorplans si le module est extrait. Le module est fermé par défaut (ADR 0079) : sans lui, les
// écrans répondent « indisponible », jamais une erreur (ARC-07).
import { parisToday } from "@symbola/i18n";
import { renderFloorplanPdf, type FloorplanPdfFile } from "./floorplan-render";
import { getLayoutEditor, removeLayout, retainedCandidates, seatingTablesOf } from "./layouts";
import { floorplansForLink, sharedFloorplanBackground, type FloorplanLinkAccess } from "./sharing";
import { getSpaceBackground, removeSpace } from "./spaces";
import { FloorplanNotFoundError } from "./errors";
import { inOrganization, findLayout } from "./repository";
import { getVendor } from "@/modules/vendors/service";
import { createSeatingPlan, importSeatingTables } from "@/modules/guests/service";

export { FloorplanInvalidError, FloorplanNotFoundError, FloorplanStaleError, type FloorplanProblem } from "./errors";
export { addElementType, listElementTypes, setElementTypeHidden, typeLabel, updateElementType, type FloorplanLocale } from "./library";
export {
  calibrateSpace,
  createVenueSpace,
  FLOORPLAN_BACKGROUND_MAX_BYTES,
  getSpace,
  getSpaceBackground,
  listVenueSpaces,
  removeSpaceBackground,
  saveFixtures,
  setSpaceBackground,
  updateSpace,
  venuesWithLayouts,
} from "./spaces";
export {
  copyVenueLayoutToEvent,
  createEventSpace,
  createLayout,
  duplicateLayout,
  getLayoutEditor,
  listEventFloorplans,
  listLayoutVersions,
  publishEventLayout,
  renameLayout,
  retainedCandidates,
  saveEventLayoutToVenue,
  saveLayoutElements,
  setShowVendorNames,
  type EventFloorplans,
} from "./layouts";
export { floorplansForLink, sharedFloorplanBackground, unseenFloorplanVersions, type FloorplanLinkAccess } from "./sharing";
export { backgroundSize, capacityOf, checkLayout, powerTable, proposeSeats } from "./geometry";
export { floorplansPrivacy } from "./privacy";
export { describeFloorplansExport, exportFloorplansData, FLOORPLANS_EXPORT_EXCLUSIONS } from "./export";
export { removeEventFloorplansData } from "./removal";
export type { FloorplanPdfFile };

// Un plan retiré ; l'espace d'un évènement resté sans plan part avec lui (et son fond de plan, s'il
// ne sert plus).
export async function removeFloorplanLayout(organizationId: string, layoutId: string): Promise<void> {
  const { emptiedEventSpaceId } = await removeLayout(organizationId, layoutId);
  if (emptiedEventSpaceId) await removeSpace(organizationId, emptiedEventSpaceId);
}

export { removeSpace as removeFloorplanSpace } from "./spaces";

async function backgroundData(load: () => Promise<{ data: Uint8Array }>): Promise<Uint8Array | null> {
  try {
    return (await load()).data;
  } catch (error) {
    if (error instanceof FloorplanNotFoundError) return null;
    throw error;
  }
}

// PDF à l'échelle du plan en cours, pour la planner : les notes internes n'y figurent pas.
export async function downloadLayoutPdf(organizationId: string, layoutId: string, locale: "fr" | "en", now: Date = new Date()): Promise<FloorplanPdfFile> {
  const view = await getLayoutEditor(organizationId, layoutId);
  const venue = view.space.vendorId ? await getVendor(organizationId, view.space.vendorId) : null;
  const names = new Map(view.layout.eventId ? (await retainedCandidates(organizationId, view.layout.eventId)).map((candidate) => [candidate.id, candidate.vendorName]) : []);
  return renderFloorplanPdf({
    locale,
    venueName: venue?.name ?? null,
    spaceName: view.space.name,
    layoutName: view.layout.name,
    version: view.layout.eventId && view.layout.publishedVersion > 0 ? view.layout.publishedVersion : null,
    date: parisToday(now),
    space: view.space,
    backgroundData: view.space.background ? await backgroundData(() => getSpaceBackground(organizationId, view.space.id)) : null,
    fixtures: view.fixtures,
    elements: view.layout.elements.map((element) => ({ ...element, vendorName: element.vendorCandidateId ? (names.get(element.vendorCandidateId) ?? null) : null, mine: false })),
    power: view.power,
  });
}

// PDF de la version diffusée, pour un lien (prestataire : son emplacement en évidence).
export async function downloadSharedFloorplanPdf(access: FloorplanLinkAccess, layoutId: string, locale: "fr" | "en", now: Date = new Date()): Promise<FloorplanPdfFile> {
  const view = (await floorplansForLink(access, { markSeen: false })).find((entry) => entry.layoutId === layoutId);
  if (!view) throw new FloorplanNotFoundError();
  return renderFloorplanPdf({
    locale,
    venueName: null,
    spaceName: view.space.name,
    layoutName: view.layoutName,
    version: view.version,
    date: parisToday(now),
    space: view.space,
    backgroundData: view.space.background ? await backgroundData(() => sharedFloorplanBackground(access, layoutId)) : null,
    fixtures: view.fixtures,
    elements: view.elements,
    power: view.power,
  });
}

// D7 : « Créer les tables du plan de table » — les tables du plan de salle copiées une fois dans le
// plan de table d'un temps fort (lot 50), par le service du module Invités.
export async function copyLayoutTablesToSeating(organizationId: string, eventId: string, layoutId: string, keyMomentId: string, defaultName: (index: number) => string): Promise<{ added: number; skipped: number }> {
  const tables = await seatingTablesOf(organizationId, layoutId, eventId, defaultName);
  const planId = await createSeatingPlan(organizationId, eventId, keyMomentId);
  return importSeatingTables(organizationId, eventId, planId, tables);
}

// Le plan désigné appartient-il à cet évènement (ou à un lieu, pour eventId nul) ?
export async function layoutBelongsTo(organizationId: string, layoutId: string, eventId: string | null): Promise<boolean> {
  const layout = await inOrganization(organizationId, (tx) => findLayout(tx, layoutId));
  return Boolean(layout) && layout!.eventId === eventId;
}

