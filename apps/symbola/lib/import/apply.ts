// IMP-05 — aperçu, confirmation et annulation d'un import. Le hub garde
// l'import et son journal ; chaque module écrit ses lignes par son service.ts,
// en une transaction (deux pour les lignes de budget, avec compensation, voir
// modules/budget/import.ts). Si le journal ne peut pas être écrit après les
// modules, leurs écritures sont annulées : rien d'un import n'est gardé sans
// pouvoir être annulé.
import type { ImportApplyResult, ImportApplyRow, ImportedItem, ImportEntityType, ImportUndoItem, ImportUndoOutcome } from "@symbola/contracts";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import {
  findModifiedImportedBudgetElements,
  importBudgetLineRows,
  removeEventBudgetData,
  undoImportedBudgetElements,
} from "@/modules/budget/service";
import {
  findModifiedImportedEventsElements,
  importedEventIds,
  importEventRows,
  importListRows,
  importTaskRows,
  listProspectSources,
  undoImportedEventsElements,
} from "@/modules/events/service";
import {
  cancelImportJobs,
  createImportJob,
  getAppliedImport,
  getImportWorkingSet,
  getOrganizationProfile,
  recordAppliedImport,
  recordImportUndo,
  type AppliedImportItem,
  type AppliedImportView,
  type ImportResult,
} from "@/modules/hub/service";
import {
  findModifiedImportedQuotesElements,
  importCatalogItemRows,
  listEventQuotes,
  importPaymentMethodRows,
  undoImportedQuotesElements,
} from "@/modules/quotes/service";
import {
  arrangeVendorTags,
  findModifiedImportedVendorsElements,
  getVendor,
  importedVendorsToPlace,
  importVendorRows,
  undoImportedVendorsElements,
  type VendorTypeChoiceInput,
  type VendorTypeTarget,
} from "@/modules/vendors/service";
import { getImportGapsView } from "./gaps";
import { getImportMatchesView, loadVendorTypeCatalog, parseWorkingSetRows, type MatchesRowView, type VendorTypeCatalog } from "./matching";
import type { ImportVendorTypeTarget } from "@/modules/hub/service";
import type { StarterLocale } from "@symbola/starter-templates";
import { organizationTagCatalog } from "@/lib/vendors/tag-catalog";

// Couleur d'un type « à classer » (sans famille) sur la carte.
const UNCLASSIFIED_COLOR = "#78716c";

// Lot 16 (IMP-12) — cible enregistrée → ce que le module vendors écrit : libellé,
// famille et couleur d'un type de départ, couleur d'un type créé.
function vendorTypeTarget(target: ImportVendorTypeTarget, catalog: VendorTypeCatalog): VendorTypeTarget {
  if (target.kind === "starter") {
    const starter = catalog.starters.find((candidate) => candidate.key === target.starterKey);
    const family = catalog.families.find((candidate) => candidate.starterKey === starter?.familyKey);
    if (!starter) return { kind: "none" };
    return { kind: "starter", starterKey: starter.key, typeLabel: starter.label, familyId: family?.id ?? null, color: family?.color ?? starter.familyColor };
  }
  if (target.kind === "new") {
    const family = catalog.families.find((candidate) => candidate.id === target.familyId);
    return { kind: "new", familyId: family?.id ?? null, color: family?.color ?? UNCLASSIFIED_COLOR };
  }
  return target;
}

async function withHubDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await fn(db);
}

// —— Aperçu ————————————————————————————————————————————————————————————

export type PreviewBlocker = "columns_undecided" | "matches_undecided" | "nothing_to_import" | "vat_rate_unknown" | "no_prospect_source";

export type PreviewRow = Pick<MatchesRowView, "rowIndex" | "lineNumber" | "values" | "match" | "event">;

export type ImportPreview = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  // Nombre de créations et de mises à jour, et un échantillon de chacune.
  counts: { creations: number; updates: number };
  creations: PreviewRow[];
  updates: PreviewRow[];
  rejectedCount: number;
  blockers: PreviewBlocker[];
  // Import d'événements : sources proposées comme source par défaut.
  prospectSources: { id: string; label: string }[];
};

