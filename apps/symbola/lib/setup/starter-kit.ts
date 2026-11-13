// Lot 12 (ONB-03) — paramètres de départ chargés d'office selon le métier,
// à l'étape 1 de l'assistant : lignes du budget (avec icônes), sources,
// motifs de perte, modèles de rétroplanning et de programme, répartition du
// budget, types de prestataires. Une liste déjà remplie n'est jamais
// touchée : on n'ajoute que là où l'organisation n'a encore rien.
// Orchestration entre modules, par leurs service.ts (ADR 0011).
import {
  starterAllocation,
  starterBudgetLines,
  starterEventTypes,
  starterLossReasons,
  starterProgram,
  starterProspectSources,
  starterRetroplanning,
  type StarterLocale,
  type StarterMetier,
} from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import {
  addDefaultVendorSlots,
  addLossReasons,
  addStarterEventTypes,
  addProspectSources,
  createProgramTemplate,
  createTaskTemplate,
  listDefaultVendorSlots,
  listEventTypes,
  listLossReasons,
  listProgramTemplates,
  listProspectSources,
  listTaskTemplates,
} from "@/modules/events/service";
import { createAllocationModel, listAllocationModels } from "@/modules/budget/service";
import { seedStarterVendorCatalog, seedStarterVendorTags } from "@/modules/vendors/service";
import { addStarterContractTemplates, listContractTemplates } from "@/modules/quotes/service";
import { organizesWeddings, vendorCatalogInput } from "@/lib/vendors/catalog";
import { vendorTagCatalogInput } from "@/lib/vendors/tag-catalog";
import { isModuleEnabled, type ModuleKey } from "@/modules/hub/service";

export type StarterKitResult = {
  budgetLines: number;
  sources: number;
  lossReasons: number;
  taskTemplate: boolean;
  programTemplate: boolean;
  allocation: boolean;
  vendorTypes: number;
  vendorTags: number;
  // Lot 31b (HUB-26, D10) : modèle de contrat de départ « à adapter ».
  contractTemplates: number;
};

async function enabled(organizationId: string): Promise<Record<ModuleKey, boolean>> {
  const db = appDatabase();
  const keys: ModuleKey[] = ["events", "budget", "quotes", "vendors"];
  const values = await Promise.all(keys.map((key) => isModuleEnabled(db, organizationId, key)));
  return Object.fromEntries(keys.map((key, index) => [key, values[index]!])) as Record<ModuleKey, boolean>;
}

export async function loadStarterKit(organizationId: string, metier: StarterMetier, locale: StarterLocale): Promise<StarterKitResult> {
  const modules = await enabled(organizationId);
  const result: StarterKitResult = { budgetLines: 0, sources: 0, lossReasons: 0, taskTemplate: false, programTemplate: false, allocation: false, vendorTypes: 0, vendorTags: 0, contractTemplates: 0 };
  if (!modules.events) return result;

  // Lot 16 (ADR 0045) : types d'événement de départ du métier, si l'organisation
  // n'en a encore aucun (l'assistant de démarrage installe ceux qu'elle a cochés).
  if ((await listEventTypes(organizationId)).length === 0) await addStarterEventTypes(organizationId, starterEventTypes(locale, metier));

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
  // Lot 16 (L16-PRE-14) : familles et types de départ du métier, une seule fois.
  // Lot 16 (ADR 0045) : catalogue commun, sans les types propres au mariage si
  // l'organisation n'en organise pas.
  if (modules.vendors) {
    const weddings = await organizesWeddings(organizationId);
    result.vendorTypes = (await seedStarterVendorCatalog(organizationId, vendorCatalogInput(locale, { weddings }), { withTypes: true })).types;
    // Lot 21 (L21-PRE-18) : étiquettes de départ, rangées par famille ; rien n'est
    // dupliqué au second passage.
    result.vendorTags = (await seedStarterVendorTags(organizationId, vendorTagCatalogInput(locale, metier))).created;
  }
  // Lot 31b (HUB-26, D10, partie J) : les modèles de contrat de départ se chargent au démarrage,
  // puis se modifient et se suppriment ; rien n'est ajouté si l'organisation en a déjà.
  if (modules.quotes && (await listContractTemplates(organizationId)).length === 0) {
    result.contractTemplates = (await addStarterContractTemplates(organizationId, locale, metier)).length;
  }
  return result;
}
