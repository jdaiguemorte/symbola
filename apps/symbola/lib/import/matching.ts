// IMP-03 — rapprochements d'un import en cours : chaque ligne valide est
// comparée aux éléments existants de l'organisation (mêmes clients et même
// date pour un événement, même intitulé pour un article ou une liste, même
// intitulé dans le même événement pour une tâche ou un poste), avec le
// niveau de ressemblance. Orchestration entre le hub (import en cours) et les
// modules (éléments existants), qui ne se connaissent que par leur
// service.ts — même patron que lib/demo-purge.ts.
import { EVENT_STATUS_CHOICES, IMPORT_FIELDS, type ImportEntityType } from "@symbola/contracts";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import {
  EVENT_SHEET_COLUMNS,
  bestMatch,
  cleanVendorImportText,
  eventSimilarity,
  labelSimilarity,
  matchVendorType,
  normalizeLabel,
  parseImportRows,
  vendorSimilarity,
  type ImportValue,
  type ParsedImportRow,
  type PersonName,
  type RowError,
} from "@symbola/import-engine";
import { starterImportSynonyms, starterVendorTypeSynonymGroups } from "@symbola/starter-templates";
import {
  decideImportMatches,
  decideImportVendorTypes,
  getImportWorkingSet,
  setImportRowStatuses,
  saveImportMatching,
  setManualImportMatch,
  type ImportMatch,
  type ImportMatching,
  type ImportRowEvent,
  type ImportVendorTypeChoice,
  type ImportVendorTypeTarget,
  type ImportWorkingSet,
  type MatchDecision,
} from "@/modules/hub/service";
import { listVendorFamilies, listVendorTypes, type VendorFamily, type VendorType } from "@/modules/vendors/service";
import { ensureVendorFamilies, organizationMetier, vendorCatalogInput } from "@/lib/vendors/catalog";
import {
  listEventCandidates,
  listEventItemCandidates,
  listLabelCandidates,
  listVendorCandidates,
  listVendorTypeCandidates,
  type EventCandidate,
  type LabelCandidate,
  type VendorCandidate,
} from "./candidates";

// Une tâche ou un poste ne se rattache qu'à un événement reconnu sans doute :
// ressemblance d'au moins 80, et nettement devant le deuxième.
const EVENT_REFERENCE_THRESHOLD = 80;
const EVENT_REFERENCE_MARGIN = 5;

async function withHubDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await fn(db);
}

export function parseWorkingSetRows(set: ImportWorkingSet): ParsedImportRow[] {
  const rows = parseImportRows({
    headers: set.headers,
    rows: set.rows,
    sourceLineNumbers: set.sourceLineNumbers,
    assignments: set.mapping,
    fields: IMPORT_FIELDS[set.entityType],
    synonyms: starterImportSynonyms(),
  });
  if (set.entityType === "event_sheets") {
    // Lot 14c : une fiche refusée à la lecture porte son seul motif.
    const rejectionColumn = EVENT_SHEET_COLUMNS.indexOf("rejection");
    return rows.map((row) => {
      const reason = set.rows[row.rowIndex]?.[rejectionColumn] ?? "";
      return reason ? { ...row, errors: [{ fieldKey: "source", code: "sheet_rejected" as const, value: reason }] } : row;
    });
  }
  if (set.entityType !== "vendors") return rows;
  // Lot 14 (IMP-07) : valeurs du carnet remises en état dès la lecture
  // (entités HTML, code postal), pour l'aperçu comme pour l'écriture.
  return rows.map((row) => ({
    ...row,
    values: Object.fromEntries(
      Object.entries(row.values).map(([key, value]) => {
        if (typeof value !== "string") return [key, value];
        const clean = cleanVendorImportText(key, value);
        return [key, clean === "" ? null : clean];
      }),
    ),
    errors: row.errors.length > 0 || cleanVendorImportText("name", String(row.values.name ?? "")) !== "" ? row.errors : [...row.errors, { fieldKey: "name", code: "required_missing" as const, value: "" }],
  }));
}

