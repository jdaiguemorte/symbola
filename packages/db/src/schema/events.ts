// Schéma du module events (Lot 2, EVT-01/02/07). Tables métier : chaque
// table a organization_id (CLAUDE.md §2.4), protégée par Row-Level
// Security activée par une migration dédiée (même patron que hello,
// packages/db/drizzle).
import { boolean, date, integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const eventsSchema = pgSchema("events");

// Statuts fixes du cycle de vie d'un événement (PRD EVT-02) — pas une
// liste personnalisable par organisation, à la différence des sources de
// prospect et des motifs de perte ci-dessous.
export const eventStatusEnum = eventsSchema.enum("event_status", [
  "prospect",
  "quote_sent",
  "confirmed",
  "done",
  "lost",
]);

// EVT-07 : « la source est obligatoire, choisie dans une liste qu'elle
// paramètre » — jamais codée en dur (CLAUDE.md §2.5), gérée par
// organisation.
export const prospectSources = eventsSchema.table("prospect_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-02 : motif de perte, également paramétrable par organisation
// (CLAUDE.md §2.5 cite « motifs » comme exemple explicite). isFreeText
// marque l'entrée « autre » : une note libre devient alors obligatoire.
export const lossReasons = eventsSchema.table("loss_reasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  isFreeText: boolean("is_free_text").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = eventsSchema.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  status: eventStatusEnum("status").notNull().default("prospect"),
  // Date sans heure (CLAUDE.md §5) ; nulle tant que la date n'est pas
  // fixée (« Date à définir », EVT-01).
  eventDate: date("event_date"),
  // Lieu en texte libre : l'app Prestataires (fiches réutilisables) est
  // V2, hors MVP (cahier des charges §5.5).
  venueName: text("venue_name"),
  venueCity: text("venue_city"),
  prospectSourceId: uuid("prospect_source_id").references(() => prospectSources.id),
  lossReasonId: uuid("loss_reason_id").references(() => lossReasons.id),
  lossReasonNote: text("loss_reason_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Prénoms/noms affichés dans la liste (EVT-01) ; position fixe l'ordre
// d'affichage (ex. « Alice & Bob »).
export const eventClients = eventsSchema.table("event_clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-02 : « chaque changement [de statut] est historisé (date, auteur) ».
export const eventStatusHistory = eventsSchema.table("event_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  fromStatus: eventStatusEnum("from_status"),
  toStatus: eventStatusEnum("to_status").notNull(),
  changedByUserId: uuid("changed_by_user_id").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-03 : statuts fixes d'un poste prestataire (PRD) — pas une liste
// personnalisable, à la différence des postes eux-mêmes.
export const vendorSlotStatusEnum = eventsSchema.enum("vendor_slot_status", [
  "to_find",
  "quote_requested",
  "quote_received",
  "booked",
  "not_required",
]);

// EVT-03 : « la liste de postes par défaut de la planner » — paramétrable
// par organisation (CLAUDE.md §2.5), éventuellement chargée depuis le
// modèle de départ (packages/starter-templates), jamais codée en dur.
export const defaultVendorSlots = eventsSchema.table("default_vendor_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// EVT-03 : postes d'un événement, copiés de la liste par défaut à la
// création puis modifiables événement par événement.
export const eventVendorSlots = eventsSchema.table("event_vendor_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  label: text("label").notNull(),
  status: vendorSlotStatusEnum("status").notNull().default("to_find"),
  // Nom du prestataire en texte libre au MVP (l'app Prestataires est V2).
  vendorName: text("vendor_name"),
  // Montant en centimes, devise explicite (CLAUDE.md §5) ; facultatif.
  amountCents: integer("amount_cents"),
  currency: text("currency").notNull().default("EUR"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
