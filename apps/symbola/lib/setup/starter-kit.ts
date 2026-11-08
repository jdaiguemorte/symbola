// Lot 12 (ONB-03) — paramètres de départ chargés d'office selon le métier,
// à l'étape 1 de l'assistant : lignes du budget (avec icônes), sources,
// motifs de perte, modèles de rétroplanning et de programme, répartition du
// budget, types de prestataires. Une liste déjà remplie n'est jamais
// touchée : on n'ajoute que là où l'organisation n'a encore rien.
// Orchestration entre modules, par leurs service.ts (ADR 0011).
import {
  starterAllocation,
  starterBudgetLines,
  starterLossReasons,
  starterProgram,
  starterProspectSources,
  starterRetroplanning,
  type StarterLocale,
  type StarterMetier,
} from "@symbola/starter-templates";
import { createAppConnection } from "@symbola/db/client";
import {
  addDefaultVendorSlots,
  addLossReasons,
  addProspectSources,
  createProgramTemplate,
  createTaskTemplate,
  listDefaultVendorSlots,
  listLossReasons,
  listProgramTemplates,
  listProspectSources,
  listTaskTemplates,
} from "@/modules/events/service";
import { createAllocationModel, listAllocationModels } from "@/modules/budget/service";
import { seedStarterVendorCatalog } from "@/modules/vendors/service";
import { vendorCatalogInput } from "@/lib/vendors/catalog";
import { isModuleEnabled, type ModuleKey } from "@/modules/hub/service";

export type StarterKitResult = { budgetLines: number; sources: number; lossReasons: number; taskTemplate: boolean; programTemplate: boolean; allocation: boolean; vendorTypes: number };

async function enabled(organizationId: string): Promise<Record<ModuleKey, boolean>> {
  const { sql, db } = createAppConnection();
  try {
    const keys: ModuleKey[] = ["hello", "events", "budget", "quotes", "vendors"];
    const values = await Promise.all(keys.map((key) => isModuleEnabled(db, organizationId, key)));
    return Object.fromEntries(keys.map((key, index) => [key, values[index]!])) as Record<ModuleKey, boolean>;
  } finally {
    await sql.end();
  }
}

export async function loadStarterKit(organizationId: string, metier: StarterMetier, locale: StarterLocale): Promise<StarterKitResult> {
  const modules = await enabled(organizationId);
  const result: StarterKitResult = { budgetLines: 0, sources: 0, lossReasons: 0, taskTemplate: false, programTemplate: false, allocation: false, vendorTypes: 0 };
  if (!modules.events) return result;

  if ((await listDefaultVendorSlots(organizationId)).length === 0) {
    result.budgetLines = (await addDefaultVendorSlots(organizationId, starterBudgetLines(locale, metier))).length;
  }
  if ((await listProspectSources(organizationId)).length === 0) {
    result.sources = await addProspectSources(organizationId, starterProspectSources(locale, metier));
  }
  if ((await listLossReasons(organizationId)).length === 0) {
    result.lossReasons = await addLossReasons(organizationId, starterLossReasons(locale));
  }
  if ((await listTaskTemplates(organizationId)).length === 0) {
    const template = starterRetroplanning(locale, metier);
    await createTaskTemplate(organizationId, template.name, template.items);
    result.taskTemplate = true;
  }
  if ((await listProgramTemplates(organizationId)).length === 0) {
    const template = starterProgram(locale, metier);
    await createProgramTemplate(organizationId, template.name, template.items);
    result.programTemplate = true;
  }
  // Répartition : rattachée aux lignes du budget par leur libellé ; une
  // ligne renommée ou retirée entre-temps est simplement ignorée.
  if (modules.budget && (await listAllocationModels(organizationId)).length === 0) {
    const split = starterAllocation(locale, metier);
    const byLabel = new Map((await listDefaultVendorSlots(organizationId)).map((slot) => [slot.label.toLocaleLowerCase(locale), slot.id]));
    const items = split.items
      .map((item) => ({ defaultVendorSlotId: byLabel.get(item.label.toLocaleLowerCase(locale)), percentageBasisPoints: item.basisPoints }))
      .filter((item): item is { defaultVendorSlotId: string; percentageBasisPoints: number } => item.defaultVendorSlotId !== undefined);
    if (items.reduce((sum, item) => sum + item.percentageBasisPoints, 0) === 10000) {
      await createAllocationModel({ organizationId, name: split.name, items });
      result.allocation = true;
    }
  }
  // Lot 16 (PRE-14) : familles et types de départ du métier, une seule fois.
  if (modules.vendors) result.vendorTypes = (await seedStarterVendorCatalog(organizationId, vendorCatalogInput(locale, metier), { withTypes: true })).types;
  return result;
}
