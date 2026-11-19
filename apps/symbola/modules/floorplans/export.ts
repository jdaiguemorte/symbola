// Lot 60 (HUB-13, DAT-13, ADR 0068) — entités du module Plans de salle dans l'export complet de
// l'organisation (contrat export/v1). Les fonds de plan sont des fichiers : l'export en garde la
// référence (type, taille), comme les autres pièces. Les lignes d'un évènement d'essai sont exclues.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { eraseOrganizationSchema } from "@symbola/db/erase";
import { clearModuleImportTargets, importModuleEntities, registerModuleImportIds } from "@symbola/db/import";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import { elementTypes, layoutElements, layoutVersions, layouts, powerLinks, spaceFixtures, spaces } from "@symbola/db/schema/floorplans";

export const FLOORPLANS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: elementTypes },
  { table: spaces, eventField: "eventId", files: ["backgroundKey"] },
  { table: spaceFixtures, parents: { spaceId: "spaces" } },
  { table: layouts, eventField: "eventId", parents: { spaceId: "spaces" } },
  { table: layoutElements, parents: { layoutId: "layouts" } },
  { table: powerLinks, parents: { elementId: "layout_elements", fixtureId: "space_fixtures" } },
  { table: layoutVersions, files: ["backgroundKey"], parents: { layoutId: "layouts" } },
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


// Lot 35b (HUB-13, ADR 0098) : reprise d'une archive dans une organisation vide (transaction de la
// reprise). Les identifiants du lieu, de l'évènement, du prestataire retenu et du lien suivent par la
// table de correspondance commune ; les fonds de plan reçoivent leur nouvelle clé de stockage.
export function registerFloorplansImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(FLOORPLANS_EXPORT_ENTITIES, rows, context);
}

export async function importFloorplansData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: FLOORPLANS_EXPORT_ENTITIES });
  return { module: "floorplans", entities: await importModuleEntities(tx, { specs: FLOORPLANS_EXPORT_ENTITIES, rows, context }) };
}

// Lot 35c (RGP-11, D8, ADR 0100) : effacement de toutes les lignes du module d'une organisation fermée,
// à sa date de suppression (la base le refuse avant) ; fonds de plan effacés par l'orchestrateur.
export function eraseFloorplansData(tx: OrganizationTransaction, organizationId: string): Promise<number> {
  return eraseOrganizationSchema(tx, organizationId, "floorplans");
}
