// Porte d'entrée publique du module vendors (lot 11, ADR 0031) — seul
// fichier que les autres modules peuvent importer (ADR 0011). Pensé comme
// le futur contrat HTTP /v1/vendors si le carnet devient une app autonome.
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import type {
  BudgetLine,
  FileDownload,
  FindVendorsInput,
  VendorDocumentFilter,
  VendorDocumentStateKind,
  VendorSort,
  SaveVendorResult,
  Vendor,
  VendorContact,
  VendorBookSearchResult,
  VendorFieldFilter,
  VendorFieldKind,
  VendorFile,
  VendorFileKind,
  VendorHistory,
  VendorInput,
  VendorListItem,
  VendorSettings,
  VendorsServiceContract,
  VendorSummary,
  VendorTag,
  VendorTagGroup,
  VendorTagGroupInput,
  VendorTagInput,
  VendorTagTierProposal,
  StarterVendorTagCatalogInput,
  VendorTagSeedResult,
  VendorTagArrangement,
  VendorType,
  VendorTypeField,
  VendorTypeFieldInput,
  VendorFamily,
  VendorFamilyInput,
  StarterVendorCatalogInput,
  VendorBankSummary,
  VendorTypeSplitResult,
  VendorTypeSplitStep,
} from "@symbola/contracts";
import { BUDGET_LINE_ICONS } from "@symbola/starter-templates";
import { VENDOR_DOCUMENT_FILTERS, VENDOR_SOCIAL_NETWORKS, VENDOR_SORTS, type VendorSocialLink } from "@symbola/contracts";
import { searchWords } from "@symbola/db/search";
import { listBudgetLines } from "@/modules/budget/service";
import { countWorkedWithByVendor, listSelectedVendorIds, listUpcomingRetainedEventsByVendor, listVendorConsultations } from "@/modules/events/service";
import { slotActualCents } from "@/modules/budget/service";
import type { ImportUndoItem, ImportUndoOutcome } from "@symbola/contracts";
import { cleanFieldValues, isUsableFilter } from "./fields";
import { getVendorBankSummary, summarizeVendorDocuments } from "./records";
import { compareDocumentStates } from "./documents";
import { undoImportedVendorsElements as undoImportRows } from "./import";
import { configuredGeocoder } from "./geocoder";
import { proposeTierGroups, tierUnitKey } from "./tag-tiers";
import { planStarterTags, planTagArrangement, type PlanCatalogGroup, type PlanVendor, type TagPlan } from "./tag-arrangement";
import {
  countRealVendors,
  archiveVendorRow,
  unarchiveVendorRow,
  archiveVendorRows,
  unarchiveVendorRows,
  setVendorsTagRows,
  restoreVendorsTagRows,
  writeVendorsTypeLinks,
  deleteDemoVendors,
  deleteVendorFileRow,
  deleteVendorTag,
  deleteVendorTagGroup,
  deleteVendorTypeField,
  findVendor,
  findVendorFile,
  findVendorRows,
  findVendorsByIds,
  findVendorSettings,
  findVendorTagGroups,
  findVendorTags,
  findVendorTagCarriers,
  applyVendorTagPlan,
  findVendorTypes,
  insertVendor,
  insertVendorFile,
  insertVendorTag,
  insertVendorTagGroup,
  insertVendorType,
  insertVendorTypeField,
  searchVendorRows,
  setVendorTagsGroup,
  updateVendorLocation,
  updateVendorRow,
  updateVendorTagGroupRow,
  updateVendorTagRow,
  updateVendorTypeFieldFilter,
  updateVendorTypeRow,
  upsertVendorSettings,
  type VendorFileRow,
  type VendorRow,
  type VendorTypeFieldRow,
  type VendorTypeRow,
  type VendorWrite,
} from "./repository";
import { DEFAULT_VENDOR_SETTINGS, estimateTravel, validateVendorSettings } from "./travel";
import {
  applyTypeSplitRows,
  countVendorsByFamilyRows,
  countVendorsByTypeRows,
  deleteVendorFamilyRow,
  findTypesWithVendorCounts,
  deleteVendorTypeMovingRows,
  findVendorFamilies,
  insertVendorFamily,
  mergeVendorTypeRows,
  moveVendorFamilyRow,
  seedStarterCatalogRows,
  updateVendorFamilyRow,
  updateVendorTypeFamilyRow,
  type VendorFamilyRow,
} from "./families";

export { InvalidVendorFieldValueError, parseFieldInput } from "./fields";
// Lot 63e (PRE-01, PRE-11 ; ADR 0105) : valeurs combinées (« Photographe et vidéaste »), pour l'import.
export { combinedTypeParts, vendorTypeLabels } from "./type-split";
import { planTypeSplit } from "./type-split";

// Lot 20 (décision 5, ADR 0049).
export class VendorTagNotFoundError extends Error {
  constructor() {
    super("étiquette introuvable");
  }
}
export class VendorTagGroupNotFoundError extends Error {
  constructor() {
    super("groupe d'étiquettes introuvable");
  }
}
// Deux paliers du même groupe sur une fiche (« 100 à 150 » et « 150 à 200 personnes »).
export class VendorTagTierConflictError extends Error {
  constructor() {
    super("un seul palier par groupe");
  }
}
export { findModifiedImportedVendorsElements, importedVendorsToPlace, importVendorRows, listVendorImportCandidates, type VendorTypeChoiceInput, type VendorTypeTarget } from "./import";
export { placeVendors, type PlacementResult } from "./placement";
// Lot 37b (DOC-12, ADR 0071) : la part du module au relevé de stockage.
export { measureVendorsStorage } from "./storage-usage";
export { estimateTravel, haversineKm } from "./travel";
export { vendorsPrivacy } from "./privacy";
export type {
  FindVendorsInput,
  VendorTypeSplitResult,
  VendorTypeSplitStep,
  SaveVendorResult,
  TravelEstimate,
  Vendor,
  VendorContact,
  VendorFieldFilter,
  VendorFieldKind,
  VendorFieldValue,
  VendorFile,
  VendorFileKind,
  VendorHistory,
  VendorHistoryEntry,
  VendorInput,
  VendorListItem,
  VendorSettings,
  VendorSocialLink,
  VendorSocialNetwork,
  VendorSummary,
  VendorTag,
  VendorTagGroup,
  VendorTagGroupInput,
  VendorTagInput,
  VendorTagTierProposal,
  VendorType,
  VendorTypeField,
  VendorFamily,
  VendorFamilyInput,
  StarterVendorCatalogInput,
} from "@symbola/contracts";
export type { VendorTypeMergedPayload } from "@symbola/contracts";

// Mêmes règles que les devis joints au budget (ADR 0031 § 8).
export const VENDOR_FILE_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class VendorNotFoundError extends Error {
  constructor() {
    super("prestataire introuvable");
    this.name = "VendorNotFoundError";
  }
}
export class VendorTypeNotFoundError extends Error {
  constructor() {
    super("type de prestataire introuvable");
    this.name = "VendorTypeNotFoundError";
  }
}
// Lot 16 (L16-PRE-15) : type qui a encore des fiches, supprimé sans dire où elles vont.
export class VendorTypeInUseError extends Error {
  constructor() {
    super("type de prestataire encore utilisé");
    this.name = "VendorTypeInUseError";
  }
}
export class VendorFamilyNotFoundError extends Error {
  constructor() {
    super("famille de types introuvable");
    this.name = "VendorFamilyNotFoundError";
  }
}
export class VendorFamilyNotEmptyError extends Error {
  constructor() {
    super("famille de types non vide");
    this.name = "VendorFamilyNotEmptyError";
  }
}
export class VendorFileNotFoundError extends Error {
  constructor() {
    super("fichier introuvable");
    this.name = "VendorFileNotFoundError";
  }
}
export class VendorFileRejectedError extends Error {
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected" | "storage_full") {
    super(`fichier refusé : ${reason}`);
    this.name = "VendorFileRejectedError";
  }
}

