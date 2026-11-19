// Schéma du module floorplans (lot 60, ADR 0012 et 0099 ; décision D1) : plans de salle des lieux du
// catalogue et des évènements. Chaque table a organization_id, protégée par Row-Level Security
// (migration 0184). Le lieu (vendors.vendors) et l'évènement (events.events) sont désignés sans clé
// étrangère entre schémas (avenant de l'ADR 0012) ; de même le prestataire retenu
// (events.event_vendor_candidates) et le lien qui a vu une version (events.event_links).
// Positions et dimensions en centimètres entiers, angles en degrés entiers : jamais de flottant.
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const floorplansSchema = pgSchema("floorplans");

// Valeurs fixes du module (géométrie et natures techniques, pas des listes métier) : la catégorie
// d'un élément, sa forme dessinée, la règle qui propose ses places, la nature d'une installation
// fixe, le format accepté d'un fond de plan (D4) et les jetons de couleur de DESIGN.md.
export const ELEMENT_CATEGORIES = ["table", "setup"] as const;
export const ELEMENT_SHAPES = ["circle", "rect", "ellipse"] as const;
export const SEAT_RULES = ["round", "two_sides", "one_side", "four_sides", "oval", "none"] as const;
export const FIXTURE_KINDS = ["outlet", "water", "door", "emergency_exit", "delivery", "pillar", "stage"] as const;
export const BACKGROUND_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ELEMENT_COLORS = ["surface", "primary-soft", "attention-soft", "critical-soft", "ground", "line"] as const;

const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
};

// Bibliothèque d'éléments de l'organisation (partie B) : copiée des données de départ
// (floorplan-elements.json) à la première lecture ; la planner masque, ajoute et règle les
// dimensions par défaut. Une entrée de départ n'a pas de libellé (il se traduit à l'affichage).
export const elementTypes = floorplansSchema.table("element_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  starterKey: text("starter_key"),
  label: text("label"),
  category: text("category", { enum: ELEMENT_CATEGORIES }).notNull(),
  shape: text("shape", { enum: ELEMENT_SHAPES }).notNull(),
  seatRule: text("seat_rule", { enum: SEAT_RULES }).notNull().default("none"),
  widthCm: integer("width_cm").notNull(),
  depthCm: integer("depth_cm").notNull(),
  // Besoins proposés (partie C) : le catalogue en propose, la planner les ajuste sur l'élément.
  powerOutlets: integer("power_outlets").notNull().default(0),
  powerAmps: integer("power_amps"),
  needsWater: boolean("needs_water").notNull().default(false),
  hidden: boolean("hidden").notNull().default(false),
  position: integer("position").notNull().default(0),
  ...stamps,
}, (table) => [
  index("element_types_organization_idx").on(table.organizationId),
  unique("element_types_starter_unique").on(table.organizationId, table.starterKey),
  check("element_types_label_check", sql`coalesce(((${table.starterKey} is not null and ${table.label} is null) or (${table.starterKey} is null and char_length(btrim(${table.label})) between 1 and 60)), false)`),
  check("element_types_category_check", sql`${table.category} in ('table', 'setup')`),
  check("element_types_shape_check", sql`${table.shape} in ('circle', 'rect', 'ellipse')`),
  check("element_types_seat_rule_check", sql`${table.seatRule} in ('round', 'two_sides', 'one_side', 'four_sides', 'oval', 'none')`),
  check("element_types_size_check", sql`${table.widthCm} between 10 and 10000 and ${table.depthCm} between 10 and 10000`),
  check("element_types_power_check", sql`${table.powerOutlets} between 0 and 20 and (${table.powerAmps} is null or ${table.powerAmps} between 1 and 125)`),
]);

