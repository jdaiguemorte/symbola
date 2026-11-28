// IMP-05 — aperçu, confirmation et annulation d'un import. Le hub garde
// l'import et son journal ; chaque module écrit ses lignes par son service.ts,
// en une transaction (deux pour les lignes de budget, avec compensation, voir
// modules/budget/import.ts). Si le journal ne peut pas être écrit après les
// modules, leurs écritures sont annulées : rien d'un import n'est gardé sans
// pouvoir être annulé.
import type { ImportAnswers, ImportApplyResult, ImportApplyRow, ImportCellValue, ImportedItem, ImportEntityType, ImportFigures, ImportUndoItem, ImportUndoOutcome } from "@symbola/contracts";
import { appNameCase } from "@symbola/import-engine";
import { parisToday } from "@symbola/i18n";
import { eventStatusForStage } from "@symbola/contracts";
import { createImportPendingEvent } from "@/lib/takeover/flow";
import { applyPastDueAnswer } from "./question-rules";
import { getImportQuestions } from "./questions";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import { withOrganization, type OrganizationTransaction } from "@symbola/db/with-organization";
import {
  findModifiedImportedBudgetElements,
  importBudgetLineRows,
  listBudgetLines,
  importUnallocatedTotals,
  removeEventBudgetData,
  undoImportedBudgetElements,
} from "@/modules/budget/service";
import {
  findModifiedImportedEventsElements,
  importedEventIds,
  importEventRows,
  importListRows,
  importTaskRows,
  listLinkedContactIds,
  listProspectSources,
  undoImportedEventsElements,
} from "@/modules/events/service";
import {
  cancelImportJobs,
  createImportJob,
  findModifiedImportedHubElements,
  attachTakeoverEvent,
  getAppliedImport,
  getImportAnswers,
  getImportTakeoverId,
  getImportWorkingSet,
  getOrganizationProfile,
  importContactRows,
  importedContactValues,
  deleteTakeover,
  getTakeover,
  listImportFilesOfElements,
  listTakeoverAppliedImports,
  releaseTakeoverStepsOfImport,
  type TakeoverImport,
  recordAppliedImport,
  recordImportUndo,
  undoImportedHubElements,
  TakeoverEventTakenError,
  type AppliedImportItem,
  type AppliedImportView,
  type ImportMatching,
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
  getVendorsByIds,
  importedVendorsToPlace,
  importNamedVendors,
  importVendorRows,
  listVendorTypes,
  undoImportedVendorsElements,
  type VendorTypeChoiceInput,
  type VendorTypeTarget,
} from "@/modules/vendors/service";
import { getImportGapsView } from "./gaps";
import { getImportMatchesView, loadVendorTypeCatalog, parseWorkingSetRows, type MatchesRowView, type VendorTypeCatalog } from "./matching";
import type { ImportVendorTypeTarget, TakeoverViewer } from "@/modules/hub/service";
import { starterBudgetImportPaymentLabels, starterVendorTypeSynonymGroups, type StarterLocale } from "@symbola/starter-templates";
import { matchImportVendorType } from "@/lib/vendors/event-vendors-import-rules";
import { pendingBudgetDoublons } from "./budget-doublons";
import { budgetWritePlan, type BudgetPlan } from "./budget-plan";
import { vendorLinkKey, type BudgetVendorLink } from "@/modules/events/service";
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

// Lot 71c : « questions_pending », une réponse de l'étape « Questions » manque.
export type PreviewBlocker = "columns_undecided" | "questions_pending" | "matches_undecided" | "nothing_to_import" | "vat_rate_unknown" | "no_prospect_source";

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

// Lot 36b : une ligne de contact ignorée par la planner (doublon d'adresse) n'est pas importée.
function isImportable(row: MatchesRowView): boolean {
  return row.errors.length === 0 && (!row.event || row.event.candidate !== null || row.event.pendingNew === true) && row.ignored !== true;
}

// Lot 36b : une ligne de contact qui répète une adresse plus haut (sans contact rapproché) ne met à
// jour que si elle apporte quelque chose à la première : un champ resté vide, ou une autre note.
const CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "addressLine", "postalCode", "city", "country"] as const;

function addsToEarlier(row: MatchesRowView, earlier: MatchesRowView | undefined, extra: Map<number, Record<string, string>>): boolean {
  if (!earlier) return true;
  const values = importedContactValues(row.values, extra.get(row.rowIndex));
  const first = importedContactValues(earlier.values, extra.get(earlier.rowIndex));
  if (!values || !first) return false;
  return CONTACT_FIELDS.some((field) => values[field] !== null && first[field] === null) || (values.note !== null && values.note !== first.note);
}

