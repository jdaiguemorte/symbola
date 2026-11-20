// Lot 60 (L60-PLA-01 à L60-PLA-05, prolongement de PRE-06 ; ADR 0099) — contrat interne du module
// floorplans : plans de salle des lieux du catalogue et des évènements. Positions et dimensions en
// centimètres entiers, angles en degrés entiers ; (x, y) désigne le centre d'un élément, l'origine
// étant le coin en haut à gauche de l'espace.

export const FLOORPLAN_SHAPES = ["circle", "rect", "ellipse"] as const;
export type FloorplanShape = (typeof FLOORPLAN_SHAPES)[number];
export const FLOORPLAN_CATEGORIES = ["table", "setup"] as const;
export type FloorplanCategory = (typeof FLOORPLAN_CATEGORIES)[number];
export const FLOORPLAN_SEAT_RULES = ["round", "two_sides", "one_side", "four_sides", "oval", "none"] as const;
export type FloorplanSeatRule = (typeof FLOORPLAN_SEAT_RULES)[number];
export const FLOORPLAN_FIXTURE_KINDS = ["outlet", "water", "door", "emergency_exit", "delivery", "pillar", "stage"] as const;
export type FloorplanFixtureKind = (typeof FLOORPLAN_FIXTURE_KINDS)[number];
// Jetons de couleur de DESIGN.md proposés pour un élément (aucune couleur libre).
export const FLOORPLAN_COLORS = ["surface", "primary-soft", "attention-soft", "critical-soft", "ground", "line"] as const;
export type FloorplanColor = (typeof FLOORPLAN_COLORS)[number];
export const FLOORPLAN_BACKGROUND_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type FloorplanBackgroundMime = (typeof FLOORPLAN_BACKGROUND_MIMES)[number];

export type FloorplanElementType = {
  id: string;
  starterKey: string | null;
  // Libellé à afficher : traduit pour une entrée de départ.
  label: string;
  category: FloorplanCategory;
  shape: FloorplanShape;
  seatRule: FloorplanSeatRule;
  widthCm: number;
  depthCm: number;
  powerOutlets: number;
  powerAmps: number | null;
  needsWater: boolean;
  hidden: boolean;
};

export type FloorplanElementTypeInput = {
  label: string;
  category: FloorplanCategory;
  shape: FloorplanShape;
  seatRule: FloorplanSeatRule;
  widthCm: number;
  depthCm: number;
  powerOutlets: number;
  powerAmps: number | null;
  needsWater: boolean;
};

export type FloorplanCalibration = { ax: number; ay: number; bx: number; by: number; distanceCm: number };
export type FloorplanBackground = { mime: FloorplanBackgroundMime; widthPx: number; heightPx: number; sizeBytes: number };

export type FloorplanSpace = {
  id: string;
  vendorId: string | null;
  eventId: string | null;
  eventPlaceId: string | null;
  sourceSpaceId: string | null;
  name: string;
  widthCm: number;
  depthCm: number;
  background: FloorplanBackground | null;
  calibration: FloorplanCalibration | null;
};

export type FloorplanSpaceInput = { name: string; widthCm: number; depthCm: number };

export type FloorplanFixture = {
  id: string;
  kind: FloorplanFixtureKind;
  label: string | null;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotationDeg: number;
  outletCount: number | null;
  amps: number | null;
  threePhase: boolean;
  note: string | null;
};

// Saisie d'une installation : id absent pour une nouvelle ; une installation absente de la liste
// enregistrée est retirée (ses liaisons aux éléments avec elle).
export type FloorplanFixtureInput = Omit<FloorplanFixture, "id"> & { id?: string | null };

export type FloorplanElement = {
  id: string;
  elementTypeId: string | null;
  typeStarterKey: string | null;
  typeLabel: string | null;
  category: FloorplanCategory;
  shape: FloorplanShape;
  name: string | null;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotationDeg: number;
  seats: number;
  color: FloorplanColor | null;
  note: string | null;
  // Prestataire retenu de l'évènement (events.event_vendor_candidates), sur un plan d'évènement.
  vendorCandidateId: string | null;
  powerOutlets: number;
  powerAmps: number | null;
  needsWater: boolean;
  maxCableM: number | null;
  // Prise de l'espace à laquelle l'élément est relié (partie C), ou null.
  fixtureId: string | null;
};

