// Interface du service.ts de vendors (lot 11, ADR 0031) — le carnet de
// prestataires de l'organisation, pensé comme le futur contrat HTTP
// /v1/vendors si le module devient une app autonome (cahier des charges
// § 5.5). Les montants restent des centimes entiers EUR (CLAUDE.md § 5).
import type { FileDownload } from "../file-download";

export type VendorFieldKind = "number" | "text" | "time" | "amount" | "choice" | "boolean";
export type VendorFieldValue = string | number | boolean;

export type VendorTypeField = {
  id: string;
  typeId: string;
  label: string;
  kind: VendorFieldKind;
  choices: string[];
  isFilter: boolean;
  position: number;
};

// Lot 16 (L16-PRE-14, ADR 0040) — familles de types, propres à l'organisation.
// icon : clé d'icône connue de l'app (BUDGET_LINE_ICONS, starter-templates).
// starterKey : famille de départ dont elle vient (nulle si créée par l'organisation).
export type VendorFamily = { id: string; label: string; color: string; icon: string; position: number; starterKey: string | null };
export type VendorFamilyInput = { label: string; color: string; icon: string };

// familyId nul : type « à classer » (aucune famille).
// starterKey : type de départ reconnu (synonymes), nul sinon.
export type VendorType = {
  id: string;
  label: string;
  color: string;
  position: number;
  familyId: string | null;
  starterKey: string | null;
  fields: VendorTypeField[];
};

// Données de départ d'un métier (packages/starter-templates), déjà traduites.
export type StarterVendorCatalogInput = {
  key: string;
  label: string;
  color: string;
  icon: string;
  types: { key: string; label: string; synonyms: string[]; fields: VendorTypeFieldInput[] }[];
}[];
export type VendorTypeFieldInput = { label: string; kind: VendorFieldKind; choices?: string[]; isFilter?: boolean };
// Lot 20 (décision 5, ADR 0049) : une étiquette appartient à un groupe (nul =
// « Autres ») et vaut pour certaines familles de prestataires (vide = toutes).
export type VendorTag = { id: string; label: string; groupId: string | null; familyIds: string[]; position: number };
export type VendorTagInput = { label: string; groupId?: string | null; familyIds?: string[] };
// Un groupe « palier » (exclusive) n'accepte qu'une étiquette par fiche.
export type VendorTagGroup = { id: string; label: string; exclusive: boolean; position: number };
export type VendorTagGroupInput = { label: string; exclusive: boolean };
// Paliers repérés dans les étiquettes sans groupe (« 100 à 150 personnes »…).
export type VendorTagTierProposal = { unit: string; tags: { id: string; label: string }[] };

// Lot 21 (L21-PRE-18, ADR 0050) — étiquettes de départ : groupes (certains
// « paliers »), libellé dans la langue de l'organisation, libellés connus pour
// reconnaître une étiquette existante, familles de départ visées (vide = toutes).
export type StarterVendorTagCatalogInput = { label: string; exclusive: boolean; tags: { label: string; aliases: string[]; familyKeys: string[] }[] }[];

export type VendorTagSeedResult = { created: number; placed: number };

// Lot 21 (L21-PRE-19) — rangement des étiquettes sans famille ni groupe (reprises
// de l'import) : ce qui change, ou a changé.
export type VendorTagArrangement = {
  changed: boolean;
  looseTags: number;
  familiesSet: number;
  catalogMatched: number;
  tiers: { label: string; count: number }[];
  adjustedVendors: { id: string; name: string }[];
  remaining: number;
};

export type VendorLocation = { latitude: number; longitude: number; source: "geocoded" | "manual" };

export type VendorFileKind = "brochure" | "rib";
export type VendorFile = { id: string; kind: VendorFileKind; fileName: string; mime: string; sizeBytes: number; createdAt: string };

export type VendorSummary = {
  id: string;
  name: string;
  typeId: string | null;
  postalCode: string | null;
  city: string | null;
  location: VendorLocation | null;
  tagIds: string[];
  archived: boolean;
  isDemo: boolean;
  // Lot 28c (PRE-01, D8) : évaluation interne, de 1 à 5 ; null sans évaluation.
  rating: number | null;
};

