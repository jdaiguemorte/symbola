// IMP-03 — rapprochements d'un import en cours : chaque ligne valide est
// comparée aux éléments existants de l'organisation (mêmes clients et même
// date pour un événement, même intitulé pour un article ou une liste, même
// intitulé dans le même événement pour une tâche ou un poste), avec le
// niveau de ressemblance. Orchestration entre le hub (import en cours) et les
// modules (éléments existants), qui ne se connaissent que par leur
// service.ts — même patron que lib/demo-purge.ts.
import { IMPORT_FIELDS, type ImportEntityType } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import {
  bestMatch,
  cleanVendorImportText,
  eventSimilarity,
  labelSimilarity,
  matchVendorType,
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
  saveImportMatching,
  setManualImportMatch,
  type ImportMatch,
  type ImportMatching,
  type ImportRowEvent,
  type ImportVendorTypeChoice,
  type ImportWorkingSet,
  type MatchDecision,
} from "@/modules/hub/service";
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

async function withHubDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
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

// Décision N : types du fichier (sans doublon, casse et accents près),
// rapprochés d'un type du carnet ou à créer.
async function computeVendorTypeChoices(organizationId: string, rows: ParsedImportRow[]): Promise<ImportVendorTypeChoice[]> {
  const types = await listVendorTypeCandidates(organizationId);
  const groups = starterVendorTypeSynonymGroups();
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
    const match = matchVendorType(label, types, groups);
    byKey.set(key, { label, rowCount: 1, typeId: match?.typeId ?? null, score: match?.score ?? 0, manual: false });
  }
  return [...byKey.values()].sort((a, b) => b.rowCount - a.rowCount || a.label.localeCompare(b.label, "fr"));
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

  if (set.entityType === "events") {
    const events = await listEventCandidates(organizationId);
    const candidates = events.map((event) => ({ id: event.id, value: event }));
    for (const row of rows) proposed(row.rowIndex, bestMatch(rowEventReference(row.values), candidates, eventSimilarity));
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
};

export type MatchesView = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  rows: MatchesRowView[];
  // Lot 14 (décision N) : types du fichier et types du carnet proposés.
  vendorTypes?: (ImportVendorTypeChoice & { typeLabel: string | null })[];
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
  const isEventType = set.entityType === "events";
  const hasEventReference = set.entityType === "tasks" || set.entityType === "budget_lines";
  const events = isEventType || hasEventReference ? await listEventCandidates(organizationId) : [];
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const isVendorType = set.entityType === "vendors";
  const labelCandidates = isVendorType
    ? (await listVendorCandidates(organizationId)).map((vendor) => ({ id: vendor.id, label: vendorCandidateLabel(vendor) }))
    : !isEventType && !hasEventReference
      ? await listLabelCandidates(organizationId, set.entityType)
      : [];
  const itemsByEvent = new Map<string, LabelCandidate[]>();
  const itemsOf = async (eventId: string) => {
    let items = itemsByEvent.get(eventId);
    if (!items) {
      items = await listEventItemCandidates(organizationId, set.entityType as "tasks" | "budget_lines", eventId);
      itemsByEvent.set(eventId, items);
    }
    return items;
  };

  const rows: MatchesRowView[] = [];
  for (const row of parsed) {
    const resolution = matching.rowEvents.find((rowEvent) => rowEvent.rowIndex === row.rowIndex);
    let options: MatchesRowView["options"] = [];
    if (row.errors.length === 0) {
      if (isEventType) options = events.map((event) => ({ id: event.id, label: null, event }));
      else if (hasEventReference) options = resolution?.eventId ? (await itemsOf(resolution.eventId)).map((item) => ({ ...item, event: null })) : [];
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
    });
  }
  if (!isVendorType) return { importId: set.importId, entityType: set.entityType, fileName: set.fileName, rows };
  const typeOptions = await listVendorTypeCandidates(organizationId);
  const typeLabels = new Map(typeOptions.map((type) => [type.id, type.label]));
  const vendorTypes = (matching.vendorTypes ?? []).map((choice) => ({
    ...choice,
    // Un type du carnet supprimé depuis : le type du fichier sera créé.
    typeId: choice.typeId && typeLabels.has(choice.typeId) ? choice.typeId : null,
    typeLabel: choice.typeId ? (typeLabels.get(choice.typeId) ?? null) : null,
  }));
  return { importId: set.importId, entityType: set.entityType, fileName: set.fileName, rows, vendorTypes, typeOptions };
}

// Décision N : la planner rapproche un type du fichier d'un type du carnet
// (de son organisation) ou choisit de le créer (typeId null).
export async function decideVendorTypes(organizationId: string, importId: string, decisions: { label: string; typeId: string | null }[]): Promise<boolean> {
  const types = new Set((await listVendorTypeCandidates(organizationId)).map((type) => type.id));
  if (decisions.some((decision) => decision.typeId !== null && !types.has(decision.typeId))) return false;
  return withHubDb((db) => decideImportVendorTypes(db, { organizationId, importId, decisions }));
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
