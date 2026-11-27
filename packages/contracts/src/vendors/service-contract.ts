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
  // Lot 48a (PRE-06) : sens du champ pour les contrôles du chrono (venue-rules.json), ou null.
  ruleKey: string | null;
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
export type VendorTypeFieldInput = { label: string; kind: VendorFieldKind; choices?: string[]; isFilter?: boolean; ruleKey?: string };
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
  // Lot 63e (PRE-01, PRE-11 ; ADR 0105) : les métiers de la fiche, le principal en premier, et le
  // principal (couleur et icône sur la carte) ; vide et null pour une fiche sans métier.
  typeIds: string[];
  primaryTypeId: string | null;
  /** @deprecated Lot 63e : le métier principal, gardé le temps que les appelants passent à typeIds et primaryTypeId. */
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

// Lot 29a (JRJ-02, décision D5) : coordonnées d'un prestataire, pour l'écran du jour J.
export type VendorContact = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
};

export type Vendor = VendorSummary & {
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  country: string;
  internalNote: string | null;
  // Lot 48a (DAT-08) : la note est confidentielle (chiffrée ; internalNote est alors null) ; elle se
  // lit par readVendorConfidentialNote, pour la titulaire et son auteur seuls.
  internalNoteConfidential: { authorUserId: string | null } | null;
  // Lot 48a (PRE-10, SEC-27) : IBAN masqué et changement « à vérifier par un autre canal ».
  bank: VendorBankSummary;
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
  // Lot 63e (ADR 0105) : les métiers cochés, et le principal (parmi eux ; à défaut, le premier).
  typeIds?: string[];
  primaryTypeId?: string | null;
  /** @deprecated Lot 63e : un seul métier ; pris seulement si typeIds est absent. */
  typeId?: string | null;
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
  // Lot 63b (HUB-14) : seulement ces fiches (celles d'un import, « Vérifier les N prestataires »).
  ids?: string[];
  // Lot 73a (PRE-05 ; spécification du lot 73, § 4.2) : l'état des pièces (« À régler » : à renouveler,
  // bientôt, à recevoir, à vérifier) ; une valeur inconnue est ignorée, jamais en erreur.
  documents?: VendorDocumentFilter;
  // Lot 73a : le tri (nom, métier, « Avec vous », évaluation, pièces, distance) et son sens. La distance
  // n'a de sens qu'avec un lieu ; sans lieu, elle trie par nom.
  sort?: VendorSort;
  direction?: "asc" | "desc";
};

export const VENDOR_DOCUMENT_FILTERS = ["to_settle", "up_to_date", "requested", "to_verify", "expired_or_soon"] as const;
export type VendorDocumentFilter = (typeof VENDOR_DOCUMENT_FILTERS)[number];
export const VENDOR_SORTS = ["name", "type", "worked_with", "rating", "documents", "distance"] as const;
export type VendorSort = (typeof VENDOR_SORTS)[number];

// Lot 73a (PRE-01, PRE-05, PRE-08) : une ligne du carnet porte aussi le contact, le téléphone, le nombre
// de mariages faits ensemble (retenus, hors exemples) et l'état résumé des pièces.
export type VendorListItem = VendorSummary & {
  travel: TravelEstimate | null;
  contactName: string | null;
  phone: string | null;
  workedWithCount: number;
  documentState: VendorDocumentState;
};

// L11-PRE-09 — historique d'un prestataire avec l'organisation.
export type VendorHistoryOutcome = "selected" | "not_selected" | "pending";
export type VendorHistoryEntry = {
  eventId: string;
  eventNames: string;
  eventDate: string | null;
  slotLabel: string;
  outcome: VendorHistoryOutcome;
  quotedCents: number | null;
  // Lot 73a (P9) : le montant du mariage — le réel du poste (somme de ses lignes de budget), une fois
  // soldé le total réglé ; null pour un prestataire non retenu (l'écran dit alors « devis … »).
  finalCents: number | null;
};
export type VendorHistory = { entries: VendorHistoryEntry[]; averageFinalCents: number | null };

// typeLabel : le métier principal ; typeLabels (lot 63e) : tous les métiers, le principal en premier.
export type VendorBookSearchResult = { id: string; name: string; city: string | null; typeLabel: string | null; typeLabels: string[] };

// Lot 63e (PRE-01, HUB-20 ; ADR 0105) — reprise des types combinés d'une organisation : ce que devient
// chaque type combiné (fusion dans un métier existant ou renommé, métiers ajoutés trouvés ou créés).
export type VendorTypeSplitStep = {
  typeId: string;
  label: string;
  vendorCount: number;
  first: { action: "merge"; into: { id: string; label: string } } | { action: "rename"; key: string; to: string };
  others: { key: string; label: string; existing: { id: string; label: string } | null }[];
  // Lot 65e : deux métiers aboutiraient au même type ; l'étape n'est pas appliquée, le rapport la
  // signale (à reprendre à la main dans Paramètres › Types de prestataires).
  conflict: boolean;
};
export type VendorTypeSplitResult = { typeId: string; label: string; vendors: number; createdTypes: string[] };

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
  // Lot 63e : chaque fiche une fois par famille ; familyId nul : « à classer » ; total : fiches (hors
  // archives), chacune une fois.
  countVendorsByFamily(organizationId: string): Promise<{ total: number; families: { familyId: string | null; count: number }[] }>;
  previewVendorTypeSplit(organizationId: string, catalog: StarterVendorCatalogInput, locale: "fr" | "en"): Promise<VendorTypeSplitStep[]>;
  splitCombinedVendorTypes(organizationId: string, catalog: StarterVendorCatalogInput, locale: "fr" | "en"): Promise<VendorTypeSplitResult[]>;
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
  getVendorContacts(organizationId: string, vendorIds: string[]): Promise<VendorContact[]>;
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