// Espace d'un lieu du catalogue (vendorId, eventId nul), ou espace d'un évènement (eventId) : la
// copie d'un espace du lieu (sourceSpaceId) ou un espace vide pour un lieu hors catalogue. Le fond
// de plan est une image privée (ADR 0027), calibrée par deux points (en pixels de l'image) et la
// distance réelle qui les sépare.
export const spaces = floorplansSchema.table("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  vendorId: uuid("vendor_id"),
  eventId: uuid("event_id"),
  eventPlaceId: uuid("event_place_id"),
  sourceSpaceId: uuid("source_space_id"),
  name: text("name").notNull(),
  widthCm: integer("width_cm").notNull(),
  depthCm: integer("depth_cm").notNull(),
  backgroundKey: text("background_key"),
  backgroundMime: text("background_mime", { enum: BACKGROUND_MIMES }),
  backgroundSizeBytes: integer("background_size_bytes"),
  backgroundWidthPx: integer("background_width_px"),
  backgroundHeightPx: integer("background_height_px"),
  calibrationAx: integer("calibration_ax"),
  calibrationAy: integer("calibration_ay"),
  calibrationBx: integer("calibration_bx"),
  calibrationBy: integer("calibration_by"),
  calibrationDistanceCm: integer("calibration_distance_cm"),
  ...stamps,
}, (table) => [
  index("spaces_organization_idx").on(table.organizationId),
  index("spaces_vendor_idx").on(table.vendorId),
  index("spaces_event_idx").on(table.eventId),
  check("spaces_owner_check", sql`${table.vendorId} is not null or ${table.eventId} is not null`),
  check("spaces_name_check", sql`char_length(btrim(${table.name})) between 1 and 80`),
  check("spaces_size_check", sql`${table.widthCm} between 100 and 100000 and ${table.depthCm} between 100 and 100000`),
  check(
    "spaces_background_check",
    sql`coalesce(((${table.backgroundKey} is null and ${table.backgroundMime} is null and ${table.backgroundSizeBytes} is null and ${table.backgroundWidthPx} is null and ${table.backgroundHeightPx} is null)
      or (${table.backgroundKey} is not null and ${table.backgroundMime} in ('image/png', 'image/jpeg', 'image/webp') and ${table.backgroundSizeBytes} > 0 and ${table.backgroundWidthPx} > 0 and ${table.backgroundHeightPx} > 0)), false)`,
  ),
  check(
    "spaces_calibration_check",
    sql`(${table.calibrationDistanceCm} is null and ${table.calibrationAx} is null and ${table.calibrationAy} is null and ${table.calibrationBx} is null and ${table.calibrationBy} is null)
      or (${table.backgroundKey} is not null and ${table.calibrationDistanceCm} between 1 and 100000 and ${table.calibrationAx} is not null and ${table.calibrationAy} is not null and ${table.calibrationBx} is not null and ${table.calibrationBy} is not null
        and (${table.calibrationAx} <> ${table.calibrationBx} or ${table.calibrationAy} <> ${table.calibrationBy}))`,
  ),
]);

// Installations fixes d'un espace (partie A, L60-PLA-03) : prises (nombre, ampérage, triphasé),
// points d'eau, portes, issues de secours, accès de livraison, piliers, scène fixe. Copiées avec
// l'espace dans un évènement (sourceFixtureId).
export const spaceFixtures = floorplansSchema.table("space_fixtures", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  sourceFixtureId: uuid("source_fixture_id"),
  kind: text("kind", { enum: FIXTURE_KINDS }).notNull(),
  label: text("label"),
  xCm: integer("x_cm").notNull(),
  yCm: integer("y_cm").notNull(),
  widthCm: integer("width_cm").notNull(),
  depthCm: integer("depth_cm").notNull(),
  rotationDeg: integer("rotation_deg").notNull().default(0),
  outletCount: integer("outlet_count"),
  amps: integer("amps"),
  threePhase: boolean("three_phase").notNull().default(false),
  note: text("note"),
  position: integer("position").notNull().default(0),
  ...stamps,
}, (table) => [
  index("space_fixtures_organization_idx").on(table.organizationId),
  index("space_fixtures_space_idx").on(table.spaceId),
  check("space_fixtures_kind_check", sql`${table.kind} in ('outlet', 'water', 'door', 'emergency_exit', 'delivery', 'pillar', 'stage')`),
  check("space_fixtures_label_check", sql`${table.label} is null or char_length(btrim(${table.label})) between 1 and 60`),
  check("space_fixtures_note_check", sql`${table.note} is null or char_length(${table.note}) between 1 and 500`),
  check("space_fixtures_geometry_check", sql`${table.xCm} between -100000 and 200000 and ${table.yCm} between -100000 and 200000 and ${table.widthCm} between 5 and 100000 and ${table.depthCm} between 5 and 100000 and ${table.rotationDeg} between 0 and 359`),
  check("space_fixtures_outlet_check", sql`coalesce(((${table.kind} = 'outlet' and ${table.outletCount} between 1 and 50 and ${table.amps} between 1 and 125) or (${table.kind} <> 'outlet' and ${table.outletCount} is null and ${table.amps} is null and not ${table.threePhase})), false)`),
]);

// Configuration nommée d'un espace (« Dîner 120 en rondes »), ou plan d'un évènement (eventId,
// recopié de l'espace pour les lectures). revision protège d'une écriture concurrente ;
// publishedVersion est le numéro de la dernière version diffusée (0 : jamais diffusée) ;
// showVendorNames, le choix de la planner de nommer les prestataires aux autres (D8).
export const layouts = floorplansSchema.table("layouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  eventId: uuid("event_id"),
  sourceLayoutId: uuid("source_layout_id"),
  name: text("name").notNull(),
  revision: integer("revision").notNull().default(0),
  publishedVersion: integer("published_version").notNull().default(0),
  showVendorNames: boolean("show_vendor_names").notNull().default(false),
  ...stamps,
}, (table) => [
  index("layouts_organization_idx").on(table.organizationId),
  index("layouts_space_idx").on(table.spaceId),
  index("layouts_event_idx").on(table.eventId),
  check("layouts_name_check", sql`char_length(btrim(${table.name})) between 1 and 80`),
  check("layouts_versions_check", sql`${table.revision} >= 0 and ${table.publishedVersion} >= 0`),
]);