const SAMPLE_SIZE = 5;

async function defaultVatRate(organizationId: string): Promise<number | null> {
  const profile = await withHubDb((db) => getOrganizationProfile(db, organizationId));
  if (profile.vatRegime === "franchise") return 0;
  return profile.vatRateDefaultBasisPoints;
}

function isImportable(row: MatchesRowView): boolean {
  return row.errors.length === 0 && (!row.event || row.event.candidate !== null);
}

export async function getImportPreview(organizationId: string, importId: string): Promise<ImportPreview | null> {
  const gaps = await getImportGapsView(organizationId, importId);
  const matches = await getImportMatchesView(organizationId, importId);
  if (!gaps || !matches) return null;

  const importable = matches.rows.filter(isImportable);
  const updates = importable.filter((row) => row.match?.status === "accepted");
  const creations = importable.filter((row) => !row.match || row.match.status === "refused");
  const blockers: PreviewBlocker[] = [];
  if (gaps.columns.some((column) => column.decision === "undecided")) blockers.push("columns_undecided");
  if (importable.some((row) => row.match?.status === "proposed")) blockers.push("matches_undecided");
  if (updates.length + creations.length === 0) blockers.push("nothing_to_import");

  if (matches.entityType === "catalog_items" && creations.some((row) => row.values.vatRate === null || row.values.vatRate === undefined)) {
    if ((await defaultVatRate(organizationId)) === null) blockers.push("vat_rate_unknown");
  }
  const withSource = matches.entityType === "events" || matches.entityType === "event_sheets";
  const prospectSources = withSource ? await listProspectSources(organizationId) : [];
  if (withSource && prospectSources.length === 0 && creations.some((row) => !row.values.prospectSource)) {
    blockers.push("no_prospect_source");
  }

  return {
    importId,
    entityType: matches.entityType,
    fileName: matches.fileName,
    counts: { creations: creations.length, updates: updates.length },
    // Fiches PDF (lot 14c) : toutes les lignes, pour choisir le statut de chacune.
    creations: matches.entityType === "event_sheets" ? creations : creations.slice(0, SAMPLE_SIZE),
    updates: matches.entityType === "event_sheets" ? updates : updates.slice(0, SAMPLE_SIZE),
    rejectedCount: gaps.rejected.length,
    blockers,
    prospectSources: prospectSources.map(({ id, label }) => ({ id, label })),
  };
}

// —— Confirmation —————————————————————————————————————————————————————

export type ConfirmImportResult =
  | { status: "applied"; result: ImportResult }
  | { status: "not_found" }
  | { status: "blocked"; blockers: PreviewBlocker[] }
  | { status: "invalid_default_source" };

async function applyToModules(
  organizationId: string,
  userId: string,
  entityType: ImportEntityType,
  rows: ImportApplyRow[],
  options: {
    defaultProspectSourceId: string | null;
    defaultVatRateBasisPoints: number;
    vendorTypeChoices: VendorTypeChoiceInput[];
    typeColumnHeader?: string | null;
  },
): Promise<ImportApplyResult> {
  switch (entityType) {
    case "events":
    case "event_sheets":
      return importEventRows({ organizationId, userId, rows, defaultProspectSourceId: options.defaultProspectSourceId ?? "" });
    case "tasks":
      return importTaskRows({ organizationId, rows });
    case "budget_lines":
      return importBudgetLineRows({ organizationId, userId, rows });
    case "catalog_items":
      return importCatalogItemRows({ organizationId, rows, defaultVatRateBasisPoints: options.defaultVatRateBasisPoints });
    case "payment_methods":
      return importPaymentMethodRows({ organizationId, rows });
    case "prospect_sources":
    case "loss_reasons":
    case "vendor_slots":
      return importListRows({ organizationId, entityType, rows });
    case "vendors":
      return importVendorRows({ organizationId, rows, typeChoices: options.vendorTypeChoices, typeColumnHeader: options.typeColumnHeader ?? null });
  }
}