function toField(row: VendorTypeFieldRow): VendorTypeField {
  return { id: row.id, typeId: row.typeId, label: row.label, kind: row.kind, choices: row.choices, isFilter: row.isFilter, position: row.position, ruleKey: row.ruleKey };
}

function toType({ type, fields }: { type: VendorTypeRow; fields: VendorTypeFieldRow[] }): VendorType {
  return { id: type.id, label: type.label, color: type.color, position: type.position, familyId: type.familyId, starterKey: type.starterKey, fields: fields.map(toField) };
}

function toFamily(row: VendorFamilyRow): VendorFamily {
  return { id: row.id, label: row.label, color: row.color, icon: row.icon, position: row.position, starterKey: row.starterKey };
}

function toSummary(row: VendorRow): VendorSummary {
  return {
    id: row.id,
    name: row.name,
    typeIds: row.typeIds,
    primaryTypeId: row.primaryTypeId,
    typeId: row.primaryTypeId,
    postalCode: row.postalCode,
    city: row.city,
    location:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude, source: row.locationSource ?? "geocoded" }
        : null,
    tagIds: row.tagIds,
    archived: row.archivedAt !== null,
    isDemo: row.isDemo,
    rating: row.rating,
  };
}

function toFile(row: VendorFileRow): VendorFile {
  return { id: row.id, kind: row.kind, fileName: row.fileName, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
}

function toVendor(row: VendorRow, files: VendorFileRow[], pendingCheck: VendorBankSummary["pendingCheck"] = null): Vendor {
  return {
    ...toSummary(row),
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    country: row.country,
    internalNote: row.internalNoteSealed ? null : row.internalNote,
    // Lot 48a (DAT-08) : le texte d'une note confidentielle ne quitte jamais ce module chiffré ;
    // il se lit par readVendorConfidentialNote.
    internalNoteConfidential: row.internalNoteSealed ? { authorUserId: row.internalNoteConfidentialBy } : null,
    bank: { ibanMasked: row.ibanMasked, hasBic: row.bicSealed !== null, pendingCheck },
    indicativePrices: row.indicativePrices,
    website: row.website,
    socialLinks: cleanSocialLinks(row.socialLinks),
    siret: row.siret,
    importedFields: row.importedFields,
    fieldValues: row.fieldValues,
    files: files.map(toFile),
  };
}

const blankToNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

// Lot 28c (PRE-01, D8) — évaluation entière de 1 à 5, ou aucune.
export class InvalidVendorRatingError extends Error {
  constructor() {
    super("évaluation hors de 1 à 5");
    this.name = "InvalidVendorRatingError";
  }
}

export const VENDOR_RATING_MAX = 5;

function cleanRating(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > VENDOR_RATING_MAX) throw new InvalidVendorRatingError();
  return value;
}

// Lot 14 (décision M) — site web, réseaux sociaux, SIRET.
export class InvalidVendorLinkError extends Error {
  constructor(readonly field: "website" | "siret" | "socialLinks") {
    super(`valeur invalide : ${field}`);
    this.name = "InvalidVendorLinkError";
  }
}