export async function getImportPreview(organizationId: string, importId: string): Promise<ImportPreview | null> {
  const gaps = await getImportGapsView(organizationId, importId);
  const matches = await getImportMatchesView(organizationId, importId);
  if (!gaps || !matches) return null;

  const importable = matches.rows.filter(isImportable);
  const contactsImport = matches.entityType === "contacts";
  let updates = importable.filter((row) => row.match?.status === "accepted");
  let creations = importable.filter((row) => !row.match || row.match.status === "refused");
  if (contactsImport) {
    const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
    const extra = new Map(set ? parseWorkingSetRows(set).map((row) => [row.rowIndex, row.extra]) : []);
    const byLine = new Map(matches.rows.map((row) => [row.lineNumber, row]));
    const repeats = importable.filter((row) => !row.match && row.sameAsLine !== undefined);
    updates = [...updates, ...repeats.filter((row) => addsToEarlier(row, byLine.get(row.sameAsLine!), extra))].sort((a, b) => a.rowIndex - b.rowIndex);
    creations = creations.filter((row) => !repeats.includes(row));
  }
  const blockers: PreviewBlocker[] = [];
  if (gaps.columns.some((column) => column.decision === "undecided")) blockers.push("columns_undecided");
  if (importable.some((row) => row.match?.status === "proposed")) blockers.push("matches_undecided");
  // Lot 71d (R17, C-57) : un poste sans ligne, ou un doublon possible du carnet, attend sa décision.
  else if (matches.entityType === "budget_lines" && (await pendingBudgetDoublons(organizationId, importId)).length > 0) blockers.push("matches_undecided");
  if (updates.length + creations.length === 0) blockers.push("nothing_to_import");

  if (matches.entityType === "catalog_items" && creations.some((row) => row.values.vatRate === null || row.values.vatRate === undefined)) {
    if ((await defaultVatRate(organizationId)) === null) blockers.push("vat_rate_unknown");
  }
  const withSource = matches.entityType === "events" || matches.entityType === "event_sheets";
  // Lot 71a (HUB-14) : la source d'un prospect est facultative (« non renseignée ») ; une organisation
  // sans source n'est plus bloquée.
  const prospectSources = withSource ? await listProspectSources(organizationId) : [];

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

// Lot 71a (HUB-14, UX-02) : champs de nom et de ville repris à la casse de l'app (« Léa MARTIN » →
// « Léa Martin », « POITIERS » → « Poitiers »).
const NAME_CASE_FIELDS: Partial<Record<ImportEntityType, readonly string[]>> = {
  events: ["client1FirstName", "client1LastName", "client2FirstName", "client2LastName", "venueCity"],
  event_sheets: ["client1FirstName", "client1LastName", "client2FirstName", "client2LastName", "client1City", "client2City"],
};

export function withAppNameCase(entityType: ImportEntityType, values: Record<string, ImportCellValue>): Record<string, ImportCellValue> {
  const keys = NAME_CASE_FIELDS[entityType];
  if (!keys) return values;
  const result = { ...values };
  for (const key of keys) {
    const value = result[key];
    if (typeof value === "string") result[key] = appNameCase(value);
  }
  return result;
}

// Noms des champs écrits sur un élément, sans les valeurs (I9) ; les échéances créées comptent pour un.
export function writtenFields(written: Record<string, unknown> | null): string[] {
  return Object.keys(written ?? {}).sort();
}

// Le total d'une fiche (engagé, réglé) et l'évènement que sa ligne a créé ou mis à jour.
function sheetTotals(rows: ImportApplyRow[], items: ImportedItem[]): { rowIndex: number; eventId: string; committedCents: number; paidCents: number }[] {
  const eventByRow = new Map(items.filter((item) => item.module === "events" && item.kind === "event" && item.rowIndex !== null).map((item) => [item.rowIndex!, item.elementId] as const));
  const totals: { rowIndex: number; eventId: string; committedCents: number; paidCents: number }[] = [];
  for (const row of rows) {
    const eventId = eventByRow.get(row.rowIndex) ?? row.matchId;
    const committed = typeof row.values.total === "number" ? row.values.total : null;
    if (!eventId || committed === null || committed <= 0) continue;
    const paid = typeof row.values.paid === "number" && row.values.paid > 0 ? row.values.paid : 0;
    totals.push({ rowIndex: row.rowIndex, eventId, committedCents: committed, paidCents: paid });
  }
  return totals;
}

async function applyToModules(
  organizationId: string,
  userId: string,
  entityType: ImportEntityType,
  rows: ImportApplyRow[],
  options: {
    defaultProspectSourceId: string | null;
    // Lot 71a : réponses de l'étape « Questions », et import d'une reprise.
    answers: ImportAnswers | null;
    takeover: boolean;
    defaultVatRateBasisPoints: number;
    vendorTypeChoices: VendorTypeChoiceInput[];
    typeColumnHeader?: string | null;
    // Lot 63b : libellés des échéances créées par un budget importé.
    paymentLabels?: { deposit: string; balance: string };
    // Lot 71d : fiches du carnet des prestataires, postes sans ligne retirés de ce mariage.
    vendorLinks?: BudgetVendorLink[];
    removeSlotIds?: string[];
  },
): Promise<ImportApplyResult> {
  switch (entityType) {
    case "events":
    case "event_sheets":
      return importEventRows({ organizationId, userId, rows, defaultProspectSourceId: options.defaultProspectSourceId, answers: options.answers, takeover: options.takeover });
    case "tasks":
      return importTaskRows({ organizationId, rows });
    case "budget_lines":
      return importBudgetLineRows({
        organizationId,
        userId,
        rows,
        answers: options.answers,
        takeover: options.takeover,
        ...(options.paymentLabels ? { paymentLabels: options.paymentLabels } : {}),
        ...(options.vendorLinks ? { vendorLinks: options.vendorLinks } : {}),
        ...(options.removeSlotIds ? { removeSlotIds: options.removeSlotIds } : {}),
      });
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
    case "contacts":
      return importContactRows({ organizationId, userId, rows });
    // Lot 71a : ces deux sortes passent par l'assistant commun au paquet 71e ; d'ici là, la route
    // d'envoi ne les accepte pas (IMPORT_FILE_ENTITY_TYPES).
    case "event_vendors":
    case "program":
      throw new Error("sorte d'import pas encore prise par l'assistant commun");
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

function withoutStage(answers: ImportAnswers): ImportAnswers {
  const rest = { ...answers };
  delete rest.eventStage;
  return rest;
}

function withoutSource(answers: ImportAnswers): ImportAnswers {
  const rest = { ...answers };
  delete rest.prospectSourceId;
  return rest;
}

// Lot 71d (HUB-14, BUD-01, C-58) — ce qu'un budget va écrire : les lignes importables, chacune sous son
// poste (celui que « Doublons » a retenu, ou un nouveau poste), ses échéances et son prestataire. Un même
// calcul pour « Vérifier » (avant) et pour le journal (à l'écriture) : le bilan redit ces nombres.
export async function getBudgetImportPlan(organizationId: string, importId: string, options: { now?: Date; locale?: StarterLocale } = {}): Promise<(BudgetPlan & { fileName: string }) | null> {
  const matches = await getImportMatchesView(organizationId, importId);
  const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
  if (!matches || !set || matches.entityType !== "budget_lines") return null;
  const answers = await withHubDb((db) => getImportAnswers(db, organizationId, importId));
  const rows = matches.rows.filter(isImportable);
  const slotLabels = new Map(rows.flatMap((row) => row.options.map((option) => [option.id, option.label ?? ""] as const)));
  const sameIds = (set.matching?.vendorLinks ?? []).filter((link) => link.decision === "same" && link.vendorId).map((link) => link.vendorId!);
  const carnetNames = new Map(sameIds.length > 0 ? (await getVendorsByIds(organizationId, sameIds)).map((vendor) => [vendor.id, vendor.name] as const) : []);
  const plan = budgetWritePlan({
    rows: rows.map((row) => ({ rowIndex: row.rowIndex, lineNumber: row.lineNumber, values: row.values, slotId: row.match?.status === "accepted" ? row.match.candidateId : null })),
    slotLabels,
    answers,
    vendorLinks: set.matching?.vendorLinks,
    carnetNames,
    paymentLabels: starterBudgetImportPaymentLabels(options.locale ?? "fr"),
    today: parisToday(options.now ?? new Date()),
  });
  return { ...plan, fileName: matches.fileName };
}

// Lot 71d : les fiches du carnet des prestataires nommés (retrouvées, « C'est la même fiche »), et les
// fiches à créer (« Ce n'est pas la même : créer une fiche »), créées ici avec le métier de leur poste.
async function budgetVendorLinks(
  organizationId: string,
  links: NonNullable<ImportMatching["vendorLinks"]>,
  slotOf: (name: string) => string | null,
): Promise<{ links: BudgetVendorLink[]; items: ImportedItem[] }> {
  const kept = links.filter((link) => (link.decision === "found" || link.decision === "same") && link.vendorId);
  const carnet = new Map(kept.length > 0 ? (await getVendorsByIds(organizationId, kept.map((link) => link.vendorId!))).map((vendor) => [vendor.id, vendor.name] as const) : []);
  const result: BudgetVendorLink[] = kept.flatMap((link) => (carnet.has(link.vendorId!) ? [{ name: link.name, vendorId: link.vendorId!, vendorName: carnet.get(link.vendorId!)! }] : []));
  const toCreate = links.filter((link) => link.decision === "create");
  if (toCreate.length === 0) return { links: result, items: [] };
  const types = await listVendorTypes(organizationId);
  const synonyms = starterVendorTypeSynonymGroups();
  const created = await importNamedVendors(
    organizationId,
    toCreate.map((link) => {
      const slot = slotOf(link.name);
      return { name: link.name, typeId: slot ? matchImportVendorType(slot, types, synonyms) : null };
    }),
  );
  for (const link of toCreate) {
    const vendorId = created.idByName.get(link.name.trim());
    if (vendorId) result.push({ name: link.name, vendorId, vendorName: link.name.trim() });
  }
  return { links: result, items: created.items };
}

export async function confirmImport(input: {
  organizationId: string;
  userId: string;
  importId: string;
  defaultProspectSourceId?: string | null;
  locale?: StarterLocale;
  // Lot 71c : ce que voit la personne (lot 52), pour la reprise d'un mariage créé à l'écriture ; et
  // l'heure, pour les échéances passées (horloge simulée dans les tests).
  viewer?: TakeoverViewer;
  now?: Date;
}): Promise<ConfirmImportResult> {
  const now = input.now ?? new Date();
  // Lot 71c (critère 3) : aucune réponse n'est supposée ; il en manque une, rien n'est écrit.
  const questions = await getImportQuestions(input.organizationId, input.importId, { now, locale: input.locale ?? "fr" });
  if (questions && questions.missing.length > 0) return { status: "blocked", blockers: ["questions_pending"] };
  // Lot 71c (critère 1) : « Un mariage qui n'est pas encore dans Symbola » est créé maintenant, avec sa
  // reprise ; les lignes y vont.
  if (questions?.answers?.newEvent) {
    const viewer = input.viewer ?? { userId: input.userId, role: "owner" as const, allPlannersSeeAll: true };
    await createImportPendingEvent({ organizationId: input.organizationId, userId: input.userId, viewer }, input.importId, input.locale ?? "fr");
  }
  const preview = await getImportPreview(input.organizationId, input.importId);
  if (!preview) return { status: "not_found" };
  if (preview.blockers.length > 0) return { status: "blocked", blockers: preview.blockers };

  const defaultProspectSourceId = input.defaultProspectSourceId ?? null;
  // Lot 71a : une source citée doit être de l'organisation ; aucune source, « non renseignée ».
  if ((preview.entityType === "events" || preview.entityType === "event_sheets") && defaultProspectSourceId !== null && !preview.prospectSources.some((source) => source.id === defaultProspectSourceId)) {
    return { status: "invalid_default_source" };
  }
  const stored = await withHubDb((db) => getImportAnswers(db, input.organizationId, input.importId));
  // Lot 71c (SEC-13) : une source d'une autre organisation n'est pas reprise ; « non renseignée ».
  const answers = stored?.prospectSourceId && !preview.prospectSources.some((source) => source.id === stored.prospectSourceId) ? withoutSource(stored) : stored;
  const takeoverId = await withHubDb((db) => getImportTakeoverId(db, input.organizationId, input.importId));
  const takeover = takeoverId !== null;

  const set = await withHubDb((db) => getImportWorkingSet(db, input.organizationId, input.importId));
  const matches = await getImportMatchesView(input.organizationId, input.importId);
  if (!set || !matches) return { status: "not_found" };
  const extraByRow = new Map(parseWorkingSetRows(set).map((row) => [row.rowIndex, row.extra]));
  const catalog = preview.entityType === "vendors" ? await loadVendorTypeCatalog(input.organizationId) : null;
  const typeColumn = set.mapping.find((choice) => choice.target === "field" && choice.fieldKey === "type");

  // Lot 71c (R16) : les tâches passées gardées, redatées ou dites faites, selon la réponse.
  const importable = preview.entityType === "tasks" ? applyPastDueAnswer(matches.rows.filter(isImportable), answers?.pastDueTasks, parisToday(now)) : matches.rows.filter(isImportable);
  // Lot 71c (C-64) : « Où en est-il ? » donne le statut de chaque fiche, sauf celle dont la planner a
  // choisi le statut dans l'aperçu (décision J, lot 63a), qui l'emporte.
  const chosenStatus = new Map((set.matching?.rowStatuses ?? []).map((entry) => [entry.rowIndex, entry.status]));
  const stageStatus = preview.entityType === "event_sheets" && answers?.eventStage ? eventStatusForStage(answers.eventStage) : null;
  const withStatus = (row: (typeof importable)[number]) => (stageStatus && !chosenStatus.has(row.rowIndex) ? { ...row, values: { ...row.values, status: stageStatus } } : row);
  const rows: ImportApplyRow[] = importable.map(withStatus).map((row) => ({
    rowIndex: row.rowIndex,
    // Lot 71a : noms et villes à la casse de l'app, sauf « Garder les capitales ».
    values: answers?.nameCase === "keep" ? row.values : withAppNameCase(preview.entityType, row.values),
    importedFields: extraByRow.get(row.rowIndex) ?? {},
    matchId: row.match?.status === "accepted" ? row.match.candidateId : null,
    eventId: row.event?.eventId ?? null,
  }));

  // Lot 71d (HUB-14, C-58) : un budget écrit ce que « Vérifier » a annoncé ; les nombres sont comptés
  // sur ce plan, avant d'écrire, et gardés au journal.
  let budgetPlan: BudgetPlan | null = null;
  let budgetWrite: { links: BudgetVendorLink[]; items: ImportedItem[]; removeSlotIds: string[] } | null = null;
  if (preview.entityType === "budget_lines") {
    budgetPlan = await getBudgetImportPlan(input.organizationId, input.importId, { now, locale: input.locale ?? "fr" });
    const slotOf = (name: string) => budgetPlan?.lines.find((line) => line.vendorKey === vendorLinkKey(name))?.slotLabel ?? null;
    const vendors = await budgetVendorLinks(input.organizationId, set.matching?.vendorLinks ?? [], slotOf);
    budgetWrite = { ...vendors, removeSlotIds: (set.matching?.unusedSlots ?? []).filter((entry) => entry.decision === "remove").map((entry) => entry.slotId) };
  }

  let applied: ImportApplyResult;
  try {
    applied = await applyToModules(input.organizationId, input.userId, preview.entityType, rows, {
    defaultProspectSourceId,
    defaultVatRateBasisPoints: (await defaultVatRate(input.organizationId)) ?? 0,
    // Le statut des fiches est déjà posé ligne par ligne (ci-dessus).
    answers: stageStatus && answers ? withoutStage(answers) : answers,
    takeover,
    vendorTypeChoices: catalog ? (matches.vendorTypes ?? []).map(({ label, typeId, target }) => ({ label, typeId, target: vendorTypeTarget(target, catalog) })) : [],
    typeColumnHeader: typeColumn ? set.headers[typeColumn.columnIndex] || null : null,
    paymentLabels: starterBudgetImportPaymentLabels(input.locale ?? "fr"),
    ...(budgetWrite ? { vendorLinks: budgetWrite.links, removeSlotIds: budgetWrite.removeSlotIds } : {}),
  });
  } catch (error) {
    // Les fiches créées juste avant pour ce budget sont retirées : rien de l'import n'est gardé.
    if (budgetWrite && budgetWrite.items.length > 0) await undoItems(input.organizationId, input.userId, budgetWrite.items, () => true);
    throw error;
  }
  // Les fiches créées pour ce budget, écrites avant ses lignes : retirées après elles.
  if (budgetWrite && budgetWrite.items.length > 0) applied.items.unshift(...budgetWrite.items);

  // Lot 71a (C-56) : le total engagé et le réglé d'une fiche PDF vont au total « à répartir » de son
  // évènement (module budget), au journal du même import.
  if (preview.entityType === "event_sheets") {
    const totals = sheetTotals(rows, applied.items);
    if (totals.length > 0) {
      try {
        const written = await importUnallocatedTotals(input.organizationId, totals, input.importId);
        applied.items.push(...written.items);
      } catch (error) {
        await undoItems(input.organizationId, input.userId, applied.items, () => true);
        throw error;
      }
    }
  }

  // Compté par ligne : une ligne de budget crée parfois deux éléments (poste
  // et ligne) ; une ligne est une création si elle a créé quelque chose.
  const createdRows = new Set(applied.items.filter((item) => item.action === "created" && item.rowIndex !== null).map((item) => item.rowIndex));
  const updatedRows = new Set(
    applied.items.filter((item) => item.action === "updated" && item.rowIndex !== null && !createdRows.has(item.rowIndex)).map((item) => item.rowIndex),
  );
  const figures: ImportFigures = budgetPlan ? budgetPlan.figures : { kind: "rows", rows: rows.length };
  const result: ImportResult = {
    created: createdRows.size,
    updated: updatedRows.size,
    unchanged: applied.unchanged,
    rejected: matches.rows.length - rows.length,
    figures,
    ...(budgetPlan ? { choices: budgetChoices(matches.rows, set.matching, budgetWrite?.links ?? []) } : {}),
  };
  // Lot 21 (L21-PRE-19, ADR 0050) : les étiquettes créées par l'import se rangent
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
        // Lot 71a (R7, I9) : les noms des champs écrits, sans valeur, pour « D'où viennent ces valeurs ? ».
        items: applied.items.map(({ module, kind, elementId, action, previous, written }) => ({ module, kind, elementId, action, previous, written, fields: writtenFields(written) })),
        result,
      }),
    );
  } finally {
    if (!recorded) await undoItems(input.organizationId, input.userId, applied.items, () => true);
  }
  if (!recorded) return { status: "not_found" };
  // Lot 71a : la fiche (ou la liste) qui crée le mariage d'une reprise lui donne son mariage (ligne 2).
  if (takeoverId && (preview.entityType === "event_sheets" || preview.entityType === "events")) {
    const created = applied.items.filter((item) => item.module === "events" && item.kind === "event" && item.action === "created").map((item) => item.elementId);
    if (created.length === 1) {
      await withHubDb((db) => attachTakeoverEvent(db, { organizationId: input.organizationId, userId: input.userId, takeoverId, eventId: created[0]! })).catch((error: unknown) => {
        // Le mariage a déjà sa reprise, ou la reprise un autre mariage : l'import reste écrit.
        if (!(error instanceof TakeoverEventTakenError)) throw error;
      });
    }
  }
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