async function arrangeImportedTags(organizationId: string, importId: string, locale: StarterLocale, items: ImportedItem[]): Promise<void> {
  const createdTagIds = items.filter((item) => item.kind === "vendor_tag" && item.action === "created").map((item) => item.elementId);
  if (createdTagIds.length === 0) return;
  try {
    const arrangement = await arrangeVendorTags(organizationId, await organizationTagCatalog(organizationId, locale), { tagIds: createdTagIds });
    for (const adjusted of arrangement.adjustedVendors) {
      const vendor = await getVendor(organizationId, adjusted.id);
      if (!vendor) continue;
      for (const item of items) {
        if (item.kind === "vendor" && item.elementId === adjusted.id && "tagIds" in item.written) item.written = { ...item.written, tagIds: vendor.tagIds };
      }
    }
  } catch (error) {
    console.error("rangement des étiquettes importées échoué", { organizationId, importId, error: error instanceof Error ? error.message : "inconnue" });
  }
}

export async function confirmImport(input: {
  organizationId: string;
  userId: string;
  importId: string;
  defaultProspectSourceId?: string | null;
  locale?: StarterLocale;
}): Promise<ConfirmImportResult> {
  const preview = await getImportPreview(input.organizationId, input.importId);
  if (!preview) return { status: "not_found" };
  if (preview.blockers.length > 0) return { status: "blocked", blockers: preview.blockers };

  const defaultProspectSourceId = input.defaultProspectSourceId ?? null;
  if ((preview.entityType === "events" || preview.entityType === "event_sheets") && !preview.prospectSources.some((source) => source.id === defaultProspectSourceId)) {
    return { status: "invalid_default_source" };
  }

  const set = await withHubDb((db) => getImportWorkingSet(db, input.organizationId, input.importId));
  const matches = await getImportMatchesView(input.organizationId, input.importId);
  if (!set || !matches) return { status: "not_found" };
  const extraByRow = new Map(parseWorkingSetRows(set).map((row) => [row.rowIndex, row.extra]));
  const catalog = preview.entityType === "vendors" ? await loadVendorTypeCatalog(input.organizationId) : null;
  const typeColumn = set.mapping.find((choice) => choice.target === "field" && choice.fieldKey === "type");

  const rows: ImportApplyRow[] = matches.rows.filter(isImportable).map((row) => ({
    rowIndex: row.rowIndex,
    values: row.values,
    importedFields: extraByRow.get(row.rowIndex) ?? {},
    matchId: row.match?.status === "accepted" ? row.match.candidateId : null,
    eventId: row.event?.eventId ?? null,
  }));

  const applied = await applyToModules(input.organizationId, input.userId, preview.entityType, rows, {
    defaultProspectSourceId,
    defaultVatRateBasisPoints: (await defaultVatRate(input.organizationId)) ?? 0,
    vendorTypeChoices: catalog ? (matches.vendorTypes ?? []).map(({ label, typeId, target }) => ({ label, typeId, target: vendorTypeTarget(target, catalog) })) : [],
    typeColumnHeader: typeColumn ? set.headers[typeColumn.columnIndex] || null : null,
  });

  // Compté par ligne : une ligne de budget crée parfois deux éléments (poste
  // et ligne) ; une ligne est une création si elle a créé quelque chose.
  const createdRows = new Set(applied.items.filter((item) => item.action === "created" && item.rowIndex !== null).map((item) => item.rowIndex));
  const updatedRows = new Set(
    applied.items.filter((item) => item.action === "updated" && item.rowIndex !== null && !createdRows.has(item.rowIndex)).map((item) => item.rowIndex),
  );
  const result: ImportResult = {
    created: createdRows.size,
    updated: updatedRows.size,
    unchanged: applied.unchanged,
    rejected: matches.rows.length - rows.length,
  };
  // Lot 21 (PRE-19, ADR 0050) : les étiquettes créées par l'import se rangent
  // toutes seules (étiquettes de départ reconnues, paliers, familles des
  // prestataires qui les portent), avant l'enregistrement de l'import : une
  // fiche ramenée à sa plus haute tranche est enregistrée avec ses étiquettes
  // finales, pour que l'annulation ne la prenne pas pour une fiche retouchée.
  // Un échec ici ne défait pas l'import : le rangement reste proposé sur
  // l'écran Étiquettes.
  if (preview.entityType === "vendors") await arrangeImportedTags(input.organizationId, input.importId, input.locale ?? "fr", applied.items);

  let recorded = false;
  try {
    recorded = await withHubDb((db) =>
      recordAppliedImport(db, {
        organizationId: input.organizationId,
        importId: input.importId,
        items: applied.items.map(({ module, kind, elementId, action, previous, written }) => ({ module, kind, elementId, action, previous, written })),
        result,
      }),
    );
  } finally {
    if (!recorded) await undoItems(input.organizationId, input.userId, applied.items, () => true);
  }
  if (!recorded) return { status: "not_found" };
  // Lot 15 (GEO-01) : les prestataires créés ou dont l'adresse a changé sont
  // placés sur la carte ensuite, en tâche de fond (la planner n'attend pas).
  if (preview.entityType === "vendors") {
    const vendorIds = importedVendorsToPlace(applied.items);
    if (vendorIds.length > 0) {
      await withHubDb((db) =>
        createImportJob(db, { organizationId: input.organizationId, importId: input.importId, payload: { kind: "place_vendors", vendorIds }, total: vendorIds.length }),
      );
    }
  }
  return { status: "applied", result };
}