function vendorReference(values: Record<string, ImportValue>): { name: string; city: string | null } {
  return { name: text(values.name) ?? "", city: text(values.city) };
}

export function vendorCandidateLabel(candidate: VendorCandidate): string {
  return candidate.city ? `${candidate.name} — ${candidate.city}` : candidate.name;
}

// Lot 14c (IMP-08) — fiches du lot aux mêmes mariés et à la même date :
// signalées (la planner ne garde que l'une, en rapprochant ou en retirant).
const DUPLICATE_SHEET_SCORE = 90;

function findDuplicateSheets(rows: ParsedImportRow[]): { rowIndex: number; sameAsRowIndex: number }[] {
  const duplicates: { rowIndex: number; sameAsRowIndex: number }[] = [];
  rows.forEach((row, position) => {
    const reference = rowEventReference(row.values);
    const earlier = rows.slice(0, position).find((other) => eventSimilarity(reference, rowEventReference(other.values)) >= DUPLICATE_SHEET_SCORE);
    if (earlier) duplicates.push({ rowIndex: row.rowIndex, sameAsRowIndex: earlier.rowIndex });
  });
  return duplicates;
}

// Rapprochement à la main d'une ligne du carnet : les fiches aux noms les
// plus proches seulement (un carnet compte des centaines de fiches).
const VENDOR_OPTIONS = 10;

