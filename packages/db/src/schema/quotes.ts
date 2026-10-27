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
  // DEV-04 : délai de paiement d'une facture de solde (jours après émission)
  // et mentions de facturation (conditions de paiement…), à relire par le
  // comptable ; modèle de départ dans packages/starter-templates.
  invoicePaymentTermDays: integer("invoice_payment_term_days").notNull().default(30),
  invoiceMentions: text("invoice_mentions"),
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

// DEV-04 : un client professionnel exige une facture Factur-X (lot dédié,
// décision 1 du lot 4) ; le choix est enregistré dès maintenant.
export const clientKindEnum = quotesSchema.enum("client_kind", ["individual", "professional"]);

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
    clientKind: clientKindEnum("client_kind").notNull().default("individual"),
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

// DEV-02 — demande de signature d'une version envoyée (une seule par
// version). Le fournisseur (ADR 0006/0021) est derrière une interface ;
// external_id est l'identifiant de la soumission chez lui. Les documents
// signés et le certificat de preuve sont archivés en stockage privé.
export const signatureRequestStatusEnum = quotesSchema.enum("signature_request_status", ["pending", "completed", "declined"]);

export const signatureRequests = quotesSchema.table(
  "signature_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quoteVersions.id),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    status: signatureRequestStatusEnum("status").notNull().default("pending"),
    signedDocumentKey: text("signed_document_key"),
    auditCertificateKey: text("audit_certificate_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.versionId), unique().on(table.provider, table.externalId)],
);

// DEV-02 — signataires d'une demande, saisis sur le devis (ADR 0021) :
// copie figée du nom, de l'e-mail et de l'adresse de facturation.
export const quoteSignerStatusEnum = quotesSchema.enum("quote_signer_status", ["pending", "signed", "declined"]);

export const quoteSigners = quotesSchema.table("quote_signers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => signatureRequests.id),
  // Marié de l'événement (uuid opaque du module events, ADR 0011), facultatif.
  eventClientId: uuid("event_client_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  billingAddress: text("billing_address").notNull(),
  // Lien personnel de signature chez le fournisseur (secret : ne s'affiche
  // qu'à la planner et au marié concerné).
  signingUrl: text("signing_url").notNull(),
  externalId: text("external_id"),
  status: quoteSignerStatusEnum("status").notNull().default("pending"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
});

// DEV-02 — trace de chaque appel webhook accepté (les appels rejetés,
// sans organisation fiable, vont au journal applicatif) ; aucune donnée
// personnelle ni corps de requête.
export const signatureWebhookLog = quotesSchema.table("signature_webhook_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  requestId: uuid("request_id").references(() => signatureRequests.id),
  eventType: text("event_type").notNull(),
  outcome: text("outcome").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

// DEV-04 — facture d'acompte (une échéance de l'échéancier) ou de solde,
// émise depuis un devis signé. Tout ce qui figure sur la facture est copié
// et figé à l'émission (vendeur, acheteur, lignes, totaux, mentions). Une
// facture émise est immuable : un trigger PostgreSQL refuse UPDATE et
// DELETE au rôle applicatif (seule la purge d'un essai supprime une
// facture fictive) ; la correction passe par un avoir.
export const invoiceKindEnum = quotesSchema.enum("invoice_kind", ["deposit", "balance"]);

export const invoices = quotesSchema.table(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quoteVersions.id),
    scheduleItemId: uuid("schedule_item_id").references(() => paymentScheduleItems.id),
    kind: invoiceKindEnum("kind").notNull(),
    number: text("number").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    // Date d'émission et date de la prestation ou de l'acompte (Paris).
    issuedOn: date("issued_on").notNull(),
    serviceDate: date("service_date"),
    paymentDueOn: date("payment_due_on").notNull(),
    amountCents: integer("amount_cents").notNull(),
    vatRegime: text("vat_regime").notNull(),
    legalMention: text("legal_mention"),
    mentions: text("mentions"),
    sellerSnapshot: jsonb("seller_snapshot").notNull(),
    buyerSnapshot: jsonb("buyer_snapshot").notNull(),
    linesSnapshot: jsonb("lines_snapshot").notNull(),
    totalsSnapshot: jsonb("totals_snapshot").notNull(),
  },
  (table) => [unique().on(table.organizationId, table.number)],
);

// DEV-04 — avoir (série à part), partiel ou total, sur une facture émise ;
// immuable lui aussi.
export const creditNotes = quotesSchema.table(
  "credit_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    number: text("number").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    issuedOn: date("issued_on").notNull(),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    legalMention: text("legal_mention"),
    sellerSnapshot: jsonb("seller_snapshot").notNull(),
    buyerSnapshot: jsonb("buyer_snapshot").notNull(),
    totalsSnapshot: jsonb("totals_snapshot").notNull(),
  },
  (table) => [unique().on(table.organizationId, table.number)],
);