// —— Annulation ————————————————————————————————————————————————————————

type UndoableItem = Pick<ImportedItem, "module" | "kind" | "elementId" | "action" | "previous" | "written">;

// Parcourt les éléments à l'envers de leur écriture, module par module (les
// lignes de budget avant leurs postes, les événements avant leurs sources).
async function undoItems(
  organizationId: string,
  userId: string,
  items: UndoableItem[],
  force: (item: UndoableItem, index: number) => boolean,
): Promise<ImportUndoOutcome[]> {
  const outcomes: ImportUndoOutcome[] = new Array(items.length);
  let index = items.length - 1;
  while (index >= 0) {
    const module = items[index]!.module as ImportedItem["module"];
    const group: number[] = [];
    while (index >= 0 && items[index]!.module === module) group.push(index--);
    const undo: ImportUndoItem[] = group.map((position) => {
      const item = items[position]!;
      return { kind: item.kind, elementId: item.elementId, action: item.action, previous: item.previous, written: item.written ?? {}, force: force(item, position) };
    });
    const groupOutcomes =
      module === "events"
        ? await undoImportedEventsElements(organizationId, userId, undo)
        : module === "budget"
          ? await undoImportedBudgetElements(organizationId, userId, undo)
          : module === "vendors"
            ? await undoImportedVendorsElements(organizationId, undo)
            : await undoImportedQuotesElements(organizationId, undo);
    group.forEach((position, offset) => {
      outcomes[position] = groupOutcomes[offset] ?? "missing";
    });
  }
  return outcomes;
}

export type UndoPreviewItem = AppliedImportItem & { modified: boolean; usedElsewhere: boolean };

export type UndoPreview = AppliedImportView & { pendingItems: UndoPreviewItem[] };

async function modifiedFlags(organizationId: string, items: AppliedImportItem[]): Promise<boolean[]> {
  const flags = new Array<boolean>(items.length).fill(false);
  for (const module of ["events", "budget", "quotes", "vendors"] as const) {
    const positions = items.map((item, position) => (item.module === module ? position : -1)).filter((position) => position >= 0);
    if (positions.length === 0) continue;
    const subset = positions.map((position) => {
      const item = items[position]!;
      return { kind: item.kind, elementId: item.elementId, action: item.action, written: item.written ?? {} };
    });
    const found =
      module === "events"
        ? await findModifiedImportedEventsElements(organizationId, subset)
        : module === "budget"
          ? await findModifiedImportedBudgetElements(organizationId, subset)
          : module === "vendors"
            ? await findModifiedImportedVendorsElements(organizationId, subset)
            : await findModifiedImportedQuotesElements(organizationId, subset);
    positions.forEach((position, offset) => {
      flags[position] = found[offset] ?? false;
    });
  }
  return flags;
}