// Lot 71d : « Ce que vous avez choisi » à « Doublons », gardé au journal pour le bilan.
function budgetChoices(rows: MatchesRowView[], matching: ImportMatching | null, links: BudgetVendorLink[]): NonNullable<ImportResult["choices"]> {
  const label = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const splits = [...new Set(rows.filter((row) => row.match?.placement === "split" && row.match.status === "accepted").map((row) => label(row.values.slotLabel)))].filter(Boolean);
  const slotLabels = new Map(rows.flatMap((row) => row.options.map((option) => [option.id, option.label ?? ""] as const)));
  const removedSlots = (matching?.unusedSlots ?? []).filter((entry) => entry.decision === "remove").map((entry) => slotLabels.get(entry.slotId) ?? "").filter(Boolean);
  const sameVendors = (matching?.vendorLinks ?? []).filter((link) => link.decision === "same").map((link) => ({ name: link.name, vendorName: links.find((entry) => entry.name === link.name)?.vendorName ?? link.name }));
  const createdVendors = (matching?.vendorLinks ?? []).filter((link) => link.decision === "create").map((link) => link.name);
  return { splits, removedSlots, sameVendors, createdVendors };
}

// —— Annulation ————————————————————————————————————————————————————————

type UndoableItem = Pick<ImportedItem, "module" | "kind" | "elementId" | "action" | "previous" | "written">;

