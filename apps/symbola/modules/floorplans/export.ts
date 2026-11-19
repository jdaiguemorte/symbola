// Lot 60 (HUB-13, DAT-13, ADR 0068) — entités du module Plans de salle dans l'export complet de
// l'organisation (contrat export/v1). Les fonds de plan sont des fichiers : l'export en garde la
// référence (type, taille), comme les autres pièces. Les lignes d'un évènement d'essai sont exclues.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { elementTypes, layoutElements, layoutVersions, layouts, powerLinks, spaceFixtures, spaces } from "@symbola/db/schema/floorplans";

export const FLOORPLANS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: elementTypes },
  { table: spaces, eventField: "eventId", files: ["backgroundKey"] },
  { table: spaceFixtures, parents: { spaceId: "spaces" } },
  { table: layouts, eventField: "eventId", parents: { spaceId: "spaces" } },
  { table: layoutElements, parents: { layoutId: "layouts" } },
  { table: powerLinks, parents: { elementId: "layout_elements", fixtureId: "space_fixtures" } },
  { table: layoutVersions, parents: { layoutId: "layouts" } },
];

export const FLOORPLANS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  link_views: "dernière version vue par un lien de prestataire ou de client : sert seulement à signaler une version nouvelle, sans usage hors de Symbola",
};

export function exportFloorplansData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "floorplans", context, specs: FLOORPLANS_EXPORT_ENTITIES });
}

export function describeFloorplansExport(): ExportEntitySchema[] {
  return describeModuleEntities("floorplans", FLOORPLANS_EXPORT_ENTITIES);
}

