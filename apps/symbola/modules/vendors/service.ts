// Porte d'entrée publique du module vendors (lot 11, ADR 0031) — seul
// fichier que les autres modules peuvent importer (ADR 0011). Pensé comme
// le futur contrat HTTP /v1/vendors si le carnet devient une app autonome.
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import type {
  FileDownload,
  FindVendorsInput,
  SaveVendorResult,
  Vendor,
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
} from "@symbola/contracts";
import { BUDGET_LINE_ICONS } from "@symbola/starter-templates";
import { VENDOR_SOCIAL_NETWORKS, type VendorSocialLink } from "@symbola/contracts";
import { searchWords } from "@symbola/db/search";
import { listBudgetLines } from "@/modules/budget/service";
import { listSelectedVendorIds, listVendorConsultations } from "@/modules/events/service";
import type { ImportUndoItem, ImportUndoOutcome } from "@symbola/contracts";
import { cleanFieldValues, isUsableFilter } from "./fields";
import { undoImportedVendorsElements as undoImportRows } from "./import";
import { configuredGeocoder } from "./geocoder";
import { proposeTierGroups, tierUnitKey } from "./tag-tiers";
import { planStarterTags, planTagArrangement, type PlanCatalogGroup, type PlanVendor, type TagPlan } from "./tag-arrangement";
import {
  archiveVendorRow,
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
  countVendorsByTypeRows,
  deleteVendorFamilyRow,
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
export { estimateTravel, haversineKm } from "./travel";
export { vendorsPrivacy } from "./privacy";
export type {
  FindVendorsInput,
  SaveVendorResult,
  TravelEstimate,
  Vendor,
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
// Lot 16 (PRE-15) : type qui a encore des fiches, supprimé sans dire où elles vont.
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
  constructor(readonly reason: "too_large" | "unsupported_type" | "infected") {
    super(`fichier refusé : ${reason}`);
    this.name = "VendorFileRejectedError";
  }
}

function toField(row: VendorTypeFieldRow): VendorTypeField {
  return { id: row.id, typeId: row.typeId, label: row.label, kind: row.kind, choices: row.choices, isFilter: row.isFilter, position: row.position };
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
    typeId: row.typeId,
    postalCode: row.postalCode,
    city: row.city,
    location:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude, source: row.locationSource ?? "geocoded" }
        : null,
    tagIds: row.tagIds,
    archived: row.archivedAt !== null,
    isDemo: row.isDemo,
  };
}