// Parcourt les éléments à l'envers de leur écriture, module par module (les
// lignes de budget avant leurs postes, les événements avant leurs sources).
// Lot 71d (I10) : `outer`, la transaction de « Retirer toute la reprise… » (modules events, budget,
// vendors) : tout part ensemble, ou rien.
async function undoItems(
  organizationId: string,
  userId: string,
  items: UndoableItem[],
  force: (item: UndoableItem, index: number) => boolean,
  outer?: OrganizationTransaction,
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
    if (outer && module !== "events" && module !== "budget" && module !== "vendors") throw new Error("module hors du retrait d'ensemble");
    const groupOutcomes =
      module === "events"
        ? await undoImportedEventsElements(organizationId, userId, undo, outer)
        : module === "budget"
          ? await undoImportedBudgetElements(organizationId, userId, undo, outer)
          : module === "vendors"
            ? await undoImportedVendorsElements(organizationId, undo, outer)
            : module === "hub"
              ? await undoImportedHubElements(organizationId, undo)
              : await undoImportedQuotesElements(organizationId, undo);
    group.forEach((position, offset) => {
      outcomes[position] = groupOutcomes[offset] ?? "missing";
    });
  }
  return outcomes;
}

export type UndoPreviewItem = AppliedImportItem & { modified: boolean; usedElsewhere: boolean };

