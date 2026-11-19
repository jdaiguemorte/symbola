// Lot 49 (HUB-13, DAT-13, ADR 0068) — entités du module Invités dans l'export complet de
// l'organisation (contrat export/v1). Les régimes (chiffrés, données de santé) et les empreintes des
// liens ne sortent pas ; une archive qui contient des foyers est supprimée à la purge des invités de
// l'évènement (RGP-08). Les lignes d'un évènement d'essai sont exclues. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext, ModuleImportContext, ModuleImportResult, ModuleImportRows } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import { clearModuleImportTargets, importModuleEntities, registerModuleImportIds } from "@symbola/db/import";
import type { OrganizationTransaction } from "@symbola/db/with-organization";
import { catererSummaryDownloads, dietaryOptions, dietConsents, eventSettings, guestImports, guests, householdGroups, households, mealTypes, moduleSettings, purgePostponements, rsvpAnswers, seatAssignments, seatingPlans, seatingTables, vendorMealCounts } from "@symbola/db/schema/guests";

const ofEvent = { eventField: "eventId" } as const;

export const GUESTS_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: moduleSettings, idField: "organizationId" },
  { table: dietaryOptions },
  { table: mealTypes },
  { table: eventSettings, ...ofEvent },
  { table: householdGroups, ...ofEvent },
  { table: guestImports, ...ofEvent },
  { table: households, ...ofEvent },
  { table: guests, ...ofEvent, parents: { householdId: "households" } },
  { table: rsvpAnswers, parents: { guestId: "guests" } },
  { table: dietConsents, ...ofEvent },
  { table: purgePostponements, ...ofEvent },
  // Lot 50 : plan de table (sans les contraintes), repas prestataires, traces des téléchargements.
  { table: seatingPlans, ...ofEvent },
  { table: seatingTables, parents: { planId: "seating_plans" } },
  { table: seatAssignments, parents: { planId: "seating_plans", guestId: "guests" } },
  { table: vendorMealCounts, ...ofEvent },
  { table: catererSummaryDownloads, ...ofEvent },
];

export const GUESTS_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  diets: "régimes et allergies des invités, chiffrés au niveau du champ (données de santé, article 9) : ils restent dans Symbola, réservés à la titulaire, et sont purgés sept jours après l'évènement",
  guest_links: "empreintes des jetons des liens personnels des invités : sans usage hors de Symbola",
  seating_constraints: "contraintes de placement « ensemble » et « séparés » : données internes de l'organisation, jamais exportées (lot 50, D4)",
  seating_constraint_members: "personnes d'une contrainte de placement : données internes de l'organisation, jamais exportées (lot 50, D4)",
};

export function exportGuestsData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "guests", context, specs: GUESTS_EXPORT_ENTITIES });
}

export function describeGuestsExport(): ExportEntitySchema[] {
  return describeModuleEntities("guests", GUESTS_EXPORT_ENTITIES);
}

// Lot 35b (HUB-13, ADR 0098) : reprise d'une archive dans une organisation vide (transaction de la
// reprise) ; les réglages de départ et les essais de l'organisation sont remplacés par ceux de l'archive.
export function registerGuestsImportIds(rows: ModuleImportRows, context: ModuleImportContext): void {
  registerModuleImportIds(GUESTS_EXPORT_ENTITIES, rows, context);
}

export async function importGuestsData(tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext): Promise<ModuleImportResult> {
  await clearModuleImportTargets(tx, { organizationId: context.organizationId, specs: GUESTS_EXPORT_ENTITIES });
  return { module: "guests", entities: await importModuleEntities(tx, { specs: GUESTS_EXPORT_ENTITIES, rows, context }) };
}