export type Vendor = VendorSummary & {
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  country: string;
  internalNote: string | null;
  // Lot 28c (PRE-01, D8) : tarifs indicatifs, en texte libre.
  indicativePrices: string | null;
  // Lot 14 (décision M) : liens et identité légale, communs à tous les types.
  website: string | null;
  socialLinks: VendorSocialLink[];
  siret: string | null;
  // Colonnes d'un import gardées telles quelles (intitulé → texte), ou null.
  importedFields: Record<string, string> | null;
  fieldValues: Record<string, VendorFieldValue>;
  files: VendorFile[];
};

// Réseaux sociaux reconnus (ordre d'affichage : Instagram en premier).
export const VENDOR_SOCIAL_NETWORKS = ["instagram", "facebook", "pinterest", "linkedin", "x"] as const;
export type VendorSocialNetwork = (typeof VENDOR_SOCIAL_NETWORKS)[number];
export type VendorSocialLink = { network: VendorSocialNetwork; url: string };

export type VendorInput = {
  name: string;
  typeId: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string;
  internalNote?: string | null;
  // Lot 28c (PRE-01) : évaluation de 1 à 5 (null = aucune) et tarifs indicatifs.
  rating?: number | null;
  indicativePrices?: string | null;
  website?: string | null;
  socialLinks?: VendorSocialLink[];
  siret?: string | null;
  fieldValues?: Record<string, VendorFieldValue>;
  tagIds?: string[];
};

export type SaveVendorResult = { vendor: Vendor; geocoding: "placed" | "not_found" | "unchanged" | "no_address" };

// L11-PRE-07 — trajet estimé (toujours affiché « estimation »).
export type TravelEstimate = { distanceKm: number; minutes: number };
export type VendorSettings = { detourFactorPermille: number; averageSpeedKmh: number };

export type VendorFieldFilter = { fieldId: string; op: "gte" | "lte" | "eq"; value: VendorFieldValue };
export type VendorAround = { latitude: number; longitude: number; radiusKm: number };

export type FindVendorsInput = {
  organizationId: string;
  text?: string;
  typeIds?: string[];
  // Lot 16 (L16-PRE-14) : les types d'une famille, ou « à classer » (types sans
  // famille et fiches sans type).
  familyId?: string;
  unclassified?: boolean;
  tagIds?: string[];
  fieldFilters?: VendorFieldFilter[];
  // « Déjà travaillé avec » : au moins une fois retenu (module events).
  workedWith?: boolean;
  // Lot 15 (GEO-01) : seulement les fiches sans point sur la carte (« à placer »).
  unplacedOnly?: boolean;
  // Lot 28c (PRE-01) : évaluation d'au moins tant (1 à 5).
  minRating?: number;
  around?: VendorAround;
  includeArchived?: boolean;
  limit?: number;
};

export type VendorListItem = VendorSummary & { travel: TravelEstimate | null };

// L11-PRE-09 — historique d'un prestataire avec l'organisation.
export type VendorHistoryOutcome = "selected" | "not_selected" | "pending";
export type VendorHistoryEntry = {
  eventId: string;
  eventNames: string;
  eventDate: string | null;
  slotLabel: string;
  outcome: VendorHistoryOutcome;
  quotedCents: number | null;
  finalCents: number | null;
};
export type VendorHistory = { entries: VendorHistoryEntry[]; averageFinalCents: number | null };

export type VendorBookSearchResult = { id: string; name: string; city: string | null; typeLabel: string | null };