const WEB_ADDRESS = /^(https?:\/\/)?[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+([/?#][^\s]*)?$/iu;

// Adresse web : « www.exemple.fr » devient « https://www.exemple.fr ».
export function normalizeWebAddress(value: string | null | undefined): string | null {
  const clean = blankToNull(value);
  if (!clean) return null;
  if (!WEB_ADDRESS.test(clean) || clean.length > 500) return null;
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function cleanWebsite(value: string | null | undefined): string | null {
  if (!blankToNull(value)) return null;
  const url = normalizeWebAddress(value);
  if (!url) throw new InvalidVendorLinkError("website");
  return url;
}

// Un lien par réseau, dans l'ordre d'affichage ; un lien illisible est ignoré.
function cleanSocialLinks(links: { network: string; url: string }[]): VendorSocialLink[] {
  const byNetwork = new Map<string, string>();
  for (const link of links) {
    const url = normalizeWebAddress(link.url);
    if (url && (VENDOR_SOCIAL_NETWORKS as readonly string[]).includes(link.network) && !byNetwork.has(link.network)) byNetwork.set(link.network, url);
  }
  return VENDOR_SOCIAL_NETWORKS.filter((network) => byNetwork.has(network)).map((network) => ({ network, url: byNetwork.get(network)! }));
}

// SIRET : 14 chiffres, espaces tolérés à la saisie.
function cleanSiret(value: string | null | undefined): string | null {
  const clean = blankToNull(value)?.replace(/[\s.]/g, "") ?? null;
  if (!clean) return null;
  if (!/^\d{14}$/.test(clean)) throw new InvalidVendorLinkError("siret");
  return clean;
}

// L11-PRE-02 — types et champs.

export async function listVendorTypes(organizationId: string): Promise<VendorType[]> {
  return (await findVendorTypes(organizationId)).map(toType);
}

export async function createVendorType(organizationId: string, label: string, color: string, options: { familyId?: string | null } = {}): Promise<VendorType> {
  if (!label.trim()) throw new RangeError("le nom du type est obligatoire");
  if (!COLOR.test(color)) throw new RangeError("couleur invalide");
  const familyId = options.familyId ?? null;
  if (familyId && !(await findVendorFamilies(organizationId)).some((family) => family.id === familyId)) throw new VendorFamilyNotFoundError();
  return toType({ type: await insertVendorType(organizationId, label.trim(), color.toLowerCase(), familyId), fields: [] });
}

export async function renameVendorType(organizationId: string, typeId: string, label: string, color: string): Promise<void> {
  if (!label.trim() || !COLOR.test(color)) throw new RangeError("nom ou couleur invalide");
  if (!(await updateVendorTypeRow(organizationId, typeId, label.trim(), color.toLowerCase()))) throw new VendorTypeNotFoundError();
}

// Lot 16 (L16-PRE-15) : un type qui a des fiches n'est supprimé qu'en disant où
// elles vont — un autre type, ou null pour « à classer ». Jamais en silence.
export async function removeVendorType(organizationId: string, typeId: string, options: { moveVendorsTo?: string | null } = {}): Promise<void> {
  if (!UUID.test(typeId) || (options.moveVendorsTo && !UUID.test(options.moveVendorsTo))) throw new VendorTypeNotFoundError();
  const outcome = await deleteVendorTypeMovingRows(organizationId, typeId, options.moveVendorsTo);
  if (outcome === "in_use") throw new VendorTypeInUseError();
  if (outcome !== "deleted") throw new VendorTypeNotFoundError();
}

export async function setVendorTypeFamily(organizationId: string, typeId: string, familyId: string | null): Promise<void> {
  if (!UUID.test(typeId)) throw new VendorTypeNotFoundError();
  if (familyId !== null && !UUID.test(familyId)) throw new VendorFamilyNotFoundError();
  const outcome = await updateVendorTypeFamilyRow(organizationId, typeId, familyId);
  if (outcome === "type_not_found") throw new VendorTypeNotFoundError();
  if (outcome === "family_not_found") throw new VendorFamilyNotFoundError();
}

// L16-PRE-15 — fusion d'un type dans un autre (fiches et champs propres repris,
// opération journalisée).
export async function mergeVendorTypes(organizationId: string, input: { sourceTypeId: string; targetTypeId: string }): Promise<{ movedVendors: number; movedFields: number }> {
  if (!UUID.test(input.sourceTypeId) || !UUID.test(input.targetTypeId)) throw new VendorTypeNotFoundError();
  if (input.sourceTypeId === input.targetTypeId) throw new RangeError("un type ne se fusionne pas avec lui-même");
  const result = await mergeVendorTypeRows(organizationId, input.sourceTypeId, input.targetTypeId);
  if (!result) throw new VendorTypeNotFoundError();
  return result;
}

export function countVendorsByType(organizationId: string): Promise<{ typeId: string | null; count: number }[]> {
  return countVendorsByTypeRows(organizationId);
}

// Lot 63e (PRE-01) : nombre de fiches par famille, chacune une fois ; familyId nul : « à classer ».
export function countVendorsByFamily(organizationId: string): Promise<{ total: number; families: { familyId: string | null; count: number }[] }> {
  return countVendorsByFamilyRows(organizationId);
}

// Lot 63e (PRE-01, HUB-20 ; ADR 0105) — reprise des types combinés : ce qui changerait, sans rien
// écrire (rapport montré avant la production), puis l'application. Le catalogue (types de départ du
// métier, dans la langue de l'organisation) sert à créer un métier absent.
export async function previewVendorTypeSplit(organizationId: string, _catalog: StarterVendorCatalogInput, locale: "fr" | "en"): Promise<VendorTypeSplitStep[]> {
  return planTypeSplit(await findTypesWithVendorCounts(organizationId), locale);
}

export async function splitCombinedVendorTypes(organizationId: string, catalog: StarterVendorCatalogInput, locale: "fr" | "en"): Promise<VendorTypeSplitResult[]> {
  // Lot 65e : une étape où deux métiers aboutiraient au même type n'est jamais appliquée.
  const steps = (await previewVendorTypeSplit(organizationId, catalog, locale)).filter((step) => !step.conflict);
  if (steps.length === 0) return [];
  const outcomes = await applyTypeSplitRows(
    organizationId,
    steps.map((step) => ({
      typeId: step.typeId,
      first: step.first.action === "merge" ? { action: "merge", intoTypeId: step.first.into.id } : { action: "rename", key: step.first.key, label: step.first.to },
      others: step.others.map((part) => ({ key: part.key, existingTypeId: part.existing?.id ?? null })),
    })),
    catalog,
  );
  return outcomes.map((outcome) => ({ ...outcome, label: steps.find((step) => step.typeId === outcome.typeId)?.label ?? "" }));
}

// L16-PRE-14 / L16-PRE-15 — familles, propres à l'organisation.

const ICONS: readonly string[] = BUDGET_LINE_ICONS;

function cleanFamily(input: VendorFamilyInput): VendorFamilyInput {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom de la famille est obligatoire");
  if (!COLOR.test(input.color)) throw new RangeError("couleur invalide");
  if (!ICONS.includes(input.icon)) throw new RangeError("icône inconnue");
  return { label, color: input.color.toLowerCase(), icon: input.icon };
}

export async function listVendorFamilies(organizationId: string): Promise<VendorFamily[]> {
  return (await findVendorFamilies(organizationId)).map(toFamily);
}

export async function createVendorFamily(organizationId: string, input: VendorFamilyInput): Promise<VendorFamily> {
  return toFamily(await insertVendorFamily(organizationId, cleanFamily(input)));
}

export async function updateVendorFamily(organizationId: string, familyId: string, input: VendorFamilyInput): Promise<void> {
  const clean = cleanFamily(input);
  if (!UUID.test(familyId) || !(await updateVendorFamilyRow(organizationId, familyId, clean))) throw new VendorFamilyNotFoundError();
}

export async function moveVendorFamily(organizationId: string, familyId: string, direction: "up" | "down"): Promise<void> {
  if (!UUID.test(familyId) || !(await moveVendorFamilyRow(organizationId, familyId, direction))) throw new VendorFamilyNotFoundError();
}

// Seule une famille vide se supprime : ses types sont d'abord rangés ailleurs.
export async function removeVendorFamily(organizationId: string, familyId: string): Promise<void> {
  const outcome = UUID.test(familyId) ? await deleteVendorFamilyRow(organizationId, familyId) : "not_found";
  if (outcome === "not_found") throw new VendorFamilyNotFoundError();
  if (outcome === "not_empty") throw new VendorFamilyNotEmptyError();
}

// Modèles de départ (ONB, packages/starter-templates) : familles du métier,
// types et champs si l'organisation n'a encore aucun type, rangement des
// types existants par les synonymes. Une seule fois par organisation.
export async function seedStarterVendorCatalog(
  organizationId: string,
  catalog: StarterVendorCatalogInput,
  options: { withTypes: boolean; explicit?: boolean },
): Promise<{ families: number; types: number; classified: number }> {
  const clean = catalog.map((family) => ({ ...family, ...cleanFamily(family) }));
  return seedStarterCatalogRows(organizationId, clean, options);
}

export async function addVendorTypeField(organizationId: string, typeId: string, input: VendorTypeFieldInput): Promise<VendorTypeField> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom du champ est obligatoire");
  const choices = (input.choices ?? []).map((choice) => choice.trim()).filter(Boolean);
  if (input.kind === "choice" && choices.length === 0) throw new RangeError("une liste de choix demande au moins un choix");
  const row = await insertVendorTypeField(organizationId, {
    typeId,
    label,
    kind: input.kind,
    choices: input.kind === "choice" ? [...new Set(choices)] : [],
    isFilter: input.isFilter ?? false,
  });
  if (!row) throw new VendorTypeNotFoundError();
  return toField(row);
}

export async function setVendorTypeFieldFilter(organizationId: string, fieldId: string, isFilter: boolean): Promise<void> {
  await updateVendorTypeFieldFilter(organizationId, fieldId, isFilter);
}

export async function removeVendorTypeField(organizationId: string, fieldId: string): Promise<void> {
  await deleteVendorTypeField(organizationId, fieldId);
}

// Étiquettes.

function toTag(row: { id: string; label: string; groupId: string | null; familyIds: string[]; position: number }): VendorTag {
  return { id: row.id, label: row.label, groupId: row.groupId, familyIds: row.familyIds, position: row.position };
}

export async function listVendorTags(organizationId: string): Promise<VendorTag[]> {
  return (await findVendorTags(organizationId)).map(toTag);
}

// Lot 20 (décision 5, ADR 0049) : groupe et familles vérifiés ; une
// étiquette d'un groupe « palier » prend la place suivante du groupe.
async function cleanTagPlacement(organizationId: string, options: Omit<VendorTagInput, "label">): Promise<{ groupId: string | null; familyIds: string[] }> {
  const groupId = options.groupId ?? null;
  if (groupId && !(await findVendorTagGroups(organizationId)).some((group) => group.id === groupId)) throw new VendorTagGroupNotFoundError();
  const families = new Set((await listVendorFamilies(organizationId)).map((family) => family.id));
  return { groupId, familyIds: [...new Set((options.familyIds ?? []).filter((id) => families.has(id)))] };
}

export async function createVendorTag(organizationId: string, label: string, options: Omit<VendorTagInput, "label"> = {}): Promise<VendorTag> {
  const clean = label.trim();
  if (!clean) throw new RangeError("le nom de l'étiquette est obligatoire");
  const tags = await findVendorTags(organizationId);
  const existing = tags.find((tag) => tag.label.toLocaleLowerCase("fr") === clean.toLocaleLowerCase("fr"));
  if (existing) return toTag(existing);
  const placement = await cleanTagPlacement(organizationId, options);
  const position = placement.groupId ? Math.max(-1, ...tags.filter((tag) => tag.groupId === placement.groupId).map((tag) => tag.position)) + 1 : 0;
  return toTag(await insertVendorTag(organizationId, clean, { ...placement, position }));
}

export async function updateVendorTag(organizationId: string, tagId: string, input: VendorTagInput): Promise<void> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom de l'étiquette est obligatoire");
  const placement = await cleanTagPlacement(organizationId, input);
  if ((await updateVendorTagRow(organizationId, tagId, { label, ...placement })) === 0) throw new VendorTagNotFoundError();
}

export async function removeVendorTag(organizationId: string, tagId: string): Promise<void> {
  await deleteVendorTag(organizationId, tagId);
}

function toTagGroup(row: { id: string; label: string; exclusive: boolean; position: number }): VendorTagGroup {
  return { id: row.id, label: row.label, exclusive: row.exclusive, position: row.position };
}

export async function listVendorTagGroups(organizationId: string): Promise<VendorTagGroup[]> {
  return (await findVendorTagGroups(organizationId)).map(toTagGroup);
}

export async function createVendorTagGroup(organizationId: string, input: VendorTagGroupInput): Promise<VendorTagGroup> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom du groupe est obligatoire");
  const groups = await findVendorTagGroups(organizationId);
  const existing = groups.find((group) => group.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr"));
  if (existing) return toTagGroup(existing);
  const position = Math.max(-1, ...groups.map((group) => group.position)) + 1;
  return toTagGroup(await insertVendorTagGroup(organizationId, { label, exclusive: input.exclusive, position }));
}

export async function updateVendorTagGroup(organizationId: string, groupId: string, input: VendorTagGroupInput): Promise<void> {
  const label = input.label.trim();
  if (!label) throw new RangeError("le nom du groupe est obligatoire");
  if ((await updateVendorTagGroupRow(organizationId, groupId, { label, exclusive: input.exclusive })) === 0) throw new VendorTagGroupNotFoundError();
}

export async function removeVendorTagGroup(organizationId: string, groupId: string): Promise<void> {
  await deleteVendorTagGroup(organizationId, groupId);
}

// Paliers repérés parmi les étiquettes sans groupe.
export async function listVendorTagTierProposals(organizationId: string): Promise<VendorTagTierProposal[]> {
  const loose = (await findVendorTags(organizationId)).filter((tag) => tag.groupId === null);
  return proposeTierGroups(loose).map((proposal) => ({ unit: proposal.unit, tags: proposal.tags.map((tag) => ({ id: tag.id, label: tag.label })) }));
}

export async function applyVendorTagTierProposal(organizationId: string, unit: string, groupLabel: string): Promise<VendorTagGroup | null> {
  const proposal = (await listVendorTagTierProposals(organizationId)).find((candidate) => tierUnitKey(candidate.unit) === tierUnitKey(unit));
  if (!proposal) return null;
  const group = await createVendorTagGroup(organizationId, { label: groupLabel, exclusive: true });
  if (!group.exclusive) await updateVendorTagGroup(organizationId, group.id, { label: group.label, exclusive: true });
  await setVendorTagsGroup(organizationId, group.id, proposal.tags.map((tag, position) => ({ id: tag.id, position })));
  return { ...group, exclusive: true };
}

// Lot 21 (L21-PRE-18, L21-PRE-19, ADR 0050) — étiquettes de départ et rangement des
// étiquettes importées. Le catalogue vient de packages/starter-templates (par
// l'app) ; ses familles sont désignées par leur clé de départ.

function planCatalog(families: VendorFamily[], catalog: StarterVendorTagCatalogInput): PlanCatalogGroup[] {
  const byKey = new Map(families.filter((family) => family.starterKey).map((family) => [family.starterKey!, family.id]));
  return catalog.map((group) => ({
    label: group.label.trim(),
    exclusive: group.exclusive,
    tags: group.tags.map((tag) => {
      const familyIds = tag.familyKeys.map((key) => byKey.get(key)).filter((id): id is string => Boolean(id));
      return { label: tag.label.trim(), aliases: [tag.label, ...tag.aliases], familyIds: tag.familyKeys.length > 0 && familyIds.length === 0 ? null : familyIds };
    }),
  }));
}

async function tagPlanContext(organizationId: string) {
  const [tags, groups, families, types, carriers] = await Promise.all([
    findVendorTags(organizationId),
    findVendorTagGroups(organizationId),
    listVendorFamilies(organizationId),
    listVendorTypes(organizationId),
    findVendorTagCarriers(organizationId),
  ]);
  const familyOfType = new Map(types.map((type) => [type.id, type.familyId]));
  // Lot 63e : la famille d'une fiche, pour ranger ses étiquettes, est celle de son métier principal.
  const vendors: PlanVendor[] = carriers.map((vendor) => ({ id: vendor.id, name: vendor.name, familyId: vendor.typeIds[0] ? (familyOfType.get(vendor.typeIds[0]) ?? null) : null, tagIds: vendor.tagIds }));
  return { tags, groups, families, vendors };
}

function hasChanges(plan: TagPlan): boolean {
  return plan.newGroups.length + plan.tagUpdates.length + plan.newTags.length + plan.vendorUpdates.length > 0;
}

export async function seedStarterVendorTags(organizationId: string, catalog: StarterVendorTagCatalogInput): Promise<VendorTagSeedResult> {
  const context = await tagPlanContext(organizationId);
  const { plan, created, placed } = planStarterTags({ ...context, catalog: planCatalog(context.families, catalog) });
  if (hasChanges(plan)) await applyVendorTagPlan(organizationId, plan);
  return { created, placed };
}

export async function countMissingStarterVendorTags(organizationId: string, catalog: StarterVendorTagCatalogInput): Promise<number> {
  const context = await tagPlanContext(organizationId);
  return planStarterTags({ ...context, catalog: planCatalog(context.families, catalog) }).created;
}

async function vendorTagArrangement(organizationId: string, catalog: StarterVendorTagCatalogInput, options: { tagIds?: string[]; apply: boolean }): Promise<VendorTagArrangement> {
  const context = await tagPlanContext(organizationId);
  const { plan, recap } = planTagArrangement({
    ...context,
    catalog: planCatalog(context.families, catalog),
    ...(options.tagIds ? { scope: new Set(options.tagIds) } : {}),
  });
  const changed = hasChanges(plan);
  if (changed && options.apply) await applyVendorTagPlan(organizationId, plan);
  return { changed, ...recap };
}

export async function previewVendorTagArrangement(organizationId: string, catalog: StarterVendorTagCatalogInput): Promise<VendorTagArrangement> {
  return vendorTagArrangement(organizationId, catalog, { apply: false });
}

export async function arrangeVendorTags(organizationId: string, catalog: StarterVendorTagCatalogInput, options: { tagIds?: string[] } = {}): Promise<VendorTagArrangement> {
  if (options.tagIds && options.tagIds.length === 0) return { changed: false, looseTags: 0, familiesSet: 0, catalogMatched: 0, tiers: [], adjustedVendors: [], remaining: 0 };
  return vendorTagArrangement(organizationId, catalog, { ...options, apply: true });
}

// L11-PRE-01 / L11-PRE-03 — fiches.

function addressOf(input: Pick<VendorWrite, "addressLine" | "postalCode" | "city" | "country">): string | null {
  const parts = [input.addressLine, input.postalCode, input.city].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return input.country && input.country !== "FR" ? [...parts, input.country].join(" ") : parts.join(" ");
}

async function prepareWrite(organizationId: string, input: VendorInput): Promise<VendorWrite> {
  const name = input.name.trim();
  if (!name) throw new RangeError("le nom du prestataire est obligatoire");
  const types = await listVendorTypes(organizationId);
  // Lot 63e (PRE-01 ; ADR 0105) : les métiers cochés (l'ancien typeId seul, si typeIds manque), le
  // principal en premier. Un type d'une autre organisation n'existe pas ici (RLS) : refusé.
  const wantedIds = [...new Set((input.typeIds ?? (input.typeId ? [input.typeId] : [])).filter(Boolean))];
  const chosen = wantedIds.map((id) => types.find((candidate) => candidate.id === id));
  if (chosen.some((type) => !type)) throw new VendorTypeNotFoundError();
  const primaryId = input.primaryTypeId && wantedIds.includes(input.primaryTypeId) ? input.primaryTypeId : wantedIds[0];
  if (input.primaryTypeId && !wantedIds.includes(input.primaryTypeId)) throw new VendorTypeNotFoundError();
  const ordered = (chosen as VendorType[]).sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId));
  const tagRows = await findVendorTags(organizationId);
  const tags = new Set(tagRows.map((tag) => tag.id));
  // Lot 20 (décision 5) : un seul palier par groupe « palier ».
  const exclusiveGroups = new Set((await findVendorTagGroups(organizationId)).filter((group) => group.exclusive).map((group) => group.id));
  const chosenTiers = (input.tagIds ?? []).flatMap((id) => {
    const tag = tagRows.find((candidate) => candidate.id === id);
    return tag?.groupId && exclusiveGroups.has(tag.groupId) ? [tag.groupId] : [];
  });
  if (new Set(chosenTiers).size !== chosenTiers.length) throw new VendorTagTierConflictError();
  return {
    typeIds: ordered.map((type) => type.id),
    name,
    contactName: blankToNull(input.contactName),
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    addressLine: blankToNull(input.addressLine),
    postalCode: blankToNull(input.postalCode),
    city: blankToNull(input.city),
    country: (input.country ?? "FR").trim().toUpperCase() || "FR",
    internalNote: blankToNull(input.internalNote),
    rating: cleanRating(input.rating),
    indicativePrices: blankToNull(input.indicativePrices),
    website: cleanWebsite(input.website),
    socialLinks: cleanSocialLinks(input.socialLinks ?? []),
    siret: cleanSiret(input.siret),
    // Les champs de chaque métier s'ajoutent.
    fieldValues: ordered.length > 0 ? cleanFieldValues(ordered.flatMap((type) => type.fields), input.fieldValues ?? {}) : {},
    tagIds: [...new Set((input.tagIds ?? []).filter((id) => tags.has(id)))],
  };
}