// Saisie d'un élément : un identifiant inconnu (créé dans l'éditeur) devient un nouvel élément.
export type FloorplanElementInput = Omit<FloorplanElement, "id"> & { id?: string | null };

export type FloorplanLayoutSummary = {
  id: string;
  spaceId: string;
  eventId: string | null;
  name: string;
  capacity: number;
  elementCount: number;
  publishedVersion: number;
  updatedAt: string;
};

export type FloorplanLayout = FloorplanLayoutSummary & {
  sourceLayoutId: string | null;
  revision: number;
  showVendorNames: boolean;
  elements: FloorplanElement[];
};

// Contrôles signalés, jamais bloquants (partie B) ; la surcharge d'une prise est celle déclarée
// (somme des prises demandées supérieure au nombre de prises, ou ampérage demandé supérieur), jamais
// une étude électrique (D6).
export type FloorplanFinding =
  | { kind: "overlap"; elementIds: [string, string] }
  | { kind: "outside"; elementId: string }
  | { kind: "seats_short"; seats: number; expected: number }
  | { kind: "power_unlinked"; elementId: string }
  | { kind: "outlet_overloaded"; fixtureId: string; used: number; available: number }
  | { kind: "amps_exceeded"; elementId: string; fixtureId: string; needed: number; available: number }
  | { kind: "cable_too_far"; elementId: string; fixtureId: string; distanceM: number; maxM: number };

// Tableau « Électricité » : chaque prise, sa charge déclarée et ce qui s'y branche.
export type FloorplanPowerRow = {
  fixtureId: string;
  label: string | null;
  outletCount: number;
  amps: number;
  threePhase: boolean;
  used: number;
  overloaded: boolean;
  elementIds: string[];
};

export type FloorplanVenueSpaces = { space: FloorplanSpace; fixtures: FloorplanFixture[]; layouts: FloorplanLayoutSummary[] }[];

// Plan complet pour l'éditeur de la planner.
export type FloorplanEditorView = {
  space: FloorplanSpace;
  fixtures: FloorplanFixture[];
  layout: FloorplanLayout;
  findings: FloorplanFinding[];
  power: FloorplanPowerRow[];
  expectedGuests: number | null;
};

// Version diffusée du plan d'un évènement (partie D) : figée à la diffusion, sans note interne.
export type FloorplanSnapshot = {
  layoutName: string;
  space: { name: string; widthCm: number; depthCm: number; background: FloorplanBackground | null; calibration: FloorplanCalibration | null };
  fixtures: Omit<FloorplanFixture, "note">[];
  elements: Omit<FloorplanElement, "note" | "elementTypeId">[];
  showVendorNames: boolean;
};

export type FloorplanVersionSummary = { version: number; publishedAt: string };

// Élément vu par un tiers : le nom d'un prestataire n'est donné qu'à lui-même, ou aux autres si la
// planner l'a coché (D8) ; sinon seul le type est montré.
export type SharedFloorplanElement = Omit<FloorplanSnapshot["elements"][number], "vendorCandidateId"> & {
  vendorName: string | null;
  mine: boolean;
};

export type SharedFloorplan = {
  layoutId: string;
  version: number;
  publishedAt: string;
  // Version publiée depuis la dernière visite de ce lien.
  isNew: boolean;
  layoutName: string;
  space: FloorplanSnapshot["space"];
  fixtures: FloorplanSnapshot["fixtures"];
  elements: SharedFloorplanElement[];
  power: FloorplanPowerRow[];
};

// D7 : tables copiées une fois vers le plan de table du lot 50.
export type FloorplanSeatingTable = { name: string; shape: "round" | "rectangular" | "head"; capacity: number };