// Élément posé sur un plan (partie B) : table ou installation de soirée, au centre (x, y), tourné
// d'un angle, aux dimensions données. Le type est figé à la pose (clé de départ ou libellé) pour
// survivre au retrait de l'entrée de la bibliothèque. Sur un plan d'évènement, il peut désigner un
// prestataire retenu (vendorCandidateId) ; ses besoins (partie C) sont déclarés par la planner.
export const layoutElements = floorplansSchema.table("layout_elements", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  layoutId: uuid("layout_id")
    .notNull()
    .references(() => layouts.id, { onDelete: "cascade" }),
  elementTypeId: uuid("element_type_id").references(() => elementTypes.id, { onDelete: "set null" }),
  typeStarterKey: text("type_starter_key"),
  typeLabel: text("type_label"),
  category: text("category", { enum: ELEMENT_CATEGORIES }).notNull(),
  shape: text("shape", { enum: ELEMENT_SHAPES }).notNull(),
  name: text("name"),
  xCm: integer("x_cm").notNull(),
  yCm: integer("y_cm").notNull(),
  widthCm: integer("width_cm").notNull(),
  depthCm: integer("depth_cm").notNull(),
  rotationDeg: integer("rotation_deg").notNull().default(0),
  seats: integer("seats").notNull().default(0),
  color: text("color", { enum: ELEMENT_COLORS }),
  note: text("note"),
  vendorCandidateId: uuid("vendor_candidate_id"),
  powerOutlets: integer("power_outlets").notNull().default(0),
  powerAmps: integer("power_amps"),
  needsWater: boolean("needs_water").notNull().default(false),
  maxCableM: integer("max_cable_m"),
  position: integer("position").notNull().default(0),
  ...stamps,
}, (table) => [
  index("layout_elements_organization_idx").on(table.organizationId),
  index("layout_elements_layout_idx").on(table.layoutId),
  check("layout_elements_type_check", sql`coalesce(((${table.typeStarterKey} is not null and ${table.typeLabel} is null) or (${table.typeStarterKey} is null and char_length(btrim(${table.typeLabel})) between 1 and 60)), false)`),
  check("layout_elements_category_check", sql`${table.category} in ('table', 'setup')`),
  check("layout_elements_shape_check", sql`${table.shape} in ('circle', 'rect', 'ellipse')`),
  check("layout_elements_name_check", sql`${table.name} is null or char_length(btrim(${table.name})) between 1 and 60`),
  check("layout_elements_note_check", sql`${table.note} is null or char_length(${table.note}) between 1 and 500`),
  check("layout_elements_color_check", sql`${table.color} is null or ${table.color} in ('surface', 'primary-soft', 'attention-soft', 'critical-soft', 'ground', 'line')`),
  check("layout_elements_geometry_check", sql`${table.xCm} between -100000 and 200000 and ${table.yCm} between -100000 and 200000 and ${table.widthCm} between 10 and 10000 and ${table.depthCm} between 10 and 10000 and ${table.rotationDeg} between 0 and 359`),
  check("layout_elements_seats_check", sql`${table.seats} between 0 and 500`),
  check("layout_elements_power_check", sql`${table.powerOutlets} between 0 and 20 and (${table.powerAmps} is null or ${table.powerAmps} between 1 and 125) and (${table.maxCableM} is null or ${table.maxCableM} between 1 and 500)`),
]);

// Liaison d'un élément qui a un besoin électrique à une prise de l'espace (partie C) : une prise
// par élément. Aide de repérage, jamais une étude électrique (D6).
export const powerLinks = floorplansSchema.table("power_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  elementId: uuid("element_id")
    .notNull()
    .references(() => layoutElements.id, { onDelete: "cascade" }),
  fixtureId: uuid("fixture_id")
    .notNull()
    .references(() => spaceFixtures.id, { onDelete: "cascade" }),
  ...stamps,
}, (table) => [
  index("power_links_organization_idx").on(table.organizationId),
  index("power_links_fixture_idx").on(table.fixtureId),
  unique("power_links_element_unique").on(table.elementId),
]);

// Version diffusée du plan d'un évènement (partie D) : ce que voient le client et les prestataires,
// figé à la diffusion, sans note interne. Un numéro par diffusion, signalé aux prestataires.
export const layoutVersions = floorplansSchema.table("layout_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  layoutId: uuid("layout_id")
    .notNull()
    .references(() => layouts.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  publishedBy: uuid("published_by"),
  ...stamps,
}, (table) => [
  index("layout_versions_organization_idx").on(table.organizationId),
  unique("layout_versions_number_unique").on(table.layoutId, table.version),
  check("layout_versions_version_check", sql`${table.version} >= 1`),
]);

// Dernière version vue par un lien (prestataire ou client), pour signaler une version nouvelle.
export const linkViews = floorplansSchema.table("link_views", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  linkId: uuid("link_id").notNull(),
  layoutId: uuid("layout_id")
    .notNull()
    .references(() => layouts.id, { onDelete: "cascade" }),
  seenVersion: integer("seen_version").notNull(),
  ...stamps,
}, (table) => [
  index("link_views_organization_idx").on(table.organizationId),
  unique("link_views_link_layout_unique").on(table.linkId, table.layoutId),
  check("link_views_version_check", sql`${table.seenVersion} >= 1`),
]);