// Place l'adresse sur la carte quand elle est nouvelle ou a changé ; un
// point corrigé à la main n'est jamais écrasé si l'adresse ne change pas.
async function locate(write: VendorWrite, previous: VendorRow | null): Promise<{ location: VendorWrite["location"]; geocoding: SaveVendorResult["geocoding"] }> {
  const address = addressOf(write);
  const previousAddress = previous ? addressOf({ ...previous, country: previous.country }) : null;
  if (!address) return { location: null, geocoding: "no_address" };
  if (previous && address === previousAddress && previous.latitude !== null) return { location: undefined, geocoding: "unchanged" };
  const point = await configuredGeocoder()?.geocode(address);
  if (!point) return { location: null, geocoding: "not_found" };
  return { location: { ...point, source: "geocoded" }, geocoding: "placed" };
}

export async function createVendor(organizationId: string, input: VendorInput, options: { isDemo?: boolean } = {}): Promise<SaveVendorResult> {
  const write = await prepareWrite(organizationId, input);
  const { location, geocoding } = await locate(write, null);
  const row = await insertVendor(organizationId, { ...write, location, isDemo: options.isDemo ?? false });
  return { vendor: toVendor(row, []), geocoding };
}

export async function updateVendor(organizationId: string, vendorId: string, input: VendorInput): Promise<SaveVendorResult> {
  const current = await findVendor(organizationId, vendorId);
  if (!current) throw new VendorNotFoundError();
  const write = await prepareWrite(organizationId, input);
  // Lot 48a (DAT-08) : une note confidentielle ne se change que par saveVendorNote.
  if (current.vendor.internalNoteSealed) write.internalNote = null;
  const { location, geocoding } = await locate(write, current.vendor);
  const row = await updateVendorRow(organizationId, vendorId, { ...write, location });
  if (!row) throw new VendorNotFoundError();
  return { vendor: toVendor(row, current.files, (await getVendorBankSummary(organizationId, vendorId)).pendingCheck), geocoding };
}