// Lot 71d (HUB-14 ; spécification du lot 71, § 5.4, critère 6 ; maquette 08) — ce que le retrait
// enlève (« Partent ») et ce qu'il laisse (« Restent ») : les fiches du carnet qu'il n'a pas créées (et
// l'import d'où elles viennent), les postes retirés de ce mariage, remis « à trouver », les éléments
// modifiés à la main depuis (gardés, sauf la case), ceux qu'un autre module utilise (toujours gardés).
export type UndoSummary = {
  leaving: { budgetLines: number; newSlots: string[]; paidPayments: number; duePayments: number; vendors: number; createdFiches: number; tasks: number; events: number; others: number };
  staying: { carnetFiches: number; carnetSources: string[]; restoredSlots: string[]; modified: number; usedElsewhere: number };
};

export type UndoPreview = AppliedImportView & { pendingItems: UndoPreviewItem[]; summary: UndoSummary };

const valuesOf = (item: Pick<AppliedImportItem, "written" | "previous">) => (item.written ?? item.previous ?? {}) as Record<string, unknown>;

export function undoSummary(items: readonly UndoPreviewItem[], context: { carnetSources?: string[] } = {}): UndoSummary {
  const leaving: UndoSummary["leaving"] = { budgetLines: 0, newSlots: [], paidPayments: 0, duePayments: 0, vendors: 0, createdFiches: 0, tasks: 0, events: 0, others: 0 };
  const staying: UndoSummary["staying"] = { carnetFiches: 0, carnetSources: context.carnetSources ?? [], restoredSlots: [], modified: 0, usedElsewhere: 0 };
  const createdFiches = new Set(items.filter((item) => item.module === "vendors" && item.kind === "vendor" && item.action === "created").map((item) => item.elementId));
  const linkedFiches = new Set<string>();
  for (const item of items) {
    const values = valuesOf(item);
    if (item.module === "events" && item.kind === "event_vendor_candidate" && typeof values.vendorId === "string" && !createdFiches.has(values.vendorId)) linkedFiches.add(values.vendorId);
    if (item.usedElsewhere) {
      staying.usedElsewhere += 1;
      continue;
    }
    if (item.module === "events" && item.kind === "event_vendor_slot" && item.action === "updated" && values.notRequired === true) {
      staying.restoredSlots.push(String((item.previous as Record<string, unknown> | null)?.label ?? values.label ?? ""));
      continue;
    }
    if (item.modified) {
      staying.modified += 1;
      continue;
    }
    if (item.kind === "budget_line") {
      leaving.budgetLines += 1;
      const payments = Array.isArray(values.payments) ? (values.payments as { paidOn?: string | null }[]) : [];
      leaving.paidPayments += payments.filter((payment) => payment.paidOn).length;
      leaving.duePayments += payments.filter((payment) => !payment.paidOn).length;
    } else if (item.kind === "event_vendor_slot" && item.action === "created") leaving.newSlots.push(String(values.label ?? ""));
    else if (item.kind === "event_vendor_candidate") leaving.vendors += 1;
    else if (item.kind === "vendor" && item.action === "created") leaving.createdFiches += 1;
    else if (item.kind === "task") leaving.tasks += 1;
    else if (item.kind === "event") leaving.events += 1;
    else if (item.kind !== "event_vendor_slot") leaving.others += 1;
  }
  staying.carnetFiches = linkedFiches.size;
  return { leaving, staying };
}

