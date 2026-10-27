// Schéma du module quotes (Lot 4, Devis et Facturation — DEV-01). Tables
// métier : chaque table a organization_id (CLAUDE.md §2.4), protégée par
// Row-Level Security activée par une migration dédiée.
//
// Frontière de module (ADR 0011, docs/lots/lot-4-devis-facturation.md) :
// event_id référence un événement du module events, jamais par une clé
// étrangère PostgreSQL — uuid opaque, validé à la couche service via
// eventsService.getEvent.
//
// Montants en centimes entiers EUR, taux et remises en points de base
// (2000 = 20,00 %), quantités en millièmes (1500 = 1,5) : jamais de float.
import { sql } from "drizzle-orm";
import { boolean, check, date, integer, jsonb, pgSchema, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const quotesSchema = pgSchema("quotes");

// Réglages du module par organisation (CLAUDE.md §2.5 : rien en dur) :
// validité par défaut d'un devis, préfixes des séries de numérotation.
export const quoteSettings = quotesSchema.table("quote_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().unique(),
  validityDays: integer("validity_days").notNull().default(30),
  quotePrefix: text("quote_prefix").notNull().default("D"),
  invoicePrefix: text("invoice_prefix").notNull().default("F"),
  creditNotePrefix: text("credit_note_prefix").notNull().default("A"),
  // DEV-03 : horizon des encaissements à venir au tableau de bord (90 jours proposés).
  upcomingHorizonDays: integer("upcoming_horizon_days").notNull().default(90),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const numberSeriesKindEnum = quotesSchema.enum("number_series_kind", ["quote", "invoice", "credit_note"]);

// Compteur par série, par année et par organisation ; la série d'essai
// (is_demo, ADR 0008) est distincte et ne consomme jamais la série légale.
// Le rang est attribué en transaction (verrou de la ligne), dans la même
// transaction que le document : un échec annule aussi le rang, sans trou.
export const numberSeries = quotesSchema.table(
  "number_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    kind: numberSeriesKindEnum("kind").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (table) => [unique().on(table.organizationId, table.kind, table.isDemo, table.year)],
);

// DEV-01 — catalogue d'articles. Un article déjà utilisé n'est jamais
// supprimé, seulement archivé (les lignes de devis en gardent une copie).
export const catalogItems = quotesSchema.table("catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  unit: text("unit").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
  category: text("category"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quoteStatusEnum = quotesSchema.enum("quote_status", ["draft", "sent", "signed", "declined", "expired"]);

// DEV-01 — un devis, rattaché à un événement (décision 4 du lot), numéroté
// à sa création. Ses versions portent le contenu.
export const quotes = quotesSchema.table(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id").notNull(),
    number: text("number").notNull(),
    status: quoteStatusEnum("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(1),
    isDemo: boolean("is_demo").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.organizationId, table.number)],
);

export const globalDiscountKindEnum = quotesSchema.enum("global_discount_kind", ["none", "percent", "amount"]);

// DEV-01 — version d'un devis (V1, V2…). Brouillon tant que sent_at est
// nul ; une fois envoyée, immuable, avec les copies figées du régime de
// TVA, de la mention légale, de l'en-tête vendeur et des totaux : un
// document émis ne change jamais quand le profil change (ONB-02).
export const quoteVersions = quotesSchema.table(
  "quote_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id),
    version: integer("version").notNull(),
    globalDiscountKind: globalDiscountKindEnum("global_discount_kind").notNull().default("none"),
    // Points de base (percent) ou centimes (amount).
    globalDiscountValue: integer("global_discount_value").notNull().default(0),
    validUntil: date("valid_until"),
    vatRegime: text("vat_regime"),
    legalMention: text("legal_mention"),
    sellerSnapshot: jsonb("seller_snapshot"),
    totalsSnapshot: jsonb("totals_snapshot"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.quoteId, table.version)],
);

// DEV-01 — ligne d'une version : article du catalogue (copié) ou ligne libre.
export const quoteLines = quotesSchema.table("quote_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  versionId: uuid("version_id")
    .notNull()
    .references(() => quoteVersions.id),
  catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id),
  label: text("label").notNull(),
  description: text("description"),
  unit: text("unit").notNull(),
  quantityMilli: integer("quantity_milli").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
  discountBasisPoints: integer("discount_basis_points").notNull().default(0),
  position: integer("position").notNull().default(0),
});

// DEV-03 — modes de paiement, liste paramétrable par organisation (modèle
// de départ facultatif dans packages/starter-templates). Archivés plutôt
// que supprimés : une échéance payée garde son mode.
export const paymentMethods = quotesSchema.table("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// DEV-03 — échéancier d'une version de devis : chaque acompte a un montant
// fixe OU un pourcentage du total TTC, et une date. Le solde est calculé,
// jamais stocké. Le paiement (date, mode) s'enregistre après l'envoi.
export const paymentScheduleItems = quotesSchema.table(
  "payment_schedule_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quoteVersions.id),
    label: text("label").notNull(),
    amountCents: integer("amount_cents"),
    percentageBasisPoints: integer("percentage_basis_points"),
    dueDate: date("due_date").notNull(),
    paidOn: date("paid_on"),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
    paidRecordedAt: timestamp("paid_recorded_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    check(
      "payment_schedule_items_amount_xor_percentage",
      sql`(${table.amountCents} is null) <> (${table.percentageBasisPoints} is null)`,
    ),
  ],
);