export async function setVendorLocation(organizationId: string, vendorId: string, latitude: number, longitude: number): Promise<void> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError("point invalide");
  }
  if (!(await updateVendorLocation(organizationId, vendorId, latitude, longitude))) throw new VendorNotFoundError();
}

// Archivé plutôt que supprimé : l'historique des événements garde le nom.
export async function archiveVendor(organizationId: string, vendorId: string): Promise<void> {
  await archiveVendorRow(organizationId, vendorId);
}

// Lot 39a (UX-07 ; D6 ; ADR 0073) : « Annuler » après l'archivage.
export async function unarchiveVendor(organizationId: string, vendorId: string): Promise<boolean> {
  if (!UUID.test(vendorId)) return false;
  return unarchiveVendorRow(organizationId, vendorId);
}

// Lot 73b (PRE-01, UX-07, UX-15 ; spécification du lot 73, § 4.2, § 4.5 et § 5.2, critères 7 et 9) — les
// actions en lot du carnet. Une seule fiche (ou un seul métier) hors de l'organisation fait refuser tout le
// lot par le même message qu'une fiche inexistante (SEC-13) ; rien n'est alors écrit. Au plus 500 fiches.
export const VENDOR_BULK_MAX = 500;

function bulkIds(vendorIds: string[]): string[] {
  const ids = [...new Set(vendorIds)];
  if (ids.length === 0 || ids.length > VENDOR_BULK_MAX || ids.some((id) => !UUID.test(id))) throw new VendorNotFoundError();
  return ids;
}

export type VendorTagsSnapshot = { id: string; tagIds: string[] }[];

// « Ajouter une étiquette… » : l'étiquette s'ajoute aux fiches qui ne l'ont pas ; dans un groupe « palier »
// (un seul choix), elle remplace l'autre palier du groupe. Rend les étiquettes d'avant des fiches changées.
export async function tagVendors(organizationId: string, vendorIds: string[], tagId: string): Promise<{ changed: number; previous: VendorTagsSnapshot }> {
  const ids = bulkIds(vendorIds);
  if (!UUID.test(tagId)) throw new VendorTagNotFoundError();
  const [tags, groups] = await Promise.all([findVendorTags(organizationId), findVendorTagGroups(organizationId)]);
  const tag = tags.find((candidate) => candidate.id === tagId);
  if (!tag) throw new VendorTagNotFoundError();
  const exclusive = tag.groupId !== null && groups.some((group) => group.id === tag.groupId && group.exclusive);
  const siblings = new Set(exclusive ? tags.filter((candidate) => candidate.groupId === tag.groupId && candidate.id !== tagId).map((candidate) => candidate.id) : []);
  const previous = await setVendorsTagRows(organizationId, ids, (current) => (current.includes(tagId) ? current : [...current.filter((id) => !siblings.has(id)), tagId]));
  if (!previous) throw new VendorNotFoundError();
  return { changed: previous.length, previous };
}