async function modifiedFlags(organizationId: string, items: AppliedImportItem[]): Promise<boolean[]> {
  const flags = new Array<boolean>(items.length).fill(false);
  for (const module of ["events", "budget", "quotes", "vendors", "hub"] as const) {
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
            : module === "hub"
              ? await findModifiedImportedHubElements(organizationId, subset)
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

export async function getUndoPreview(organizationId: string, importId: string, now: Date = new Date()): Promise<UndoPreview | null> {
  const view = await withHubDb((db) => getAppliedImport(db, organizationId, importId, now));
  if (!view) return null;
  const pending = view.items.filter((item) => item.undoOutcome !== "undone" && item.undoOutcome !== "missing");
  const flags = await modifiedFlags(organizationId, pending);
  const withQuotes = await eventsWithQuotes(organizationId, importedEventIds(pending));
  // Lot 36b : un contact créé par l'import, devenu depuis client d'un évènement, est gardé.
  const createdContacts = pending.filter((item) => item.module === "hub" && item.kind === "contact" && item.action === "created").map((item) => item.elementId);
  const linkedContacts = createdContacts.length > 0 ? await listLinkedContactIds(organizationId, createdContacts) : new Set<string>();
  const pendingItems = pending.map((item, index) => ({
    ...item,
    modified: flags[index] ?? false,
    usedElsewhere: withQuotes.has(item.elementId) || (item.module === "hub" && item.kind === "contact" && item.action === "created" && linkedContacts.has(item.elementId)),
  }));
  // Les fiches du carnet que cet import n'a pas créées : l'import qui les a apportées, s'il y en a un.
  const linked = [...new Set(pendingItems.flatMap((item) => (item.kind === "event_vendor_candidate" && typeof valuesOf(item).vendorId === "string" ? [valuesOf(item).vendorId as string] : [])))];
  const carnetSources = linked.length > 0 ? await withHubDb((db) => listImportFilesOfElements(db, organizationId, { module: "vendors", kind: "vendor", elementIds: linked, exceptImportId: importId })) : [];
  return { ...view, pendingItems, summary: undoSummary(pendingItems, { carnetSources }) };
}

export type UndoImportResult =
  | { status: "done"; outcomes: Record<ImportUndoOutcome, number> }
  | { status: "not_found" }
  | { status: "expired" }
  // Lot 71d (I10) : la fiche d'un mariage qui a d'autres imports se retire avec toute la reprise.
  | { status: "takeover_has_imports" };

// « Quand elle annule un import déjà confirmé, alors les éléments créés sont
// supprimés et les éléments mis à jour retrouvent leurs valeurs précédentes.
// Étant donné un élément modifié à la main depuis l'import, alors l'app le
// signale et ne l'écrase pas sans confirmation » : `forceItemIds` porte les
// éléments modifiés que la planner a confirmé vouloir annuler. Lot 71d : `forceModified`, la case
// « Retirer aussi les lignes modifiées depuis » (relue ici, jamais prise du formulaire).
export async function undoImport(input: {
  organizationId: string;
  userId: string;
  importId: string;
  forceItemIds?: string[];
  forceModified?: boolean;
  now?: Date;
}): Promise<UndoImportResult> {
  const now = input.now ?? new Date();
  const preview = await getUndoPreview(input.organizationId, input.importId, now);
  if (!preview) return { status: "not_found" };
  if (!preview.undoable) return { status: "expired" };
  if ((await takeoverRemoval(input.organizationId, input.importId, now))?.otherImports.length) return { status: "takeover_has_imports" };
  // Lot 15 : un placement sur la carte en cours s'arrête avant l'annulation.
  await withHubDb((db) => cancelImportJobs(db, input.organizationId, input.importId));

  const force = new Set(input.forceModified ? preview.pendingItems.filter((item) => item.modified && !item.usedElsewhere).map((item) => item.id) : (input.forceItemIds ?? []));
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
  await withHubDb((db) => recordImportUndo(db, { organizationId: input.organizationId, importId: input.importId, outcomes: recorded, now }));
  // Lot 71d (critère 6) : la ligne de la reprise repasse « à faire » ; un mariage retiré n'est plus le sien.
  const removedEventIds = items.filter((item, position) => item.kind === "event" && item.action === "created" && outcomes[position] === "undone").map((item) => item.elementId);
  await withHubDb((db) => releaseTakeoverStepsOfImport(db, { organizationId: input.organizationId, importId: input.importId, removedEventIds, now }));

  const counts: Record<ImportUndoOutcome, number> = { undone: 0, kept_modified: 0, kept_in_use: 0, missing: 0 };
  for (const { outcome } of recorded) counts[outcome] += 1;
  return { status: "done", outcomes: counts };
}

// —— Retirer toute la reprise (lot 71d, décision I10) ———————————————————————————————————

// La fiche d'un mariage (l'import qui a créé le mariage de sa reprise) et les autres imports appliqués
// de cette reprise, du plus récent au plus ancien ; le carnet de l'agence (prestataires.csv) n'en fait
// pas partie : il sert à tous les mariages. null : pas la fiche d'un mariage repris.
export type TakeoverRemoval = {
  takeoverId: string;
  eventId: string;
  sheet: TakeoverImport;
  otherImports: (TakeoverImport & { undoable: boolean; undoDeadline: Date | null })[];
  // Les imports qui ont passé leur date limite : le retrait d'ensemble n'est pas proposé.
  expired: string[];
};

export async function takeoverRemoval(organizationId: string, importId: string, now: Date = new Date()): Promise<TakeoverRemoval | null> {
  const view = await withHubDb((db) => getAppliedImport(db, organizationId, importId, now));
  if (!view || view.status !== "applied" || (view.entityType !== "event_sheets" && view.entityType !== "events")) return null;
  const takeoverId = await withHubDb((db) => getImportTakeoverId(db, organizationId, importId));
  if (!takeoverId) return null;
  const takeover = await withHubDb((db) => getTakeover(db, organizationId, takeoverId));
  const created = view.items.filter((item) => item.kind === "event" && item.action === "created" && item.undoOutcome === null).map((item) => item.elementId);
  if (!takeover?.eventId || !created.includes(takeover.eventId)) return null;
  const list = await withHubDb((db) => listTakeoverAppliedImports(db, organizationId, takeoverId));
  const sheet = list.find((entry) => entry.id === importId);
  if (!sheet) return null;
  const others = [];
  for (const entry of list.filter((candidate) => candidate.id !== importId && candidate.entityType !== "vendors")) {
    const applied = await withHubDb((db) => getAppliedImport(db, organizationId, entry.id, now));
    others.push({ ...entry, undoable: applied?.undoable ?? false, undoDeadline: applied?.undoDeadline ?? null });
  }
  const sheetExpired = !view.undoable ? [sheet.fileName] : [];
  return { takeoverId, eventId: takeover.eventId, sheet, otherImports: others, expired: [...others.filter((entry) => !entry.undoable).map((entry) => entry.fileName), ...sheetExpired] };
}

export type UndoTakeoverResult = { status: "done"; imports: number } | { status: "not_found" } | { status: "expired"; files: string[] } | { status: "in_use" } | { status: "failed" };

// « Retirer toute la reprise… » : les imports du plus récent au plus ancien, puis la fiche et le mariage,
// dans une seule transaction ; en cas d'échec, rien n'est retiré. Tout ce que ces imports ont écrit part,
// lignes modifiées depuis comprises (la case de la fenêtre le dit) ; restent les fiches du carnet venues
// d'un autre import. Un mariage qui a reçu un devis n'est jamais retiré (ADR 0010). `afterEachImport` :
// pour les tests, une étape qui échoue au milieu.
export async function undoTakeover(input: {
  organizationId: string;
  userId: string;
  importId: string;
  now?: Date;
  afterEachImport?: (importId: string) => Promise<void>;
}): Promise<UndoTakeoverResult> {
  const now = input.now ?? new Date();
  const removal = await takeoverRemoval(input.organizationId, input.importId, now);
  if (!removal) return { status: "not_found" };
  if (removal.expired.length > 0) return { status: "expired", files: removal.expired };
  const order = [...removal.otherImports.map((entry) => entry.id), removal.sheet.id];
  const previews: UndoPreview[] = [];
  for (const id of order) {
    const preview = await getUndoPreview(input.organizationId, id, now);
    if (!preview?.undoable) return { status: "expired", files: [preview?.fileName ?? ""] };
    if (preview.pendingItems.some((item) => item.usedElsewhere || (item.module !== "events" && item.module !== "budget" && item.module !== "vendors"))) return { status: "in_use" };
    previews.push(preview);
  }
  // Une ligne de budget saisie à la main dans ce mariage ne disparaît pas avec un retrait d'imports.
  const importedLines = new Set(previews.flatMap((preview) => preview.pendingItems.filter((item) => item.kind === "budget_line" && item.action === "created").map((item) => item.elementId)));
  if ((await listBudgetLines(input.organizationId, removal.eventId)).lines.some((line) => !importedLines.has(line.id))) return { status: "in_use" };
  for (const id of order) await withHubDb((db) => cancelImportJobs(db, input.organizationId, id));
  try {
    await withOrganization(appDatabase(), input.organizationId, async (tx) => {
      const asDb = tx as unknown as AppDatabase;
      for (const preview of previews) {
        const items = preview.pendingItems.map((item) => ({ ...item, module: item.module as ImportedItem["module"], written: item.written ?? {} }));
        const outcomes = await undoItems(input.organizationId, input.userId, items, () => true, tx);
        if (outcomes.some((outcome) => outcome !== "undone" && outcome !== "missing")) throw new Error("élément gardé dans un retrait d'ensemble");
        await recordImportUndo(asDb, { organizationId: input.organizationId, importId: preview.id, outcomes: preview.pendingItems.map((item, position) => ({ itemId: item.id, outcome: outcomes[position] ?? "missing" })), now });
        if (input.afterEachImport) await input.afterEachImport(preview.id);
      }
      await deleteTakeover(asDb, { organizationId: input.organizationId, takeoverId: removal.takeoverId });
    });
  } catch (error) {
    console.error("retrait d'ensemble d'une reprise échoué, rien n'est retiré", { organizationId: input.organizationId, importId: input.importId, error: error instanceof Error ? error.message : "inconnue" });
    return { status: "failed" };
  }
  return { status: "done", imports: order.length };
}