function toFile(row: VendorFileRow): VendorFile {
  return { id: row.id, kind: row.kind, fileName: row.fileName, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
}

function toVendor(row: VendorRow, files: VendorFileRow[]): Vendor {
  return {
    ...toSummary(row),
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    country: row.country,
    internalNote: row.internalNote,
    website: row.website,
    socialLinks: cleanSocialLinks(row.socialLinks),
    siret: row.siret,
    importedFields: row.importedFields,
    fieldValues: row.fieldValues,
    files: files.map(toFile),
  };
}

const blankToNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

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

// PRE-02 — types et champs.

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

// Lot 16 (PRE-15) : un type qui a des fiches n'est supprimé qu'en disant où
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

// PRE-15 — fusion d'un type dans un autre (fiches et champs propres repris,
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

// PRE-14 / PRE-15 — familles, propres à l'organisation.

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

// Lot 21 (PRE-18, PRE-19, ADR 0050) — étiquettes de départ et rangement des
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
  const vendors: PlanVendor[] = carriers.map((vendor) => ({ id: vendor.id, name: vendor.name, familyId: vendor.typeId ? (familyOfType.get(vendor.typeId) ?? null) : null, tagIds: vendor.tagIds }));
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

// PRE-01 / PRE-03 — fiches.

function addressOf(input: Pick<VendorWrite, "addressLine" | "postalCode" | "city" | "country">): string | null {
  const parts = [input.addressLine, input.postalCode, input.city].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return input.country && input.country !== "FR" ? [...parts, input.country].join(" ") : parts.join(" ");
}

async function prepareWrite(organizationId: string, input: VendorInput): Promise<VendorWrite> {
  const name = input.name.trim();
  if (!name) throw new RangeError("le nom du prestataire est obligatoire");
  const types = await listVendorTypes(organizationId);
  const type = input.typeId ? types.find((candidate) => candidate.id === input.typeId) : null;
  if (input.typeId && !type) throw new VendorTypeNotFoundError();
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
    typeId: type?.id ?? null,
    name,
    contactName: blankToNull(input.contactName),
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    addressLine: blankToNull(input.addressLine),
    postalCode: blankToNull(input.postalCode),
    city: blankToNull(input.city),
    country: (input.country ?? "FR").trim().toUpperCase() || "FR",
    internalNote: blankToNull(input.internalNote),
    website: cleanWebsite(input.website),
    socialLinks: cleanSocialLinks(input.socialLinks ?? []),
    siret: cleanSiret(input.siret),
    fieldValues: type ? cleanFieldValues(type.fields, input.fieldValues ?? {}) : {},
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
  const { location, geocoding } = await locate(write, current.vendor);
  const row = await updateVendorRow(organizationId, vendorId, { ...write, location });
  if (!row) throw new VendorNotFoundError();
  return { vendor: toVendor(row, current.files), geocoding };
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

export async function getVendor(organizationId: string, vendorId: string): Promise<Vendor | null> {
  if (!UUID.test(vendorId)) return null;
  const found = await findVendor(organizationId, vendorId);
  return found ? toVendor(found.vendor, found.files) : null;
}

export async function getVendorsByIds(organizationId: string, vendorIds: string[]): Promise<VendorSummary[]> {
  return (await findVendorsByIds(organizationId, vendorIds.filter((id) => UUID.test(id)))).map(toSummary);
}

// PRE-04 à PRE-07 — recherche dans le carnet : filtres appliqués par la
// base ; un filtre qui ne convient pas au champ est ignoré, jamais en erreur.
export async function findVendors(input: FindVendorsInput): Promise<VendorListItem[]> {
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
  // Lot 16 (PRE-14) : une famille, ou « à classer » (types sans famille et
  // fiches sans type).
  const typeScope = input.unclassified
    ? { typeIds: types.filter((type) => type.familyId === null).map((type) => type.id), includeUntyped: true }
    : input.familyId
      ? { typeIds: types.filter((type) => type.familyId === input.familyId).map((type) => type.id), includeUntyped: false }
      : undefined;
  const rows = await findVendorRows(input.organizationId, {
    words: searchWords(input.text ?? ""),
    typeIds: input.typeIds?.filter((id) => UUID.test(id)),
    typeScope,
    tagIds: input.tagIds?.filter((id) => UUID.test(id)),
    fieldFilters,
    onlyIds: input.workedWith ? await listSelectedVendorIds(input.organizationId) : undefined,
    unplacedOnly: input.unplacedOnly ?? false,
    around,
    includeArchived: input.includeArchived ?? false,
    limit: Math.min(Math.max(input.limit ?? 200, 1), 500),
  });
  return rows.map(({ vendor, distanceKm }) => ({
    ...toSummary(vendor),
    travel: distanceKm === null ? null : estimateTravel(distanceKm, settings),
  }));
}

// PRE-09 — historique : consultations (module events) et prix final (réel
// du budget, module budget) ; prix moyen sur les prestations retenues.
export async function getVendorHistory(organizationId: string, vendorId: string, options: { budget?: boolean } = {}): Promise<VendorHistory> {
  const consultations = await listVendorConsultations(organizationId, vendorId);
  const actualBySlot = new Map<string, number | null>();
  if (options.budget !== false) {
    const eventIds = [...new Set(consultations.filter((entry) => entry.outcome === "selected").map((entry) => entry.eventId))];
    for (const eventId of eventIds) {
      const view = await listBudgetLines(organizationId, eventId);
      for (const line of view.lines) actualBySlot.set(line.eventVendorSlotId, line.actualAmountCents);
    }
  }
  const entries = consultations.map(({ slotId, ...entry }) => ({
    ...entry,
    finalCents: entry.outcome === "selected" ? (actualBySlot.get(slotId) ?? null) : null,
  }));
  const finals = entries.map((entry) => entry.finalCents).filter((value): value is number => value !== null);
  return { entries, averageFinalCents: finals.length > 0 ? Math.round(finals.reduce((sum, value) => sum + value, 0) / finals.length) : null };
}

// PRE-07 — paramètres du trajet estimé.

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

// Lot 12 (EVT-16) : dernier RIB déposé sur la fiche (pour l'espace clients,
// après vérification de l'accès par l'appelant).
export async function getVendorRibFile(organizationId: string, vendorId: string): Promise<FileDownload> {
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
  return rows.map((row) => ({ id: row.id, name: row.name, city: row.city, typeLabel: row.typeId ? (labels.get(row.typeId) ?? null) : null }));
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
