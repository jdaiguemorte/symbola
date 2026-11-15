// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du module Budget dans l'export complet de
// l'organisation (contrat export/v1), dans l'ordre de leurs dépendances. Ce qui se rattache à un
// événement d'essai est exclu. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import {
  alertThresholds,
  allocationModelItems,
  allocationModels,
  budgetLineAttachments,
  budgetLineHistory,
  budgetLines,
  eventBudgetItems,
  eventBudgets,
  vendorPayments,
} from "@symbola/db/schema/budget";

const ofEvent = { eventField: "eventId" } as const;

export const BUDGET_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  { table: allocationModels },
  { table: allocationModelItems, parents: { modelId: "allocation_models" } },
  // Seuil d'alerte de l'organisation (sans événement) ou d'un événement.
  { table: alertThresholds, ...ofEvent },
  { table: eventBudgets, ...ofEvent },
  { table: eventBudgetItems, parents: { eventBudgetId: "event_budgets" } },
  { table: budgetLines, ...ofEvent },
  { table: budgetLineHistory, parents: { lineId: "budget_lines" } },
  { table: budgetLineAttachments, parents: { lineId: "budget_lines" }, files: ["fileKey"] },
  { table: vendorPayments, ...ofEvent, parents: { lineId: "budget_lines" } },
];

// Toutes les tables du module sont exportées.
export const BUDGET_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {};

export function exportBudgetData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "budget", context, specs: BUDGET_EXPORT_ENTITIES });
}

export function describeBudgetExport(): ExportEntitySchema[] {
  return describeModuleEntities("budget", BUDGET_EXPORT_ENTITIES);
}
