// Schéma du module vendors (lot 11, L11-PRE-01 à L11-PRE-11, ADR 0031) : le carnet
// de prestataires de l'organisation. Chaque table a organization_id
// (CLAUDE.md §2.4), protégée par Row-Level Security (migration dédiée).
// Les prestataires consultés pour un poste vivent dans le module events et
// ne connaissent qu'un identifiant opaque de fiche (ADR 0011).
import { boolean, check, doublePrecision, integer, jsonb, pgSchema, text, timestamp, unique, uuid, type AnyPgColumn, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const vendorsSchema = pgSchema("vendors");

// L11-PRE-02 — formats de champ proposés par le cahier des charges (§ 5.5).
export const vendorFieldKindEnum = vendorsSchema.enum("vendor_field_kind", [
  "number",
  "text",
  "time",
  "amount",
  "choice",
  "boolean",
]);

// Lot 16 (L16-PRE-14, ADR 0040) — familles de types : une dizaine, propres à
// l'organisation (renommées, scindées, réordonnées, L16-PRE-15). starter_key :
// clé de la famille de départ dont elle vient, pour y ranger les types par
// leurs synonymes ; nulle pour une famille créée par l'organisation.
export const vendorFamilies = vendorsSchema.table(
  "vendor_families",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    label: text("label").notNull(),
    // Couleur des points sur la carte (#rrggbb) et pictogramme (clé d'icône).
    color: text("color").notNull(),
    icon: text("icon").notNull().default("other"),
    position: integer("position").notNull().default(0),
    starterKey: text("starter_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [unique("vendor_families_organization_starter_key_unique").on(table.organizationId, table.starterKey)],
);

// L11-PRE-02 — types de prestataires de l'organisation (modèles de départ dans
// packages/starter-templates, jamais dans le code).
export const vendorTypes = vendorsSchema.table("vendor_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  // Lot 11 : couleur des points sur la carte. Lot 16 : la carte prend celle
  // de la famille ; celle-ci ne sert plus qu'aux types « à classer ».
  color: text("color").notNull(),
  position: integer("position").notNull().default(0),
  // Lot 16 (L16-PRE-14) : famille (nulle = « à classer ») et clé du type de départ
  // reconnu par les synonymes (nulle si aucun).
  familyId: uuid("family_id").references((): AnyPgColumn => vendorFamilies.id, { onDelete: "set null" }),
  starterKey: text("starter_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("vendor_types_organization_idx").on(table.organizationId)]);

export const vendorTypeFields = vendorsSchema.table("vendor_type_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  typeId: uuid("type_id")
    .notNull()
    .references(() => vendorTypes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  kind: vendorFieldKindEnum("kind").notNull(),
  // Choix proposés pour un champ « liste de choix ».
  choices: jsonb("choices").$type<string[]>().notNull().default([]),
  isFilter: boolean("is_filter").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("vendor_type_fields_organization_idx").on(table.organizationId)]);

// Lot 20 (décision 5, ADR 0049) — groupes d'étiquettes (Style, Équipements,
// Capacité…). Un groupe « palier » (exclusive) n'accepte qu'une étiquette par
// fiche : « 100 à 150 personnes » ou « 150 à 200 personnes », pas les deux.
export const vendorTagGroups = vendorsSchema.table("vendor_tag_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  exclusive: boolean("exclusive").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("vendor_tag_groups_organization_idx").on(table.organizationId)]);

export const vendorTags = vendorsSchema.table("vendor_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  // Lot 20 (décision 5) : groupe (nul = « Autres ») et familles de
  // prestataires concernées (vide = toutes) ; ordre dans le groupe (paliers).
  groupId: uuid("group_id").references((): AnyPgColumn => vendorTagGroups.id, { onDelete: "set null" }),
  familyIds: uuid("family_ids").array().notNull().default([]),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("vendor_tags_organization_idx").on(table.organizationId)]);

export const vendorLocationSourceEnum = vendorsSchema.enum("vendor_location_source", ["geocoded", "manual"]);

// L11-PRE-01 — fiche d'un prestataire. field_values : { idDuChamp: valeur },
// validé selon le format du champ (ADR 0031 § 3). Latitude/longitude en
// degrés, sans PostGIS (ADR 0031 § 4).
export const vendors = vendorsSchema.table("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  typeId: uuid("type_id").references(() => vendorTypes.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  addressLine: text("address_line"),
  postalCode: text("postal_code"),
  city: text("city"),
  country: text("country").notNull().default("FR"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationSource: vendorLocationSourceEnum("location_source"),
  internalNote: text("internal_note"),
  // Lot 28c (PRE-01, D8) : évaluation interne (1 à 5) et tarifs indicatifs
  // (texte libre), visibles de l'organisation seule.
  rating: integer("rating"),
  indicativePrices: text("indicative_prices"),
  // Lot 14 (décision M) : site web, réseaux sociaux et SIRET, communs à tous
  // les types ; colonnes d'un import gardées telles quelles (TVA, APE…).
  website: text("website"),
  socialLinks: jsonb("social_links").$type<{ network: string; url: string }[]>().notNull().default([]),
  siret: text("siret"),
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  fieldValues: jsonb("field_values").$type<Record<string, string | number | boolean>>().notNull().default({}),
  tagIds: uuid("tag_ids").array().notNull().default([]),
  isDemo: boolean("is_demo").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("vendors_organization_idx").on(table.organizationId),
  check("vendors_rating_check", sql`${table.rating} between 1 and 5`),
]);

export const vendorFileKindEnum = vendorsSchema.enum("vendor_file_kind", ["brochure", "rib"]);

// L11-PRE-01 — plaquettes et RIB : fichiers privés (ADR 0027, ADR 0031 § 8).
export const vendorFiles = vendorsSchema.table("vendor_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  kind: vendorFileKindEnum("kind").notNull(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("vendor_files_organization_idx").on(table.organizationId)]);

// L11-PRE-07 — paramètres du trajet estimé, par organisation (une ligne au plus).
export const vendorSettings = vendorsSchema.table("vendor_settings", {
  organizationId: uuid("organization_id").primaryKey(),
  // Coefficient de détour en millièmes (1300 = × 1,3).
  detourFactorPermille: integer("detour_factor_permille").notNull().default(1300),
  averageSpeedKmh: integer("average_speed_kmh").notNull().default(60),
  // Lot 16 (L16-PRE-14) : familles de départ déjà posées pour cette organisation ;
  // elles ne le sont qu'une fois, jamais rétablies d'office.
  familiesSeededAt: timestamp("families_seeded_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});
