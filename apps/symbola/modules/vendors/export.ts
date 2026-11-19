// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du carnet de prestataires dans l'export complet
// de l'organisation (contrat export/v1) : familles, types et leurs champs, étiquettes, fiches et
// leurs fichiers, réglages des trajets. Les fiches d'essai sont exclues. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { clearModuleImportTargets, importModuleEntities, registerModuleImportIds } from "@symbola/db/import";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import {
  vendorBankChanges,
  vendorDocumentKinds,
  vendorDocuments,
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
  // Lot 48a (DAT-08, ADR 0093) : IBAN, BIC et note confidentielle chiffrés restent dans Symbola
  // (l'IBAN masqué sort) ; comme les régimes du lot 49, ils ne voyagent pas dans un fichier.
  { table: vendors, demoField: "isDemo", omit: ["internalNoteSealed", "ibanSealed", "bicSealed"] },
  { table: vendorFiles, parents: { vendorId: "vendors" }, files: ["fileKey"] },
  { table: vendorSettings, idField: "organizationId" },
  // Lot 48a (PRE-05, PRE-10) : natures de pièces, pièces (fichiers compris), journal des IBAN masqués.
  { table: vendorDocumentKinds },
  { table: vendorDocuments, parents: { vendorId: "vendors", kindId: "vendor_document_kinds" }, files: ["fileKey"] },
  { table: vendorBankChanges, parents: { vendorId: "vendors" } },
];

// Toutes les tables du module sont exportées.
export const VENDORS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {};

export function exportVendorsData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "vendors", context, specs: VENDORS_EXPORT_ENTITIES });
}

export function describeVendorsExport(): ExportEntitySchema[] {
  return describeModuleEntities("vendors", VENDORS_EXPORT_ENTITIES);
}

// Lot 35b (HUB-13, ADR 0098) : reprise d'une archive dans une organisation vide (transaction de la
// reprise) ; les réglages de départ et les essais de l'organisation sont remplacés par ceux de l'archive.
export function registerVendorsImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(VENDORS_EXPORT_ENTITIES, rows, context);
}

export async function importVendorsData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: VENDORS_EXPORT_ENTITIES });
  return { module: "vendors", entities: await importModuleEntities(tx, { specs: VENDORS_EXPORT_ENTITIES, rows, context }) };
}