// Lot 48a (PRE-05 ; D3, ADR 0093) — pièces à échéance d'un prestataire.
// Lot 73a (P3, P4 ; migration 0234) : un nom court (« Assurance »), et la nature est-elle demandée
// d'habitude à un nouveau prestataire ? Aucun genre grammatical n'est gardé (P3).
export type VendorDocumentKind = { id: string; label: string; shortLabel: string | null; requestedByDefault: boolean; expires: boolean; starterKey: string | null; position: number };

// Lot 73a (PRE-05 ; P3) — l'état résumé des pièces d'une fiche, du plus pressant au plus calme. « À jour »
// demande au moins une pièce vérifiée et aucune à régler ; « Aucune pièce demandée » n'est jamais « À jour ».
export const VENDOR_DOCUMENT_STATES = ["expired", "expiring", "requested", "to_verify", "up_to_date", "none_requested"] as const;
export type VendorDocumentStateKind = (typeof VENDOR_DOCUMENT_STATES)[number];
// La raison, dite sous l'état : la fin avant un mariage où il est retenu (couple nul quand la personne n'a
// pas accès à ce mariage), la fin de validité passée (et le nombre de mariages à venir où il est retenu),
// la date de la demande, le dépôt par son lien.
export type VendorDocumentReason =
  | { code: "before_event"; eventId: string; eventDate: string; couple: string | null }
  | { code: "valid_until"; date: string; upcomingRetained: number }
  | { code: "expires_on"; date: string }
  | { code: "requested_on"; date: string | null }
  | { code: "uploaded_by_link"; at: string | null };
export type VendorDocumentState = {
  state: VendorDocumentStateKind;
  // La pièce la plus pressante (nulle pour « À jour » et « Aucune pièce demandée »).
  document: { documentId: string; kindId: string; label: string; shortLabel: string | null; validUntil: string | null } | null;
  // Les autres pièces à régler (« + 1 »).
  othersToSettle: number;
  reason: VendorDocumentReason | null;
};
// Un mariage à venir où la fiche est retenue (date de l'évènement), pour l'état de ses pièces.
export type VendorRetainedEvent = { eventId: string; eventDate: string };
export type VendorDocumentStatus = "requested" | "to_verify" | "verified";
export type VendorDocumentAlert = "valid" | "expiring" | "expired" | "no_expiry";
export type VendorDocument = {
  id: string;
  vendorId: string;
  kindId: string;
  kindLabel: string;
  status: VendorDocumentStatus;
  fileName: string | null;
  mime: string | null;
  sizeBytes: number | null;
  // Dernier jour de validité (AAAA-MM-JJ), ou null.
  validUntil: string | null;
  // Qui l'a déposée : la planner, le prestataire par son lien, ou personne encore (demandée).
  uploadedBy: "planner" | "vendor" | null;
  uploadedAt: string | null;
  requestedAt: string | null;
  verifiedAt: string | null;
  alert: VendorDocumentAlert;
};
// Pièce à signaler (fiche, évènement, « Aujourd'hui »).
export type VendorDocumentNotice = {
  documentId: string;
  vendorId: string;
  vendorName: string;
  kindLabel: string;
  validUntil: string | null;
  reason: "expired" | "expiring" | "lapses_before_event" | "to_verify";
};

// Lot 48a (PRE-10, SEC-27 ; D5) — IBAN d'un prestataire, toujours masqué hors du formulaire.
export type VendorBankCheck = { changeId: string; changedAt: string; changedBy: "planner" | "vendor" };
export type VendorBankSummary = { ibanMasked: string | null; hasBic: boolean; pendingCheck: VendorBankCheck | null };
export type VendorBankChange = {
  id: string;
  previousMasked: string | null;
  nextMasked: string | null;
  changedBy: { kind: "user"; userId: string } | { kind: "vendor" };
  changedAt: string;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
};

// Lot 48a (PRE-06 ; D4) — contraintes d'un lieu (champs de sa fiche porteurs d'une règle) et ce
// que les contrôles du chrono en disent. Jamais bloquant.
export type VenueConstraintSet = { vendorId: string; name: string; values: Record<string, VendorFieldValue> };
export type VenueProgramFinding = { itemId: string; ruleKey: string; venueName: string; vendorId: string; limit: string };
export type VenueCapacityFinding = { ruleKey: string; venueName: string; vendorId: string; limit: number; guests: number };
