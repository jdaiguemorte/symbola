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
  VendorType,
  VendorTypeField,
  VendorTypeFieldInput,
} from "@symbola/contracts";
import { VENDOR_SOCIAL_NETWORKS, type VendorSocialLink } from "@symbola/contracts";
import { searchWords } from "@symbola/db/search";
import { listBudgetLines } from "@/modules/budget/service";
import { listSelectedVendorIds, listVendorConsultations } from "@/modules/events/service";
import { cleanFieldValues, isUsableFilter } from "./fields";
import { configuredGeocoder } from "./geocoder";
import {
  archiveVendorRow,
  deleteDemoVendors,
  deleteVendorFileRow,
  deleteVendorTag,
  deleteVendorType,
  deleteVendorTypeField,
  findVendor,
  findVendorFile,
  findVendorRows,
  findVendorsByIds,
  findVendorSettings,
  findVendorTags,
  findVendorTypes,
  insertVendor,
  insertVendorFile,
  insertVendorTag,
  insertVendorType,
  insertVendorTypeField,
  searchVendorRows,
  updateVendorLocation,
  updateVendorRow,
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

export { InvalidVendorFieldValueError, parseFieldInput } from "./fields";
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
  VendorType,
  VendorTypeField,
} from "@symbola/contracts";

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
  return { id: type.id, label: type.label, color: type.color, position: type.position, fields: fields.map(toField) };
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

export async function createVendorType(organizationId: string, label: string, color: string): Promise<VendorType> {
  if (!label.trim()) throw new RangeError("le nom du type est obligatoire");
  if (!COLOR.test(color)) throw new RangeError("couleur invalide");
  return toType({ type: await insertVendorType(organizationId, label.trim(), color.toLowerCase()), fields: [] });
}

export async function renameVendorType(organizationId: string, typeId: string, label: string, color: string): Promise<void> {
  if (!label.trim() || !COLOR.test(color)) throw new RangeError("nom ou couleur invalide");
  if (!(await updateVendorTypeRow(organizationId, typeId, label.trim(), color.toLowerCase()))) throw new VendorTypeNotFoundError();
}

// Les fiches de ce type gardent leurs coordonnées ; elles perdent le type.
export async function removeVendorType(organizationId: string, typeId: string): Promise<void> {
  await deleteVendorType(organizationId, typeId);
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

// Modèles de départ (ONB, packages/starter-templates) : ajoutés seulement
// si l'organisation n'a encore aucun type.
export async function addStarterVendorTypes(
  organizationId: string,
  types: { label: string; color: string; fields: VendorTypeFieldInput[] }[],
): Promise<number> {
  if ((await findVendorTypes(organizationId)).length > 0) return 0;
  for (const type of types) {
    const created = await createVendorType(organizationId, type.label, type.color);
    for (const field of type.fields) await addVendorTypeField(organizationId, created.id, field);
  }
  return types.length;
}

// Étiquettes.

export async function listVendorTags(organizationId: string): Promise<VendorTag[]> {
  return (await findVendorTags(organizationId)).map((row) => ({ id: row.id, label: row.label }));
}

export async function createVendorTag(organizationId: string, label: string): Promise<VendorTag> {
  const clean = label.trim();
  if (!clean) throw new RangeError("le nom de l'étiquette est obligatoire");
  const existing = (await findVendorTags(organizationId)).find((tag) => tag.label.toLocaleLowerCase("fr") === clean.toLocaleLowerCase("fr"));
  const row = existing ?? (await insertVendorTag(organizationId, clean));
  return { id: row.id, label: row.label };
}

export async function removeVendorTag(organizationId: string, tagId: string): Promise<void> {
  await deleteVendorTag(organizationId, tagId);
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
  const tags = new Set((await findVendorTags(organizationId)).map((tag) => tag.id));
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
  const rows = await findVendorRows(input.organizationId, {
    words: searchWords(input.text ?? ""),
    typeIds: input.typeIds?.filter((id) => UUID.test(id)),
    tagIds: input.tagIds?.filter((id) => UUID.test(id)),
    fieldFilters,
    onlyIds: input.workedWith ? await listSelectedVendorIds(input.organizationId) : undefined,
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
  addVendorTypeField,
  setVendorTypeFieldFilter,
  removeVendorTypeField,
  listVendorTags,
  createVendorTag,
  removeVendorTag,
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