// Son « Annuler » : chaque fiche retrouve ses étiquettes d'avant (étiquettes encore de l'organisation).
export async function restoreVendorsTags(organizationId: string, previous: VendorTagsSnapshot): Promise<number> {
  const ids = bulkIds(previous.map((entry) => entry.id));
  const known = new Set((await findVendorTags(organizationId)).map((tag) => tag.id));
  const cleaned = previous.filter((entry) => ids.includes(entry.id)).map((entry) => ({ id: entry.id, tagIds: [...new Set(entry.tagIds)].filter((id) => known.has(id)) }));
  const restored = await restoreVendorsTagRows(organizationId, cleaned);
  if (restored === null) throw new VendorNotFoundError();
  return restored;
}

// « Archiver… » en lot : elles quittent le carnet, pas les mariages où elles sont. Rend celles qui ont été
// archivées par ce geste (« Annuler » ne rend qu'elles).
export async function archiveVendors(organizationId: string, vendorIds: string[]): Promise<string[]> {
  const archived = await archiveVendorRows(organizationId, bulkIds(vendorIds));
  if (!archived) throw new VendorNotFoundError();
  return archived;
}

export async function unarchiveVendors(organizationId: string, vendorIds: string[]): Promise<number> {
  const restored = await unarchiveVendorRows(organizationId, bulkIds(vendorIds));
  if (restored === null) throw new VendorNotFoundError();
  return restored;
}

// « Classer » (spécification, § 4.2) : un métier pour plusieurs fiches. Une fiche « à classer » (sans
// métier, ou dont aucun métier n'a de famille) prend le nouveau comme principal et garde les autres ; une
// fiche déjà classée le garde et prend le nouveau en plus. « replaces » (« Revoir », P13) : le métier que
// la planner change sur l'écran ; il cède sa place au nouveau, qui devient principal.
export type VendorTypeAssignment = { vendorId: string; typeId: string; replaces?: string | null | undefined };

export async function setVendorsPrimaryType(organizationId: string, assignments: VendorTypeAssignment[]): Promise<string[]> {
  const ids = bulkIds(assignments.map((assignment) => assignment.vendorId));
  if (ids.length !== assignments.length || assignments.some((assignment) => !UUID.test(assignment.typeId) || (assignment.replaces != null && !UUID.test(assignment.replaces)))) throw new VendorNotFoundError();
  const types = await listVendorTypes(organizationId);
  const familyOf = new Map(types.map((type) => [type.id, type.familyId]));
  const changed = await writeVendorsTypeLinks(
    organizationId,
    (links) =>
      assignments.flatMap((assignment) => {
        const current = links.get(assignment.vendorId)?.typeIds ?? [];
        const replaced = assignment.replaces && current.includes(assignment.replaces) ? assignment.replaces : null;
        const others = current.filter((id) => id !== assignment.typeId && id !== replaced);
        const unclassified = current.every((id) => !familyOf.get(id));
        const next = replaced || unclassified ? [assignment.typeId, ...others] : [...current.filter((id) => id !== assignment.typeId), assignment.typeId];
        return next.length === current.length && next.every((id, index) => id === current[index]) ? [] : [{ vendorId: assignment.vendorId, typeIds: next }];
      }),
    ids,
    assignments.map((assignment) => assignment.typeId),
  );
  if (!changed) throw new VendorNotFoundError();
  return changed;
}

export async function getVendor(organizationId: string, vendorId: string): Promise<Vendor | null> {
  if (!UUID.test(vendorId)) return null;
  const found = await findVendor(organizationId, vendorId);
  return found ? toVendor(found.vendor, found.files, (await getVendorBankSummary(organizationId, vendorId)).pendingCheck) : null;
}

export async function getVendorsByIds(organizationId: string, vendorIds: string[]): Promise<VendorSummary[]> {
  return (await findVendorsByIds(organizationId, vendorIds.filter((id) => UUID.test(id)))).map(toSummary);
}

// Lot 63b (HUB-14) : les fiches modifiées à la main depuis un import, nommées dans « Annuler cet
// import » (métier, ville, heure de la modification).
export async function describeVendorsForImportUndo(organizationId: string, vendorIds: string[]): Promise<{ id: string; name: string; typeId: string | null; city: string | null; updatedAt: Date }[]> {
  const rows = await findVendorsByIds(organizationId, vendorIds.filter((id) => UUID.test(id)));
  return rows.map((row) => ({ id: row.id, name: row.name, typeId: row.primaryTypeId, city: row.city, updatedAt: row.updatedAt }));
}

// Lot 29a (JRJ-02, décision D5) : coordonnées des prestataires retenus, pour l'écran du
// jour J (rien d'autre de la fiche : ni note interne, ni tarifs).
export async function getVendorContacts(organizationId: string, vendorIds: string[]): Promise<VendorContact[]> {
  const rows = await findVendorsByIds(organizationId, vendorIds.filter((id) => UUID.test(id)));
  return rows.map((row) => ({ id: row.id, name: row.name, contactName: row.contactName, phone: row.phone, email: row.email }));
}

// L11-PRE-04 à L11-PRE-07 — recherche dans le carnet : filtres appliqués par la
// base ; un filtre qui ne convient pas au champ est ignoré, jamais en erreur.
// « Déjà travaillé avec » et (lot 63b) les fiches d'un import : les deux à la fois s'il le faut.
async function onlyVendorIds(input: FindVendorsInput): Promise<string[] | undefined> {
  const ids = input.ids?.filter((id) => UUID.test(id));
  const worked = input.workedWith ? await listSelectedVendorIds(input.organizationId) : undefined;
  if (ids && worked) return ids.filter((id) => worked.includes(id));
  return ids ?? worked;
}

// Lot 73a (PRE-05 ; § 4.2) : « Pièces » — à régler (à renouveler, bientôt, à recevoir, à vérifier), à jour,
// demandées (à recevoir), à vérifier, expirées ou bientôt.
const DOCUMENT_FILTERS: Record<VendorDocumentFilter, (state: VendorDocumentStateKind) => boolean> = {
  to_settle: (state) => state === "expired" || state === "expiring" || state === "requested" || state === "to_verify",
  up_to_date: (state) => state === "up_to_date",
  requested: (state) => state === "requested",
  to_verify: (state) => state === "to_verify",
  expired_or_soon: (state) => state === "expired" || state === "expiring",
};
// Lot 73a : 500 fiches au plus (200 avant) ; au-delà, l'écran le dit.
export const VENDOR_LIST_LIMIT = 500;

