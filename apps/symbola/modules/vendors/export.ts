// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du carnet de prestataires dans l'export complet
// de l'organisation (contrat export/v1) : familles, types et leurs champs, étiquettes, fiches et
// leurs fichiers, réglages des trajets. Les fiches d'essai sont exclues. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import {
  vendorFamilies,
  vendorFiles,
  vendors,
  vendorSettings,
  vendorTagGroups,
  vendorTags,
  vendorTypeFields,
  vendorTypes,
} from "@symbola/db/schema/vendors";

export const VENDORS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: vendorFamilies },
  { table: vendorTypes },
  { table: vendorTypeFields, parents: { typeId: "vendor_types" } },
  { table: vendorTagGroups },
  { table: vendorTags },
  { table: vendors, demoField: "isDemo" },
  { table: vendorFiles, parents: { vendorId: "vendors" }, files: ["fileKey"] },
  { table: vendorSettings, idField: "organizationId" },
];

// Toutes les tables du module sont exportées.
export const VENDORS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {};

export function exportVendorsData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "vendors", context, specs: VENDORS_EXPORT_ENTITIES });
}

export function describeVendorsExport(): ExportEntitySchema[] {
  return describeModuleEntities("vendors", VENDORS_EXPORT_ENTITIES);
}
