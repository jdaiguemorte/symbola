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
  importedContactValues,
  listContactImportCandidates,
  normalizeContactEmail,
  setImportRowFilter,
  setImportRowStatuses,
  saveImportMatching,
  setManualImportMatch,
  type ContactImportCandidate,
  type ImportMatch,
  type ImportMatching,
  type ImportRowEvent,
  type ImportVendorTypeChoice,
  type ImportVendorTypeTarget,
  type ImportWorkingSet,
  type MatchDecision,
} from "@/modules/hub/service";
import { getVendorContacts, getVendorsByIds, listVendorFamilies, listVendorTypes, type VendorFamily, type VendorType } from "@/modules/vendors/service";
import { listVendorConsultations } from "@/modules/events/service";
import { compareVendorRecords, onlyOneNameInCommon, vendorMatchNeedsCheck, type VendorCompareLine } from "./vendor-compare";
import { ensureVendorFamilies, vendorCatalogInput } from "@/lib/vendors/catalog";
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
  if (set.entityType === "contacts") return contactRows(set, rows);
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

// Lot 36b (D11) — valeur d'une cellule repliée, pour comparer les valeurs d'une colonne
// (« Prestataire  », « prestataire » et « PRESTATAIRE » sont une seule valeur).
export function foldedCell(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Lot 36b (HUB-14, D11) — lignes d'un import de contacts : écartées selon la colonne choisie
// (la ligne garde ce seul motif, pour l'export des lignes écartées), sans nom, ou à l'adresse
// e-mail illisible.
function contactRows(set: ImportWorkingSet, rows: ParsedImportRow[]): ParsedImportRow[] {
  const filter = set.matching?.rowFilter;
  const excluded = new Set(filter?.excluded ?? []);
  return rows.map((row) => {
    if (filter && excluded.size > 0) {
      const cell = set.rows[row.rowIndex]?.[filter.columnIndex] ?? "";
      if (excluded.has(foldedCell(cell))) {
        return { ...row, errors: [{ fieldKey: set.headers[filter.columnIndex] ?? "", code: "excluded_by_filter" as const, value: cell.trim() }] };
      }
    }
    const errors = [...row.errors];
    if (!importedContactValues(row.values)) errors.push({ fieldKey: "contactName", code: "required_missing" as const, value: "" });
    const email = text(row.values.email);
    if (email) {
      try {
        normalizeContactEmail(email);
      } catch {
        errors.push({ fieldKey: "email", code: "invalid_email" as const, value: email });
      }
    }
    return errors.length === row.errors.length ? row : { ...row, errors };
  });
}

// Nom replié d'une personne, pour reconnaître le même nom écrit autrement (« HENRY Mathieu »,
// « Mathieu Henry »).
function foldedPersonName(firstName: string | null, lastName: string | null): string {
  return foldedCell([firstName, lastName].filter(Boolean).join(" "))
    .split(" ")
    .sort()
    .join(" ");
}

export function contactCandidateLabel(candidate: ContactImportCandidate): string {
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ");
  return [name, candidate.email, candidate.city].filter(Boolean).join(" — ");
}

// Un contact rapproché par son nom reste à vérifier (sous le seuil de « Tout accepter ») ; par son
// adresse e-mail, il est sûr.
const CONTACT_EMAIL_SCORE = 100;
const CONTACT_NAME_SCORE = 80;

// Lot 36b (DAT-12) — une ligne dont l'adresse est déjà connue de l'organisation rapproche son
// contact ; sinon, un contact au même nom (sans autre adresse). Une adresse déjà vue plus haut dans
// le fichier : la ligne complète la première (signalée, la planner peut l'ignorer).
function computeContactMatching(rows: ParsedImportRow[], candidates: ContactImportCandidate[]): Pick<ImportMatching, "matches" | "duplicates"> {
  const byEmail = new Map(candidates.filter((candidate) => candidate.email).map((candidate) => [candidate.email!, candidate]));
  const byName = new Map<string, ContactImportCandidate[]>();
  for (const candidate of candidates) {
    const key = foldedPersonName(candidate.firstName, candidate.lastName);
    byName.set(key, [...(byName.get(key) ?? []), candidate]);
  }
  const matches: ImportMatch[] = [];
  const duplicates: { rowIndex: number; sameAsRowIndex: number }[] = [];
  const firstRowOfEmail = new Map<string, number>();
  for (const row of rows) {
    const values = importedContactValues(row.values);
    if (!values) continue;
    if (values.email) {
      const earlier = firstRowOfEmail.get(values.email);
      if (earlier !== undefined) duplicates.push({ rowIndex: row.rowIndex, sameAsRowIndex: earlier });
      else firstRowOfEmail.set(values.email, row.rowIndex);
      const owner = byEmail.get(values.email);
      if (owner) {
        matches.push({ rowIndex: row.rowIndex, candidateId: owner.id, score: CONTACT_EMAIL_SCORE, status: "proposed", manual: false, reason: "email" });
        continue;
      }
      if (earlier !== undefined) continue;
    }
    const sameName = (byName.get(foldedPersonName(values.firstName, values.lastName)) ?? []).filter(
      (candidate) => !candidate.email || !values.email || candidate.email === values.email,
    );
    if (sameName.length === 1) {
      matches.push({ rowIndex: row.rowIndex, candidateId: sameName[0]!.id, score: CONTACT_NAME_SCORE, status: "proposed", manual: false, reason: "name" });
    }
  }
  return { matches, duplicates };
}

// Une ligne de contact telle que l'écran la montre : « Mathieu HENRY — adresse — ville ».
export function contactRowTitle(values: Record<string, ImportValue>): string | null {
  const row = importedContactValues(values);
  if (!row) return null;
  return [[row.firstName, row.lastName].filter(Boolean).join(" "), row.email, row.city].filter(Boolean).join(" — ");
}

const CONTACT_OPTIONS = 10;

function closestContacts(values: Record<string, ImportValue>, candidates: ContactImportCandidate[]): MatchesRowView["options"] {
  const row = importedContactValues(values);
  if (!row) return [];
  const reference = [row.firstName, row.lastName].filter(Boolean).join(" ");
  return candidates
    .map((candidate) => ({ candidate, score: labelSimilarity(reference, [candidate.firstName, candidate.lastName].filter(Boolean).join(" ")) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CONTACT_OPTIONS)
    .map(({ candidate }) => ({ id: candidate.id, label: contactCandidateLabel(candidate), event: null }));
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
  const [types, families] = await Promise.all([listVendorTypes(organizationId), listVendorFamilies(organizationId)]);
  // Lot 16 (ADR 0045) : tout le catalogue commun, un fichier pouvant citer une robe de mariée.
  const starters = vendorCatalogInput(locale).flatMap((family) =>
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
  } else if (set.entityType === "contacts") {
    return { ...computeContactMatching(rows, await listContactImportCandidates(organizationId)), rowEvents };
  } else if (set.entityType === "vendors") {
    const candidates = (await listVendorCandidates(organizationId)).map((vendor) => ({ id: vendor.id, value: vendor }));
    for (const row of rows) {
      const reference = vendorReference(row.values);
      const best = bestMatch(reference, candidates, vendorSimilarity);
      const candidate = best ? candidates.find((entry) => entry.id === best.id)?.value : undefined;
      // Lot 63b (HUB-14) : seul le prénom en commun, « À vérifier », deux prestataires par défaut.
      if (best && candidate && onlyOneNameInCommon(reference.name, candidate.name)) {
        matches.push({ rowIndex: row.rowIndex, candidateId: best.id, score: best.score, status: "refused", manual: false, toVerify: true, reviewed: false });
      } else proposed(row.rowIndex, best);
    }
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
  // Lot 36b (DAT-12) : ligne de contact ignorée par la planner (doublon de son adresse).
  ignored?: boolean;
  // Lot 63b (HUB-14) : prestataire rapproché, la ligne et la fiche côte à côte.
  compare?: { vendorId: string; lines: VendorCompareLine[]; eventCount: number; toVerify: boolean };
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
  const isContactType = set.entityType === "contacts";
  const contactCandidates = isContactType ? await listContactImportCandidates(organizationId) : [];
  const contactsById = new Map(contactCandidates.map((candidate) => [candidate.id, candidate]));
  const labelCandidates = !isEventType && !hasEventReference && !isVendorType && !isContactType ? await listLabelCandidates(organizationId, set.entityType) : [];
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
  // Lot 36b (DAT-12) : une ligne de contact est ignorée si la planner l'a dit, ou si elle a refusé
  // de compléter le contact qui porte déjà son adresse (jamais deux contacts pour une adresse).
  const ignoredRow = (rowIndex: number, match: ImportMatch | undefined) =>
    statusOverride.get(rowIndex) === "ignore" || (match?.status === "refused" && match.reason === "email");
  const rows: MatchesRowView[] = [];
  for (const row of parsed) {
    if (set.entityType === "event_sheets" && statusOverride.has(row.rowIndex)) row.values = { ...row.values, status: statusOverride.get(row.rowIndex)! };
    const resolution = matching.rowEvents.find((rowEvent) => rowEvent.rowIndex === row.rowIndex);
    let options: MatchesRowView["options"] = [];
    if (row.errors.length === 0) {
      if (isEventType) options = events.map((event) => ({ id: event.id, label: null, event }));
      else if (hasEventReference) options = resolution?.eventId ? (await itemsOf(resolution.eventId)).map((item) => ({ ...item, event: null })) : [];
      else if (isVendorType) options = closestVendors(row.values, vendorCandidates);
      else if (isContactType) options = closestContacts(row.values, contactCandidates);
      else options = labelCandidates.map((item) => ({ ...item, event: null }));
    }
    const match = matching.matches.find((candidate) => candidate.rowIndex === row.rowIndex);
    const matchedContact = isContactType && match ? contactsById.get(match.candidateId) : undefined;
    const option = matchedContact
      ? { id: matchedContact.id, label: contactCandidateLabel(matchedContact), event: null }
      : match
        ? options.find((candidate) => candidate.id === match.candidateId)
        : undefined;
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
      ...(isContactType && ignoredRow(row.rowIndex, match) ? { ignored: true } : {}),
    });
  }
  if (!isVendorType) return { importId: set.importId, entityType: set.entityType, fileName: set.fileName, rows };
  const typeOptions = await listVendorTypeCandidates(organizationId);
  await attachVendorComparisons(organizationId, rows, typeOptions);
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

// Lot 63b (HUB-14) — la fiche existante de chaque rapprochement, lue par la porte d'entrée du module
// Prestataires (métier, ville, e-mail, téléphone) et du module Évènements (nombre d'évènements).
async function attachVendorComparisons(organizationId: string, rows: MatchesRowView[], typeOptions: LabelCandidate[]): Promise<void> {
  const matched = rows.filter((row) => row.match);
  const ids = [...new Set(matched.map((row) => row.match!.candidateId))];
  if (ids.length === 0) return;
  const [summaries, contacts] = await Promise.all([getVendorsByIds(organizationId, ids), getVendorContacts(organizationId, ids)]);
  const typeLabel = new Map(typeOptions.map((type) => [type.id, type.label]));
  const eventCounts = new Map<string, number>();
  for (const id of ids) eventCounts.set(id, new Set((await listVendorConsultations(organizationId, id)).map((entry) => entry.eventId)).size);
  for (const row of matched) {
    const id = row.match!.candidateId;
    const summary = summaries.find((entry) => entry.id === id);
    const contact = contacts.find((entry) => entry.id === id);
    if (!summary) continue;
    const firstPhone = text(row.values.phones)?.split(/[,;\n]/)[0]?.trim() ?? null;
    const lines = compareVendorRecords(
      { name: text(row.values.name), type: text(row.values.type), city: text(row.values.city), email: text(row.values.email), phone: firstPhone },
      { name: summary.name, type: summary.typeId ? (typeLabel.get(summary.typeId) ?? null) : null, city: summary.city, email: contact?.email ?? null, phone: contact?.phone ?? null },
    );
    row.compare = { vendorId: id, lines, eventCount: eventCounts.get(id) ?? 0, toVerify: row.match!.toVerify === true || vendorMatchNeedsCheck(lines) };
  }
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

// —— Lot 36b (D11, SC-10) : lignes à écarter d'un import de contacts ——————————————————————

// Une colonne proposée pour écarter des lignes : pas un champ du contact, et peu de valeurs
// différentes (une catégorie, un type), cellule vide comprise.
const FILTER_MAX_VALUES = 12;

export type RowFilterValue = { value: string; label: string; count: number };
export type RowFilterColumn = { columnIndex: number; header: string; values: RowFilterValue[] };
export type RowFilterView = {
  importId: string;
  fileName: string;
  rowCount: number;
  columns: RowFilterColumn[];
  filter: { columnIndex: number; excluded: string[] } | null;
};

function filterColumns(set: ImportWorkingSet): RowFilterColumn[] {
  const mapped = new Set(set.mapping.filter((choice) => choice.target === "field").map((choice) => choice.columnIndex));
  return set.headers.flatMap((header, columnIndex) => {
    if (mapped.has(columnIndex)) return [];
    const groups = new Map<string, Map<string, number>>();
    for (const row of set.rows) {
      const cell = (row[columnIndex] ?? "").trim();
      const key = foldedCell(cell);
      const variants = groups.get(key) ?? new Map<string, number>();
      variants.set(cell, (variants.get(cell) ?? 0) + 1);
      groups.set(key, variants);
      if (groups.size > FILTER_MAX_VALUES) return [];
    }
    if (groups.size < 2) return [];
    const values = [...groups].map(([value, variants]) => {
      const [label] = [...variants].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
      return { value, label, count: [...variants.values()].reduce((sum, count) => sum + count, 0) };
    });
    values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return [{ columnIndex, header, values }];
  });
}

export async function getImportRowFilterView(organizationId: string, importId: string): Promise<RowFilterView | null> {
  const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
  if (set?.entityType !== "contacts") return null;
  return { importId, fileName: set.fileName, rowCount: set.rows.length, columns: filterColumns(set), filter: set.matching?.rowFilter ?? null };
}

// Nombre de colonnes proposées pour écarter des lignes (l'étape est faite d'office sans elles).
export async function countImportRowFilterColumns(organizationId: string, importId: string): Promise<number> {
  return (await getImportRowFilterView(organizationId, importId))?.columns.length ?? 0;
}

// Écarte les lignes dont la colonne vaut une des valeurs choisies (ou n'en écarte aucune), puis
// recalcule les rapprochements des lignes gardées. Colonne et valeurs vérifiées contre le fichier.
export async function setContactRowFilter(organizationId: string, importId: string, filter: { columnIndex: number; excluded: string[] } | null): Promise<boolean> {
  const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
  if (set?.entityType !== "contacts") return false;
  let kept: { columnIndex: number; excluded: string[] } | null = null;
  if (filter && filter.excluded.length > 0) {
    const column = filterColumns(set).find((candidate) => candidate.columnIndex === filter.columnIndex);
    if (!column) return false;
    const known = new Set(column.values.map((value) => value.value));
    if (filter.excluded.some((value) => !known.has(value))) return false;
    kept = { columnIndex: filter.columnIndex, excluded: [...new Set(filter.excluded)] };
  }
  const base: ImportMatching = { matches: [], rowEvents: [], ...(kept ? { rowFilter: kept } : {}) };
  const matching = await computeImportMatching(organizationId, { ...set, matching: base });
  // Les doublons sont à revoir : l'étape « Doublons » n'est plus faite.
  return withHubDb((db) => setImportRowFilter(db, { organizationId, importId, matching: { ...matching, reviewed: {} }, filter: kept }));
}

// Lot 36b (DAT-12) — une ligne de contact ignorée (doublon d'une ligne plus haut), ou de nouveau
// gardée : elle complète alors la première.
export async function setContactRowsIgnored(organizationId: string, importId: string, rowIndexes: number[], ignored: boolean): Promise<boolean> {
  const set = await withHubDb((db) => getImportWorkingSet(db, organizationId, importId));
  if (set?.entityType !== "contacts" || rowIndexes.some((index) => !Number.isInteger(index))) return false;
  return withHubDb((db) => setImportRowStatuses(db, { organizationId, importId, statuses: rowIndexes.map((rowIndex) => ({ rowIndex, status: ignored ? "ignore" : "keep" })) }));
}