function closestVendors(values: Record<string, ImportValue>, candidates: VendorCandidate[]): MatchesRowView["options"] {
  const reference = vendorReference(values);
  return candidates
    .map((candidate) => ({ candidate, score: vendorSimilarity(reference, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, VENDOR_OPTIONS)
    .map(({ candidate }) => ({ id: candidate.id, label: vendorCandidateLabel(candidate), event: null }));
}

// Lot 16 (IMP-12, ADR 0040) — libellé normalisé pour reconnaître un type de
// départ : « & » vaut « et » (« Vins & Boissons » = « Vins et boissons »).
const starterLabelKey = (label: string) =>
  normalizeLabel(label)
    .filter((token) => token !== "et" && token !== "and")
    .join(" ");

export type VendorTypeCatalog = {
  types: VendorType[];
  families: VendorFamily[];
  // Types de départ du métier de l'organisation, avec la clé de leur famille de départ.
  starters: { key: string; label: string; familyKey: string; familyColor: string; synonyms: string[] }[];
};

export async function loadVendorTypeCatalog(organizationId: string, locale: "fr" | "en" = "fr"): Promise<VendorTypeCatalog> {
  // Organisation d'avant le lot 16 : ses familles sont posées avant de ranger les types du fichier.
  await ensureVendorFamilies(organizationId, locale);
  const [types, families, metier] = await Promise.all([listVendorTypes(organizationId), listVendorFamilies(organizationId), organizationMetier(organizationId)]);
  const starters = vendorCatalogInput(locale, metier).flatMap((family) =>
    family.types.map((type) => ({ key: type.key, label: type.label, familyKey: family.key, familyColor: family.color, synonyms: type.synonyms })),
  );
  return { types, families, starters };
}

// Famille où s'affiche un libellé du fichier (null : « à classer »).
export function targetFamilyId(target: ImportVendorTypeTarget, catalog: VendorTypeCatalog): string | null {
  if (target.kind === "existing") return catalog.types.find((type) => type.id === target.typeId)?.familyId ?? null;
  if (target.kind === "new") return target.familyId;
  if (target.kind === "starter") {
    const starter = catalog.starters.find((candidate) => candidate.key === target.starterKey);
    return catalog.families.find((family) => family.starterKey === starter?.familyKey)?.id ?? null;
  }
  return null;
}

// IMP-12 — chaque libellé est rattaché, dans l'ordre : à un type du carnet
// (synonyme ou ressemblance) ; à un type de départ de sa famille, créé une
// seule fois pour tous ses synonymes ; sinon à « à classer ». Jamais un type
// par libellé par défaut.
export function proposeVendorTypeTarget(label: string, catalog: VendorTypeCatalog): { target: ImportVendorTypeTarget; score: number } {
  const match = matchVendorType(label, catalog.types, starterVendorTypeSynonymGroups());
  if (match) return { target: { kind: "existing", typeId: match.typeId }, score: match.score };
  const key = starterLabelKey(label);
  const starter = catalog.starters.find((candidate) => candidate.synonyms.some((synonym) => starterLabelKey(synonym) === key));
  if (!starter) return { target: { kind: "none" }, score: 0 };
  const renamed = catalog.types.find((type) => type.starterKey === starter.key);
  if (renamed) return { target: { kind: "existing", typeId: renamed.id }, score: 100 };
  return { target: { kind: "starter", starterKey: starter.key }, score: 100 };
}

// Décision N : types du fichier (sans doublon, casse et accents près),
// rapprochés d'un type du carnet, d'un type de départ ou laissés « à classer ».
async function computeVendorTypeChoices(organizationId: string, rows: ParsedImportRow[]): Promise<ImportVendorTypeChoice[]> {
  const catalog = await loadVendorTypeCatalog(organizationId);
  const byKey = new Map<string, ImportVendorTypeChoice>();
  for (const row of rows) {
    const label = text(row.values.type);
    if (!label) continue;
    const key = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim();
    const existing = byKey.get(key);
    if (existing) {
      existing.rowCount += 1;
      continue;
    }
    const { target, score } = proposeVendorTypeTarget(label, catalog);
    byKey.set(key, { label, rowCount: 1, typeId: target.kind === "existing" ? target.typeId : null, score, manual: false, target });
  }
  return [...byKey.values()].sort((a, b) => b.rowCount - a.rowCount || a.label.localeCompare(b.label, "fr"));
}

// Cible d'un choix enregistré : celle d'IMP-12, sinon celle des imports d'avant
// le lot 16 (type du carnet, ou type créé sous le libellé du fichier).
export function choiceTarget(choice: ImportVendorTypeChoice): ImportVendorTypeTarget {
  return choice.target ?? (choice.typeId ? { kind: "existing", typeId: choice.typeId } : { kind: "new", familyId: null });
}

function text(value: ImportValue | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// Clients et date d'une ligne : un événement importé, ou l'événement auquel
// se rattache une tâche ou une ligne de budget.
export function rowEventReference(values: Record<string, ImportValue>): { eventDate: string | null; clients: PersonName[] } {
  const clients: PersonName[] = [];
  for (const index of [1, 2]) {
    const firstName = text(values[`client${index}FirstName`]);
    const lastName = text(values[`client${index}LastName`]);
    if (firstName || lastName) clients.push({ firstName: firstName ?? "", lastName });
  }
  return { eventDate: text(values.eventDate), clients };
}

function resolveEvent(row: ParsedImportRow, events: EventCandidate[]): ImportRowEvent {
  const reference = rowEventReference(row.values);
  if (reference.clients.length === 0) return { rowIndex: row.rowIndex, eventId: null, score: 0 };
  const scores = events
    .map((event) => ({ id: event.id, score: eventSimilarity(reference, event) }))
    .sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  const unique = first && first.score >= EVENT_REFERENCE_THRESHOLD && (!second || second.score < first.score - EVENT_REFERENCE_MARGIN);
  return { rowIndex: row.rowIndex, eventId: unique ? first.id : null, score: first?.score ?? 0 };
}

function rowLabel(entityType: ImportEntityType, values: Record<string, ImportValue>): string | null {
  return text(entityType === "budget_lines" ? values.slotLabel : values.label);
}

function asCandidates(items: LabelCandidate[]) {
  return items.map((item) => ({ id: item.id, value: item.label }));
}

export async function computeImportMatching(organizationId: string, set: ImportWorkingSet): Promise<ImportMatching> {
  const rows = parseWorkingSetRows(set).filter((row) => row.errors.length === 0);
  const matches: ImportMatch[] = [];
  const rowEvents: ImportRowEvent[] = [];
  const proposed = (rowIndex: number, match: { id: string; score: number } | null) => {
    if (match) matches.push({ rowIndex, candidateId: match.id, score: match.score, status: "proposed", manual: false });
  };

  if (set.entityType === "events" || set.entityType === "event_sheets") {
    const events = await listEventCandidates(organizationId);
    const candidates = events.map((event) => ({ id: event.id, value: event }));
    for (const row of rows) proposed(row.rowIndex, bestMatch(rowEventReference(row.values), candidates, eventSimilarity));
    // IMP-08 : deux fiches du même lot qui décrivent le même événement.
    if (set.entityType === "event_sheets") return { matches, rowEvents, duplicates: findDuplicateSheets(rows) };
  } else if (set.entityType === "vendors") {
    const candidates = (await listVendorCandidates(organizationId)).map((vendor) => ({ id: vendor.id, value: vendor }));
    for (const row of rows) proposed(row.rowIndex, bestMatch(vendorReference(row.values), candidates, vendorSimilarity));
    return { matches, rowEvents, vendorTypes: await computeVendorTypeChoices(organizationId, rows) };
  } else if (set.entityType === "tasks" || set.entityType === "budget_lines") {
    const events = await listEventCandidates(organizationId);
    const itemsByEvent = new Map<string, LabelCandidate[]>();
    for (const row of rows) {
      const resolution = resolveEvent(row, events);
      rowEvents.push(resolution);
      const label = rowLabel(set.entityType, row.values);
      if (!resolution.eventId || !label) continue;
      let items = itemsByEvent.get(resolution.eventId);
      if (!items) {
        items = await listEventItemCandidates(organizationId, set.entityType, resolution.eventId);
        itemsByEvent.set(resolution.eventId, items);
      }
      proposed(row.rowIndex, bestMatch(label, asCandidates(items), labelSimilarity));
    }
  } else {
    const candidates = asCandidates(await listLabelCandidates(organizationId, set.entityType));
    for (const row of rows) {
      const label = rowLabel(set.entityType, row.values);
      if (label) proposed(row.rowIndex, bestMatch(label, candidates, labelSimilarity));
    }
  }

  return { matches, rowEvents };
}

// Vue de l'étape « rapprochements ». Les rapprochements sont calculés à la
// première ouverture (puis gardés avec les décisions de la planner) ; ils
// sont recalculés si les colonnes changent.
export type MatchesRowView = {
  rowIndex: number;
  lineNumber: number;
  values: Record<string, ImportValue>;
  errors: RowError[];
  // Tâches et lignes de budget : événement reconnu, ou null (introuvable).
  event?: { eventId: string | null; score: number; candidate: EventCandidate | null };
  match: (ImportMatch & { label: string | null; event: EventCandidate | null }) | null;
  // Éléments proposés pour un rapprochement ajouté à la main.
  options: { id: string; label: string | null; event: EventCandidate | null }[];
  // Lot 14c : fiche du même lot qui décrit déjà cet événement (n° de ligne).
  sameAsLine?: number;
};

export type MatchesView = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  rows: MatchesRowView[];
  // Lot 14 (décision N) : types du fichier et types du carnet proposés.
  vendorTypes?: (ImportVendorTypeChoice & { typeLabel: string | null; target: ImportVendorTypeTarget })[];
  typeOptions?: LabelCandidate[];
};

export async function getImportMatchesView(organizationId: string, importId: string): Promise<MatchesView | null> {
  const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
  if (!set) return null;
  let matching = set.matching;
  if (!matching) {
    matching = await computeImportMatching(organizationId, set);
    const computed = matching;
    await withHubDb((db) => saveImportMatching(db, { organizationId, importId, matching: computed }));
  }

  const parsed = parseWorkingSetRows(set);
  const isEventType = set.entityType === "events" || set.entityType === "event_sheets";
  const hasEventReference = set.entityType === "tasks" || set.entityType === "budget_lines";
  const events = isEventType || hasEventReference ? await listEventCandidates(organizationId) : [];
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const isVendorType = set.entityType === "vendors";
  const vendorCandidates = isVendorType ? await listVendorCandidates(organizationId) : [];
  const labelCandidates = !isEventType && !hasEventReference && !isVendorType ? await listLabelCandidates(organizationId, set.entityType) : [];
  const itemsByEvent = new Map<string, LabelCandidate[]>();
  const itemsOf = async (eventId: string) => {
    let items = itemsByEvent.get(eventId);
    if (!items) {
      items = await listEventItemCandidates(organizationId, set.entityType as "tasks" | "budget_lines", eventId);
      itemsByEvent.set(eventId, items);
    }
    return items;
  };

  const lineOf = new Map(parsed.map((row) => [row.rowIndex, row.lineNumber]));
  const sameAs = (rowIndex: number) => {
    const duplicate = matching.duplicates?.find((entry) => entry.rowIndex === rowIndex);
    const line = duplicate ? lineOf.get(duplicate.sameAsRowIndex) : undefined;
    return line !== undefined ? { sameAsLine: line } : {};
  };
  // Décision J : statut choisi par la planner dans l'aperçu.
  const statusOverride = new Map((matching.rowStatuses ?? []).map((entry) => [entry.rowIndex, entry.status]));
  const rows: MatchesRowView[] = [];
  for (const row of parsed) {
    if (set.entityType === "event_sheets" && statusOverride.has(row.rowIndex)) row.values = { ...row.values, status: statusOverride.get(row.rowIndex)! };
    const resolution = matching.rowEvents.find((rowEvent) => rowEvent.rowIndex === row.rowIndex);
    let options: MatchesRowView["options"] = [];
    if (row.errors.length === 0) {
      if (isEventType) options = events.map((event) => ({ id: event.id, label: null, event }));
      else if (hasEventReference) options = resolution?.eventId ? (await itemsOf(resolution.eventId)).map((item) => ({ ...item, event: null })) : [];
      else if (isVendorType) options = closestVendors(row.values, vendorCandidates);
      else options = labelCandidates.map((item) => ({ ...item, event: null }));
    }
    const match = matching.matches.find((candidate) => candidate.rowIndex === row.rowIndex);
    const option = match ? options.find((candidate) => candidate.id === match.candidateId) : undefined;
    rows.push({
      rowIndex: row.rowIndex,
      lineNumber: row.lineNumber,
      values: row.values,
      errors: row.errors,
      ...(hasEventReference
        ? {
            event: {
              eventId: resolution?.eventId ?? null,
              score: resolution?.score ?? 0,
              candidate: resolution?.eventId ? (eventsById.get(resolution.eventId) ?? null) : null,
            },
          }
        : {}),
      match: match ? { ...match, label: option?.label ?? null, event: option?.event ?? null } : null,
      options,
      ...sameAs(row.rowIndex),
    });
  }
  if (!isVendorType) return { importId: set.importId, entityType: set.entityType, fileName: set.fileName, rows };
  const typeOptions = await listVendorTypeCandidates(organizationId);
  const typeLabels = new Map(typeOptions.map((type) => [type.id, type.label]));
  const vendorTypes = (matching.vendorTypes ?? []).map((choice) => {
    const target = choiceTarget(choice);
    // Un type du carnet supprimé depuis : la fiche part « à classer » (IMP-12).
    const gone = target.kind === "existing" && !typeLabels.has(target.typeId);
    return {
      ...choice,
      target: gone ? ({ kind: "none" } as const) : target,
      typeId: target.kind === "existing" && !gone ? target.typeId : null,
      typeLabel: target.kind === "existing" ? (typeLabels.get(target.typeId) ?? null) : null,
    };
  });
  return { importId: set.importId, entityType: set.entityType, fileName: set.fileName, rows, vendorTypes, typeOptions };
}

// Décision N, lot 16 (IMP-12) : pour chaque libellé, un type du carnet, un type
// de départ du métier, un type créé (dans une famille de l'organisation ou
// « à classer ») ou aucun type. Tout est vérifié contre l'organisation.
export async function decideVendorTypes(organizationId: string, importId: string, decisions: { label: string; target: ImportVendorTypeTarget }[]): Promise<boolean> {
  const catalog = await loadVendorTypeCatalog(organizationId);
  const valid = decisions.every(({ target }) => {
    if (target.kind === "existing") return catalog.types.some((type) => type.id === target.typeId);
    if (target.kind === "starter") return catalog.starters.some((starter) => starter.key === target.starterKey);
    if (target.kind === "new") return target.familyId === null || catalog.families.some((family) => family.id === target.familyId);
    return true;
  });
  if (!valid) return false;
  // Rapprochements calculés à la première ouverture : s'ils manquent encore, maintenant.
  if (!(await getImportMatchesView(organizationId, importId))) return false;
  return withHubDb((db) =>
    decideImportVendorTypes(db, {
      organizationId,
      importId,
      decisions: decisions.map(({ label, target }) => ({ label, typeId: target.kind === "existing" ? target.typeId : null, target })),
    }),
  );
}

// IMP-12 — étape « Types » : les libellés du fichier regroupés par famille, avec
// ce qu'ils deviennent ; les types de départ pas encore au carnet sont proposés.
export type ImportTypesView = {
  importId: string;
  fileName: string;
  families: VendorFamily[];
  types: VendorType[];
  starters: { key: string; label: string; familyId: string | null }[];
  choices: { label: string; rowCount: number; target: ImportVendorTypeTarget; familyId: string | null }[];
};

export async function getImportTypesView(organizationId: string, importId: string): Promise<ImportTypesView | null> {
  const matches = await getImportMatchesView(organizationId, importId);
  if (!matches || matches.entityType !== "vendors") return null;
  const catalog = await loadVendorTypeCatalog(organizationId);
  const starters = catalog.starters
    .filter((starter) => !catalog.types.some((type) => type.starterKey === starter.key))
    .map((starter) => ({ key: starter.key, label: starter.label, familyId: catalog.families.find((family) => family.starterKey === starter.familyKey)?.id ?? null }));
  const choices = (matches.vendorTypes ?? []).map((choice) => ({ label: choice.label, rowCount: choice.rowCount, target: choice.target, familyId: targetFamilyId(choice.target, catalog) }));
  return { importId, fileName: matches.fileName, families: catalog.families, types: catalog.types, starters, choices };
}

export async function decideMatches(organizationId: string, importId: string, decisions: MatchDecision[]): Promise<boolean> {
  return withHubDb((db) => decideImportMatches(db, { organizationId, importId, decisions }));
}

// Rapprochement ajouté à la main : l'élément doit faire partie de ceux
// proposés pour cette ligne (même organisation, même événement, hors essai).
export async function addManualMatch(organizationId: string, importId: string, rowIndex: number, candidateId: string): Promise<boolean> {
  const view = await getImportMatchesView(organizationId, importId);
  const row = view?.rows.find((candidate) => candidate.rowIndex === rowIndex);
  if (!row || !row.options.some((option) => option.id === candidateId)) return false;
  return withHubDb((db) => setManualImportMatch(db, { organizationId, importId, rowIndex, candidateId }));
}

// Lot 14c (décision J) — statut d'événements à créer depuis des fiches PDF,
// choisi dans l'aperçu : une valeur de la liste des statuts seulement.
export async function setEventSheetStatuses(organizationId: string, importId: string, statuses: { rowIndex: number; status: string }[]): Promise<boolean> {
  const allowed = new Set<string>(EVENT_STATUS_CHOICES);
  if (statuses.some((entry) => !allowed.has(entry.status) || !Number.isInteger(entry.rowIndex))) return false;
  const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
  if (set?.entityType !== "event_sheets") return false;
  return withHubDb((db) => setImportRowStatuses(db, { organizationId, importId, statuses }));
}