export type VendorsServiceContract = {
  listVendorTypes(organizationId: string): Promise<VendorType[]>;
  createVendorType(organizationId: string, label: string, color: string): Promise<VendorType>;
  renameVendorType(organizationId: string, typeId: string, label: string, color: string): Promise<void>;
  // L16-PRE-15 : un type qui a des fiches n'est supprimé qu'en disant où elles vont
  // (un autre type, ou null pour « à classer ») ; jamais en silence.
  removeVendorType(organizationId: string, typeId: string, options?: { moveVendorsTo?: string | null }): Promise<void>;
  setVendorTypeFamily(organizationId: string, typeId: string, familyId: string | null): Promise<void>;
  mergeVendorTypes(organizationId: string, input: { sourceTypeId: string; targetTypeId: string }): Promise<{ movedVendors: number; movedFields: number }>;
  countVendorsByType(organizationId: string): Promise<{ typeId: string | null; count: number }[]>;
  listVendorFamilies(organizationId: string): Promise<VendorFamily[]>;
  createVendorFamily(organizationId: string, input: VendorFamilyInput): Promise<VendorFamily>;
  updateVendorFamily(organizationId: string, familyId: string, input: VendorFamilyInput): Promise<void>;
  moveVendorFamily(organizationId: string, familyId: string, direction: "up" | "down"): Promise<void>;
  removeVendorFamily(organizationId: string, familyId: string): Promise<void>;
  seedStarterVendorCatalog(
    organizationId: string,
    catalog: StarterVendorCatalogInput,
    // explicit : demande de la planner (« Ajouter les types de départ ») ; sinon
    // les données de départ ne sont posées qu'une fois, jamais rétablies d'office.
    options: { withTypes: boolean; explicit?: boolean },
  ): Promise<{ families: number; types: number; classified: number }>;
  addVendorTypeField(organizationId: string, typeId: string, input: VendorTypeFieldInput): Promise<VendorTypeField>;
  setVendorTypeFieldFilter(organizationId: string, fieldId: string, isFilter: boolean): Promise<void>;
  removeVendorTypeField(organizationId: string, fieldId: string): Promise<void>;
  listVendorTags(organizationId: string): Promise<VendorTag[]>;
  createVendorTag(organizationId: string, label: string, options?: Omit<VendorTagInput, "label">): Promise<VendorTag>;
  updateVendorTag(organizationId: string, tagId: string, input: VendorTagInput): Promise<void>;
  removeVendorTag(organizationId: string, tagId: string): Promise<void>;
  listVendorTagGroups(organizationId: string): Promise<VendorTagGroup[]>;
  createVendorTagGroup(organizationId: string, input: VendorTagGroupInput): Promise<VendorTagGroup>;
  updateVendorTagGroup(organizationId: string, groupId: string, input: VendorTagGroupInput): Promise<void>;
  // Ses étiquettes passent dans « Autres » ; aucune fiche ne les perd.
  removeVendorTagGroup(organizationId: string, groupId: string): Promise<void>;
  listVendorTagTierProposals(organizationId: string): Promise<VendorTagTierProposal[]>;
  // Range les étiquettes d'une proposition dans un nouveau groupe « palier ».
  applyVendorTagTierProposal(organizationId: string, unit: string, groupLabel: string): Promise<VendorTagGroup | null>;
  // Lot 21 (L21-PRE-18, L21-PRE-19, ADR 0050).
  seedStarterVendorTags(organizationId: string, catalog: StarterVendorTagCatalogInput): Promise<VendorTagSeedResult>;
  countMissingStarterVendorTags(organizationId: string, catalog: StarterVendorTagCatalogInput): Promise<number>;
  previewVendorTagArrangement(organizationId: string, catalog: StarterVendorTagCatalogInput): Promise<VendorTagArrangement>;
  arrangeVendorTags(organizationId: string, catalog: StarterVendorTagCatalogInput, options?: { tagIds?: string[] }): Promise<VendorTagArrangement>;
  createVendor(organizationId: string, input: VendorInput): Promise<SaveVendorResult>;
  updateVendor(organizationId: string, vendorId: string, input: VendorInput): Promise<SaveVendorResult>;
  setVendorLocation(organizationId: string, vendorId: string, latitude: number, longitude: number): Promise<void>;
  archiveVendor(organizationId: string, vendorId: string): Promise<void>;
  getVendor(organizationId: string, vendorId: string): Promise<Vendor | null>;
  getVendorsByIds(organizationId: string, vendorIds: string[]): Promise<VendorSummary[]>;
  findVendors(input: FindVendorsInput): Promise<VendorListItem[]>;
  getVendorHistory(organizationId: string, vendorId: string): Promise<VendorHistory>;
  getVendorSettings(organizationId: string): Promise<VendorSettings>;
  saveVendorSettings(organizationId: string, settings: VendorSettings): Promise<void>;
  attachVendorFile(input: {
    organizationId: string;
    vendorId: string;
    kind: VendorFileKind;
    fileName: string;
    content: Uint8Array;
    uploadedByUserId: string;
  }): Promise<VendorFile>;
  getVendorFile(organizationId: string, fileId: string): Promise<FileDownload>;
  removeVendorFile(organizationId: string, fileId: string): Promise<void>;
  searchVendorBook(organizationId: string, words: string[], limit: number): Promise<VendorBookSearchResult[]>;
  geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null>;
};