function today(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function findVendors(input: FindVendorsInput & { now?: Date }): Promise<VendorListItem[]> {
  const [types, settings] = await Promise.all([listVendorTypes(input.organizationId), getVendorSettings(input.organizationId)]);
  const fieldsById = new Map(types.flatMap((type) => type.fields).map((field) => [field.id, field]));
  const fieldFilters: (VendorFieldFilter & { kind: VendorFieldKind })[] = [];
  for (const filter of input.fieldFilters ?? []) {
    const field = fieldsById.get(filter.fieldId);
    if (field && isUsableFilter(field, filter)) fieldFilters.push({ ...filter, kind: field.kind });
  }
  const around =
    input.around && Number.isFinite(input.around.latitude) && Number.isFinite(input.around.longitude) && input.around.radiusKm > 0
      ? input.around
      : undefined;
  // Lot 16 (L16-PRE-14) : une famille, ou « à classer » (types sans
  // famille et fiches sans type).
  const typeScope = input.unclassified
    ? { typeIds: types.filter((type) => type.familyId === null).map((type) => type.id), includeUntyped: true }
    : input.familyId
      ? { typeIds: types.filter((type) => type.familyId === input.familyId).map((type) => type.id), includeUntyped: false }
      : undefined;
  // Lot 73a : un filtre ou un tri inconnu est ignoré, jamais en erreur. Le tri par nom, métier, évaluation
  // et distance est fait par la base ; « Avec vous » et « Pièces » (un autre module, un calcul de date) ici.
  const documentsFilter = input.documents && (VENDOR_DOCUMENT_FILTERS as readonly string[]).includes(input.documents) ? input.documents : undefined;
  const sort: VendorSort = input.sort && (VENDOR_SORTS as readonly string[]).includes(input.sort) ? input.sort : around ? "distance" : "name";
  const direction = input.direction === "desc" ? "desc" : "asc";
  const limit = Math.min(Math.max(input.limit ?? VENDOR_LIST_LIMIT, 1), VENDOR_LIST_LIMIT);
  const sqlSort = sort === "type" || sort === "rating" || (sort === "distance" && around) ? sort : "name";
  const sortedInMemory = sort === "worked_with" || sort === "documents";
  // NFR-02 (ADR 0115) : le compteur « Avec vous » part avec la recherche ; les pièces et les mariages où
  // chaque fiche est retenue partent ensemble ensuite.
  const workedPromise = countWorkedWithByVendor(input.organizationId);
  const rows = await findVendorRows(input.organizationId, {
    words: searchWords(input.text ?? ""),
    typeIds: input.typeIds?.filter((id) => UUID.test(id)),
    typeScope,
    tagIds: input.tagIds?.filter((id) => UUID.test(id)),
    fieldFilters,
    onlyIds: await onlyVendorIds(input),
    unplacedOnly: input.unplacedOnly ?? false,
    // Un seuil hors de 1 à 5 est ignoré, jamais en erreur.
    minRating: input.minRating !== undefined && Number.isInteger(input.minRating) && input.minRating >= 1 && input.minRating <= VENDOR_RATING_MAX ? input.minRating : undefined,
    around,
    includeArchived: input.includeArchived ?? false,
    sort: sqlSort as "name" | "type" | "rating" | "distance",
    direction: sortedInMemory ? "asc" : direction,
    // Filtrées ou triées ici : toutes les fiches qui répondent, dans la limite.
    limit: documentsFilter || sortedInMemory ? VENDOR_LIST_LIMIT : limit,
  });
  const ids = rows.map((row) => row.vendor.id);
  const now = input.now ?? new Date();
  const [worked, states] = await Promise.all([
    workedPromise,
    summarizeVendorDocuments(input.organizationId, ids, { now, retainedEventsByVendor: ids.length > 0 ? listUpcomingRetainedEventsByVendor(input.organizationId, ids, today(now)) : new Map() }),
  ]);
  let items = rows.map(({ vendor, distanceKm }) => {
    const { sortDate, ...documentState } = states.get(vendor.id)!;
    return {
      item: {
        ...toSummary(vendor),
        travel: distanceKm === null ? null : estimateTravel(distanceKm, settings),
        contactName: vendor.contactName,
        phone: vendor.phone,
        email: vendor.email,
        workedWithCount: worked.get(vendor.id) ?? 0,
        documentState,
      } satisfies VendorListItem,
      sortDate,
    };
  });
  if (documentsFilter) items = items.filter((entry) => DOCUMENT_FILTERS[documentsFilter](entry.item.documentState.state));
  const byName = (a: { item: VendorListItem }, b: { item: VendorListItem }) => a.item.name.localeCompare(b.item.name, "fr");
  const sign = direction === "desc" ? -1 : 1;
  if (sort === "worked_with") items.sort((a, b) => sign * (b.item.workedWithCount - a.item.workedWithCount) || byName(a, b));
  // « Pièces » (et le filtre « À régler ») : ce qui presse d'abord, puis par date.
  if (sort === "documents" || (documentsFilter && !sortedInMemory && input.sort === undefined)) {
    items.sort((a, b) => sign * compareDocumentStates({ ...a.item.documentState, sortDate: a.sortDate }, { ...b.item.documentState, sortDate: b.sortDate }) || byName(a, b));
  }
  return items.slice(0, limit).map((entry) => entry.item);
}

// L11-PRE-09 — historique : consultations (module events) et montant du mariage (module budget) ; prix
// moyen sur les prestations retenues. Lot 73a (P9, C-48) : le montant est le réel du poste — la somme de
// ses lignes de budget (celles du prestataire quand le poste en a d'autres), même calcul que la colonne
// « Réel » du budget —, une fois soldé le total réglé ; à défaut, le devis du prestataire retenu.
export async function getVendorHistory(organizationId: string, vendorId: string, options: { budget?: boolean } = {}): Promise<VendorHistory> {
  const consultations = await listVendorConsultations(organizationId, vendorId);
  const linesBySlot = new Map<string, BudgetLine[]>();
  if (options.budget !== false) {
    const eventIds = [...new Set(consultations.filter((entry) => entry.outcome === "selected").map((entry) => entry.eventId))];
    const views = await Promise.all(eventIds.map((eventId) => listBudgetLines(organizationId, eventId)));
    for (const view of views) {
      for (const line of view.lines) linesBySlot.set(line.eventVendorSlotId, [...(linesBySlot.get(line.eventVendorSlotId) ?? []), line]);
    }
  }
  const entries = consultations.map(({ candidateId, ...entry }) => {
    const { slotId, status } = entry;
    if (entry.outcome !== "selected") return { ...entry, finalCents: null };
    const slotLines = linesBySlot.get(slotId) ?? [];
    const own = slotLines.filter((line) => line.vendorCandidateId === candidateId);
    const lines = own.length > 0 ? own : slotLines.filter((line) => line.vendorCandidateId === null);
    const actual = slotActualCents(lines);
    const paid = lines.reduce((sum, line) => sum + (line.paidAmountCents ?? 0), 0);
    const finalCents = status === "paid_off" && paid > 0 ? paid : (actual ?? entry.quotedCents);
    return { ...entry, finalCents };
  });
  const finals = entries.map((entry) => entry.finalCents).filter((value): value is number => value !== null);
  return { entries, averageFinalCents: finals.length > 0 ? Math.round(finals.reduce((sum, value) => sum + value, 0) / finals.length) : null };
}

// L11-PRE-07 — paramètres du trajet estimé.

export async function getVendorSettings(organizationId: string): Promise<VendorSettings> {
  return (await findVendorSettings(organizationId)) ?? DEFAULT_VENDOR_SETTINGS;
}

export async function saveVendorSettings(organizationId: string, settings: VendorSettings): Promise<void> {
  await upsertVendorSettings(organizationId, validateVendorSettings(settings));
}

// Fichiers (plaquettes, RIB) : type vérifié par le contenu, antivirus,
// stockage privé, servis par l'app (ADR 0027).

export async function attachVendorFile(input: {
  organizationId: string;
  vendorId: string;
  kind: VendorFileKind;
  fileName: string;
  content: Uint8Array;
  uploadedByUserId: string;
}): Promise<VendorFile> {
  if (!(await findVendor(input.organizationId, input.vendorId))) throw new VendorNotFoundError();
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: VENDOR_FILE_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new VendorFileRejectedError(upload.reason);
  const fileName = input.fileName.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 120) || `${input.kind}.${upload.key.split(".").pop() ?? "bin"}`;
  const row = await insertVendorFile(input.organizationId, {
    vendorId: input.vendorId,
    kind: input.kind,
    fileName,
    fileKey: upload.key,
    mime: upload.mime,
    sizeBytes: upload.size,
    uploadedByUserId: input.uploadedByUserId,
  });
  return toFile(row);
}

