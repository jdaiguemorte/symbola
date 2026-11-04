// Schéma du module vendors (lot 11, PRE-01 à PRE-11, ADR 0031) : le carnet
// de prestataires de l'organisation. Chaque table a organization_id
// (CLAUDE.md §2.4), protégée par Row-Level Security (migration dédiée).
// Les prestataires consultés pour un poste vivent dans le module events et
// ne connaissent qu'un identifiant opaque de fiche (ADR 0011).
import { boolean, doublePrecision, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const vendorsSchema = pgSchema("vendors");

// PRE-02 — formats de champ proposés par le cahier des charges (§ 5.5).
export const vendorFieldKindEnum = vendorsSchema.enum("vendor_field_kind", [
  "number",
  "text",
  "time",
  "amount",
  "choice",
  "boolean",
]);

// PRE-02 — types de prestataires de l'organisation (modèles de départ dans
// packages/starter-templates, jamais dans le code).
export const vendorTypes = vendorsSchema.table("vendor_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  // Couleur des points sur la carte (#rrggbb).
  color: text("color").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
});

export const vendorTags = vendorsSchema.table("vendor_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vendorLocationSourceEnum = vendorsSchema.enum("vendor_location_source", ["geocoded", "manual"]);

// PRE-01 — fiche d'un prestataire. field_values : { idDuChamp: valeur },
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
  fieldValues: jsonb("field_values").$type<Record<string, string | number | boolean>>().notNull().default({}),
  tagIds: uuid("tag_ids").array().notNull().default([]),
  isDemo: boolean("is_demo").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vendorFileKindEnum = vendorsSchema.enum("vendor_file_kind", ["brochure", "rib"]);

// PRE-01 — plaquettes et RIB : fichiers privés (ADR 0027, ADR 0031 § 8).
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
});

// PRE-07 — paramètres du trajet estimé, par organisation (une ligne au plus).
export const vendorSettings = vendorsSchema.table("vendor_settings", {
  organizationId: uuid("organization_id").primaryKey(),
  // Coefficient de détour en millièmes (1300 = × 1,3).
  detourFactorPermille: integer("detour_factor_permille").notNull().default(1300),
  averageSpeedKmh: integer("average_speed_kmh").notNull().default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