// Événement créé par l'import auquel un devis a été rattaché depuis : jamais
// supprimé (numérotation légale, ADR 0010).
async function eventsWithQuotes(organizationId: string, eventIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  for (const eventId of eventIds) {
    if ((await listEventQuotes(organizationId, eventId)).length > 0) result.add(eventId);
  }
  return result;
}

export async function getUndoPreview(organizationId: string, importId: string): Promise<UndoPreview | null> {
  const view = await withHubDb((db) => getAppliedImport(db, organizationId, importId));
  if (!view) return null;
  const pending = view.items.filter((item) => item.undoOutcome !== "undone" && item.undoOutcome !== "missing");
  const flags = await modifiedFlags(organizationId, pending);
  const withQuotes = await eventsWithQuotes(organizationId, importedEventIds(pending));
  return {
    ...view,
    pendingItems: pending.map((item, index) => ({ ...item, modified: flags[index] ?? false, usedElsewhere: withQuotes.has(item.elementId) })),
  };
}

export type UndoImportResult =
  | { status: "done"; outcomes: Record<ImportUndoOutcome, number> }
  | { status: "not_found" }
  | { status: "expired" };

// « Quand elle annule un import déjà confirmé, alors les éléments créés sont
// supprimés et les éléments mis à jour retrouvent leurs valeurs précédentes.
// Étant donné un élément modifié à la main depuis l'import, alors l'app le
// signale et ne l'écrase pas sans confirmation » : `forceItemIds` porte les
// éléments modifiés que la planner a confirmé vouloir annuler.
export async function undoImport(input: {
  organizationId: string;
  userId: string;
  importId: string;
  forceItemIds?: string[];
}): Promise<UndoImportResult> {
  const preview = await getUndoPreview(input.organizationId, input.importId);
  if (!preview) return { status: "not_found" };
  if (!preview.undoable) return { status: "expired" };
  // Lot 15 : un placement sur la carte en cours s'arrête avant l'annulation.
  await withHubDb((db) => cancelImportJobs(db, input.organizationId, input.importId));

  const force = new Set(input.forceItemIds ?? []);
  const items = preview.pendingItems.filter((item) => !item.usedElsewhere);
  // Un événement créé puis enrichi d'un budget, annulé avec confirmation :
  // son budget part avec lui.
  const forcedEvents = items.filter((item) => item.kind === "event" && item.action === "created" && force.has(item.id)).map((item) => item.elementId);
  if (forcedEvents.length > 0) await removeEventBudgetData(input.organizationId, forcedEvents);

  const outcomes = await undoItems(
    input.organizationId,
    input.userId,
    items.map((item) => ({ ...item, module: item.module as ImportedItem["module"], written: item.written ?? {} })),
    (_item, position) => force.has(items[position]!.id),
  );
  const recorded = [
    ...items.map((item, position) => ({ itemId: item.id, outcome: outcomes[position] ?? ("missing" as const) })),
    ...preview.pendingItems.filter((item) => item.usedElsewhere).map((item) => ({ itemId: item.id, outcome: "kept_in_use" as const })),
  ];
  await withHubDb((db) => recordImportUndo(db, { organizationId: input.organizationId, importId: input.importId, outcomes: recorded }));

  const counts: Record<ImportUndoOutcome, number> = { undone: 0, kept_modified: 0, kept_in_use: 0, missing: 0 };
  for (const { outcome } of recorded) counts[outcome] += 1;
  return { status: "done", outcomes: counts };
}