export async function getVendorFile(organizationId: string, fileId: string): Promise<FileDownload> {
  const file = UUID.test(fileId) ? await findVendorFile(organizationId, fileId) : null;
  if (!file) throw new VendorFileNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), file.fileKey);
    return { data, contentType: file.mime, fileName: file.fileName };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new VendorFileNotFoundError();
    throw error;
  }
}

// Lot 12 (L12-EVT-16) : dernier RIB déposé sur la fiche (pour l'espace clients,
// après vérification de l'accès par l'appelant).
// Lot 48a (PRE-10, SEC-27) : tant qu'un changement d'IBAN attend la vérification de la planner, le
// RIB n'est jamais montré au client (même réponse qu'une fiche sans RIB).
export async function getVendorRibFile(organizationId: string, vendorId: string): Promise<FileDownload> {
  if ((await getVendorBankSummary(organizationId, vendorId)).pendingCheck) throw new VendorFileNotFoundError();
  const vendor = await findVendor(organizationId, vendorId);
  const rib = vendor?.files.filter((file) => file.kind === "rib").at(-1);
  if (!rib) throw new VendorFileNotFoundError();
  return getVendorFile(organizationId, rib.id);
}

export async function removeVendorFile(organizationId: string, fileId: string): Promise<void> {
  const row = UUID.test(fileId) ? await deleteVendorFileRow(organizationId, fileId) : null;
  if (row) await deletePrivateObject(createStorageClient(), row.fileKey).catch(() => undefined);
}

// Lot 14 (IMP-07) — annulation d'un import : une fiche citée depuis dans
// un événement est gardée (kept_in_use).
export async function undoImportedVendorsElements(organizationId: string, items: ImportUndoItem[]): Promise<ImportUndoOutcome[]> {
  const created = items.filter((item) => item.kind === "vendor" && item.action === "created").map((item) => item.elementId);
  const linked = new Set<string>();
  for (const vendorId of created) {
    if ((await listVendorConsultations(organizationId, vendorId)).length > 0) linked.add(vendorId);
  }
  return undoImportRows(organizationId, items, linked);
}

// AIDE-08 — recherche globale.
export async function searchVendorBook(organizationId: string, words: string[], limit: number): Promise<VendorBookSearchResult[]> {
  if (words.length === 0) return [];
  const [rows, types] = await Promise.all([searchVendorRows(organizationId, words, limit), findVendorTypes(organizationId)]);
  const labels = new Map(types.map(({ type }) => [type.id, type.label]));
  return rows.map((row) => {
    const typeLabels = row.typeIds.flatMap((id) => (labels.has(id) ? [labels.get(id)!] : []));
    return { id: row.id, name: row.name, city: row.city, typeLabel: typeLabels[0] ?? null, typeLabels };
  });
}

export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!address.trim()) return null;
  return (await configuredGeocoder()?.geocode(address.trim())) ?? null;
}

// Essais et tutoriels : suppression des fiches d'exemple (et de leurs fichiers).
export async function removeDemoVendors(organizationId: string, vendorIds: string[]): Promise<void> {
  const keys = await deleteDemoVendors(organizationId, vendorIds.filter((id) => UUID.test(id)));
  const storage = createStorageClient();
  for (const key of keys) await deletePrivateObject(storage, key).catch(() => undefined);
}

const _contractCheck: VendorsServiceContract = {
  listVendorTypes,
  createVendorType,
  renameVendorType,
  removeVendorType,
  setVendorTypeFamily,
  mergeVendorTypes,
  countVendorsByType,
  countVendorsByFamily,
  previewVendorTypeSplit,
  splitCombinedVendorTypes,
  listVendorFamilies,
  createVendorFamily,
  updateVendorFamily,
  moveVendorFamily,
  removeVendorFamily,
  seedStarterVendorCatalog,
  addVendorTypeField,
  setVendorTypeFieldFilter,
  removeVendorTypeField,
  listVendorTags,
  createVendorTag,
  updateVendorTag,
  removeVendorTag,
  listVendorTagGroups,
  createVendorTagGroup,
  updateVendorTagGroup,
  removeVendorTagGroup,
  listVendorTagTierProposals,
  applyVendorTagTierProposal,
  seedStarterVendorTags,
  countMissingStarterVendorTags,
  previewVendorTagArrangement,
  arrangeVendorTags,
  createVendor,
  updateVendor,
  setVendorLocation,
  archiveVendor,
  getVendor,
  getVendorsByIds,
  getVendorContacts,
  findVendors,
  getVendorHistory,
  getVendorSettings,
  saveVendorSettings,
  attachVendorFile,
  getVendorFile,
  removeVendorFile,
  searchVendorBook,
  geocodeAddress,
};
void _contractCheck;

// Lot 33b (PAR-01, étape 6) — « Ajouter un premier prestataire » de la liste de prise en main.
export async function countOrganizationRealVendors(organizationId: string): Promise<number> {
  return countRealVendors(organizationId);
}

// Lot 35a (HUB-13, DAT-13, ADR 0068) : entités du module dans l'export complet de l'organisation.
export { describeVendorsExport, exportVendorsData, eraseVendorsData, importVendorsData, registerVendorsImportIds, VENDORS_EXPORT_EXCLUSIONS } from "./export";

// Lot 48a (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; ADR 0093) : pièces, IBAN, note confidentielle,
// contraintes des lieux.
export {
  addVendorDocument,
  addVendorDocumentKind,
  archiveVendorDocumentKind,
  canReadConfidentialNote,
  checkProgramWithVenue,
  checkVenueCapacity,
  ConfidentialNoteForbiddenError,
  ensureVenueRuleFields,
  getVendorBankSummary,
  getVendorDocumentAlertDays,
  getVendorDocumentFile,
  getVendorTypeKeys,
  getVenueConstraints,
  listPendingBankChecks,
  listRequestedVendorDocuments,
  listVendorBankChanges,
  listVendorDocumentKinds,
  listVendorDocumentNotices,
  listVendorDocuments,
  readVendorBankDetails,
  readVendorConfidentialNote,
  receiveVendorDocumentByLink,
  removeVendorDocument,
  requestUsualVendorDocuments,
  requestVendorDocument,
  saveVendorNote,
  setVendorDocumentKindUsage,
  summarizeVendorDocuments,
  setVendorBankDetails,
  setVendorDocumentAlertDays,
  setVendorDocumentValidity,
  verifyVendorBankDetails,
  verifyVendorDocument,
  VendorDocumentNotFoundError,
  VendorDocumentRejectedError,
  VENDOR_DOCUMENT_MAX_SIZE_BYTES,
  type BankActor,
  type NoteViewer,
  type ProgramSequenceInput,
} from "./records";
export { InvalidBankDetailsError, maskIban } from "./bank-details";
// Lot 73a (PRE-05, PRE-01 ; spécification du lot 73, § 4.2) : l'état résumé des pièces (fonction pure) et
// le métier proposé d'après le nom d'une fiche (rien n'est enregistré).
export { compareDocumentStates, documentState, documentStateNeedsAction } from "./documents";
export { proposeVendorTypeFromName, type VendorTypeProposal } from "./type-proposal";

// Lot 58 (PRE-08 ; ADR 0097) : évaluation après l'évènement et historique des collaborations, internes.
export { evaluateVendor, EvaluationVendorNotFoundError, getVendorCollaborationHistory, listEventEvaluations, type CollaborationHistory, type VendorEvaluation } from "./evaluations";
export { EVALUATION_CRITERIA, InvalidEvaluationError, type EvaluationCriterion, type EvaluationInput } from "./evaluation-rules";
