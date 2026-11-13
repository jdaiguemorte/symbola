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
import { bigint, boolean, check, date, integer, jsonb, pgSchema, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn, index } from "drizzle-orm/pg-core";

export const quotesSchema = pgSchema("quotes");

// Lot 17 (DEV-09) : Moderne (Helvetica) ou Classique (Times), polices
// incluses dans le moteur PDF.
export const documentFontEnum = quotesSchema.enum("document_font", ["modern", "classic"]);

// Réglages du module par organisation (CLAUDE.md §2.5 : rien en dur) :
// validité par défaut d'un devis, préfixes des séries de numérotation.
// Lot 31a (JUR-08, décision D5) : sommes versées d'avance, acomptes ou arrhes (leurs effets
// diffèrent en cas d'annulation, article L214-1 du Code de la consommation).
export const advanceKindEnum = quotesSchema.enum("advance_kind", ["deposit", "earnest"]);

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
  // Lot 17 (DEV-09 à DEV-11) : apparence et textes des devis, factures et
  // avoirs, copiés dans l'instantané vendeur à l'émission (ADR 0046).
  // Couleur #RRGGBB (null : gris ardoise de départ).
  documentColor: text("document_color"),
  documentFont: documentFontEnum("document_font").notNull().default("modern"),
  iban: text("iban"),
  bic: text("bic"),
  quoteIntro: text("quote_intro"),
  quoteTerms: text("quote_terms"),
  invoiceIntro: text("invoice_intro"),
  documentFooter: text("document_footer"),
  // Lot 31a (JUR-08, décision D5) : acompte ou arrhes proposé pour chaque nouveau devis ;
  // lot 31b (réponse 2 de l'avocat, D17) : « acompte » par défaut.
  advanceKindDefault: advanceKindEnum("advance_kind_default").default("deposit"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
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
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("catalog_items_organization_idx").on(table.organizationId)]);

export const quoteStatusEnum = quotesSchema.enum("quote_status", ["draft", "sent", "signed", "declined", "expired"]);

// DEV-04 : un client professionnel exige une facture Factur-X (lot dédié,
// décision 1 du lot 4) ; le choix est enregistré dès maintenant.
// Lot 31b (réponse 3 de l'avocat, décision D16) : consommateur, non-professionnel (association,
// SCI…) ou professionnel.
export const clientKindEnum = quotesSchema.enum("client_kind", ["individual", "professional", "non_professional"]);

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
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
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
    // Lot 31a (JUR-08, décision D5) : acompte ou arrhes, imposé avant l'envoi s'il y a un échéancier.
    advanceKind: advanceKindEnum("advance_kind"),
    // Lot 31a (FAC-01, décision D2) : choix des options, daté et nominatif (le client sur
    // son portail, ou la planner pour lui) ; figé dès que la signature commence.
    optionsChosenAt: timestamp("options_chosen_at", { withTimezone: true }),
    optionsChosenBy: text("options_chosen_by"),
    optionsChosenByKind: text("options_chosen_by_kind"),
    // Lot 31a (HUB-21, décision D3) : modèle d'origine et sa version.
    templateId: uuid("template_id").references((): AnyPgColumn => quoteTemplates.id, { onDelete: "set null" }),
    templateVersion: integer("template_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_versions_organization_idx").on(table.organizationId),
    unique().on(table.quoteId, table.version),
    check(
      "quote_versions_options_chosen_check",
      sql`(${table.optionsChosenAt} is null and ${table.optionsChosenBy} is null and ${table.optionsChosenByKind} is null) or (${table.optionsChosenAt} is not null and ${table.optionsChosenBy} is not null and ${table.optionsChosenByKind} is not null and char_length(${table.optionsChosenBy}) between 1 and 200 and ${table.optionsChosenByKind} in ('client', 'planner'))`,
    ),
  ],
);

// Lot 31a (FAC-01, décision D2) — sections titrées d'une version de devis, ordonnées ;
// chacune a son sous-total.
export const quoteSections = quotesSchema.table(
  "quote_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quoteVersions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_sections_organization_idx").on(table.organizationId),
    index("quote_sections_version_idx").on(table.versionId),
    check("quote_sections_title_check", sql`char_length(${table.title}) between 1 and 120`),
  ],
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
  // Lot 31a (FAC-01, décision D2) : section de la ligne (ou aucune) ; une option reste hors
  // du total tant qu'elle n'est pas choisie.
  sectionId: uuid("section_id").references(() => quoteSections.id, { onDelete: "set null" }),
  isOption: boolean("is_option").notNull().default(false),
  optionChosen: boolean("option_chosen").notNull().default(false),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("quote_lines_organization_idx").on(table.organizationId)]);

// Lot 31a (FAC-01, HUB-21, décision D3) — modèles de devis par type d'événement (null : pour
// tous) : sections, lignes, options, échéancier type. « Nouveau devis depuis un modèle »
// copie le tout ; modifier le modèle ensuite ne change aucun devis. La version augmente à
// chaque remplacement du contenu ; le devis garde celle dont il vient.
export const quoteTemplates = quotesSchema.table(
  "quote_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    // Type d'événement du module events (uuid opaque, ADR 0011).
    eventTypeId: uuid("event_type_id"),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    globalDiscountKind: globalDiscountKindEnum("global_discount_kind").notNull().default("none"),
    globalDiscountValue: integer("global_discount_value").notNull().default(0),
    advanceKind: advanceKindEnum("advance_kind"),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_templates_organization_idx").on(table.organizationId),
    check("quote_templates_name_check", sql`char_length(${table.name}) between 1 and 120`),
    check("quote_templates_version_check", sql`${table.version} >= 1`),
  ],
);

export const quoteTemplateSections = quotesSchema.table(
  "quote_template_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => quoteTemplates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_template_sections_organization_idx").on(table.organizationId),
    check("quote_template_sections_title_check", sql`char_length(${table.title}) between 1 and 120`),
  ],
);

export const quoteTemplateLines = quotesSchema.table(
  "quote_template_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => quoteTemplates.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => quoteTemplateSections.id, { onDelete: "set null" }),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    description: text("description"),
    unit: text("unit").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
    discountBasisPoints: integer("discount_basis_points").notNull().default(0),
    isOption: boolean("is_option").notNull().default(false),
    position: integer("position").notNull().default(0),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [index("quote_template_lines_organization_idx").on(table.organizationId)],
);

// Échéancier type : « à la signature » ou « N jours avant l'événement ».
export const quoteTemplateScheduleItems = quotesSchema.table(
  "quote_template_schedule_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => quoteTemplates.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amountCents: integer("amount_cents"),
    percentageBasisPoints: integer("percentage_basis_points"),
    dueRule: text("due_rule").notNull(),
    daysBeforeEvent: integer("days_before_event"),
    position: integer("position").notNull().default(0),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_template_schedule_items_organization_idx").on(table.organizationId),
    check("quote_template_schedule_items_amount_xor_percentage", sql`(${table.amountCents} is null) <> (${table.percentageBasisPoints} is null)`),
    check(
      "quote_template_schedule_items_due_check",
      sql`(${table.dueRule} = 'at_signature' and ${table.daysBeforeEvent} is null) or (${table.dueRule} = 'before_event' and ${table.daysBeforeEvent} between 0 and 1095)`,
    ),
  ],
);

// Lot 31b (FAC-04, DOC-02, JUR-07, JUR-08 ; décisions D7, D11, D12, D21) — rôle légal d'une
// clause : ce que le régime de conclusion exige dans le contrat (liste de l'avocat, réponse 1),
// et la clause des sommes versées d'avance, qui doit concorder avec le devis (réponse 2).
export const CONTRACT_CLAUSE_ROLES = [
  "precontractual_information",
  "withdrawal_period",
  "withdrawal_form",
  "early_execution",
  "termination",
  "no_withdrawal",
  "advance_deposit",
  "advance_earnest",
] as const;
export const contractClauseRoleEnum = quotesSchema.enum("contract_clause_role", CONTRACT_CLAUSE_ROLES);

// Canal de conclusion (réponse 1 de l'avocat, D11) : dans l'établissement du planner, à
// distance, hors établissement, foire ou salon. Avec la catégorie du client, il fixe le régime.
export const CONCLUSION_CHANNELS = ["on_premises", "distance", "off_premises", "fair"] as const;
export const conclusionChannelEnum = quotesSchema.enum("conclusion_channel", CONCLUSION_CHANNELS);

// Lot 31b (FAC-04, HUB-21, décision D7) — modèle de contrat par type d'événement : un titre et
// des clauses ordonnées à variables. Versionné : chaque modification augmente la version ; un
// contrat déjà généré garde son texte figé.
export const contractTemplates = quotesSchema.table(
  "contract_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventTypeId: uuid("event_type_id"),
    name: text("name").notNull(),
    title: text("title").notNull(),
    version: integer("version").notNull().default(1),
    // Réponse 6 de l'avocat (D11, partie N) : date de la dernière revue juridique, saisie par la
    // planner ; copiée dans chaque contrat.
    legalReviewedOn: date("legal_reviewed_on"),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contract_templates_organization_idx").on(table.organizationId),
    check("contract_templates_name_check", sql`char_length(${table.name}) between 1 and 120`),
    check("contract_templates_title_check", sql`char_length(${table.title}) between 1 and 200`),
    check("contract_templates_version_check", sql`${table.version} >= 1`),
  ],
);

// Clause d'un modèle : titre, texte à variables entre accolades, obligatoire ou facultative
// (cochée à la génération), et son rôle légal éventuel.
export const contractTemplateClauses = quotesSchema.table(
  "contract_template_clauses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => contractTemplates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    optional: boolean("optional").notNull().default(false),
    role: contractClauseRoleEnum("role"),
    position: integer("position").notNull().default(0),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contract_template_clauses_organization_idx").on(table.organizationId),
    index("contract_template_clauses_template_idx").on(table.templateId),
    check("contract_template_clauses_title_check", sql`char_length(${table.title}) between 1 and 200`),
    check("contract_template_clauses_body_check", sql`char_length(${table.body}) <= 20000`),
  ],
);

// Lot 31b (FAC-04, DOC-02, JUR-07 ; D7, D11) — contrat généré depuis un modèle pour une version
// envoyée d'un devis : texte figé (clauses retenues, variables résolues), version et date de revue
// du modèle, canal de conclusion, catégorie du client et régime de rétractation qui en découle,
// niveau de signature. Une modification crée une nouvelle version.
export type ContractClauseSnapshot = { title: string; body: string; role: (typeof CONTRACT_CLAUSE_ROLES)[number] | null };

export const contracts = quotesSchema.table(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id),
    quoteVersionId: uuid("quote_version_id")
      .notNull()
      .references(() => quoteVersions.id),
    version: integer("version").notNull(),
    templateId: uuid("template_id").references(() => contractTemplates.id, { onDelete: "set null" }),
    templateVersion: integer("template_version").notNull(),
    templateReviewedOn: date("template_reviewed_on"),
    title: text("title").notNull(),
    clauses: jsonb("clauses").$type<ContractClauseSnapshot[]>().notNull(),
    conclusionChannel: conclusionChannelEnum("conclusion_channel").notNull(),
    clientCategory: clientKindEnum("client_category").notNull(),
    // Hors établissement : petite entreprise de cinq salariés au plus, contrat hors de son
    // activité principale (confirmé par la planner) ; elle a alors droit à la rétractation.
    smallBusinessConfirmed: boolean("small_business_confirmed").notNull().default(false),
    withdrawalApplies: boolean("withdrawal_applies").notNull(),
    // Réponse 5 de l'avocat (D15) : niveau employé, inscrit au dossier de preuve.
    signatureLevel: text("signature_level").notNull().default("simple"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contracts_organization_idx").on(table.organizationId),
    unique().on(table.quoteId, table.version),
    check("contracts_version_check", sql`${table.version} >= 1`),
    check("contracts_title_check", sql`char_length(${table.title}) between 1 and 200`),
    check("contracts_signature_level_check", sql`${table.signatureLevel} in ('simple', 'advanced', 'qualified')`),
    check("contracts_channel_check", sql`${table.conclusionChannel} <> 'fair'`),
  ],
);

// Réponse 6 de l'avocat (D11, partie N) — avertissement « base à adapter » accepté à la première
// génération avec chaque version d'un modèle : qui, quelle version, quand.
export const contractTemplateAcceptances = quotesSchema.table(
  "contract_template_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => contractTemplates.id, { onDelete: "cascade" }),
    templateVersion: integer("template_version").notNull(),
    userId: uuid("user_id").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [index("contract_template_acceptances_organization_idx").on(table.organizationId), unique().on(table.templateId, table.templateVersion, table.userId)],
);

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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("payment_methods_organization_idx").on(table.organizationId)]);

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
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [index("payment_schedule_items_organization_idx").on(table.organizationId), 
    check(
      "payment_schedule_items_amount_xor_percentage",
      sql`(${table.amountCents} is null) <> (${table.percentageBasisPoints} is null)`,
    ),
  ],
);

// DEV-02 — demande de signature d'une version envoyée (une seule par
// version pour le devis ; lot 31b : une de plus pour un contrat signé seul). Le fournisseur (ADR 0006/0021) est derrière une interface ;
// external_id est l'identifiant de la soumission chez lui. Les documents
// signés et le certificat de preuve sont archivés en stockage privé.
export const signatureRequestStatusEnum = quotesSchema.enum("signature_request_status", ["pending", "completed", "declined"]);

// Lot 31b (DOC-03, décision D9) : ce que la demande fait signer — le devis seul, le devis suivi
// de son contrat (un PDF, un dossier de preuve), ou le contrat seul (généré après la signature
// du devis).
export const signatureRequestKindEnum = quotesSchema.enum("signature_request_kind", ["quote", "quote_contract", "contract"]);

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
    // Lot 31b (DOC-03, décision D9) : devis, devis et contrat, ou contrat seul.
    kind: signatureRequestKindEnum("kind").notNull().default("quote"),
    contractId: uuid("contract_id").references(() => contracts.id),
    signedDocumentKey: text("signed_document_key"),
    auditCertificateKey: text("audit_certificate_key"),
    // Lot 23b (DOC-08, ADR 0061) : empreinte SHA-256 de chaque fichier à son
    // archivage ; le fichier relu doit avoir la même. Effacées avec les fichiers
    // à la fin de leur conservation (RGPD).
    signedDocumentSha256: text("signed_document_sha256"),
    auditCertificateSha256: text("audit_certificate_sha256"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("signature_requests_organization_idx").on(table.organizationId),
    // Une seule demande qui fait signer le devis par version ; un contrat ne se signe qu'une fois.
    uniqueIndex("signature_requests_quote_version_unique").on(table.versionId).where(sql`kind <> 'contract'`),
    uniqueIndex("signature_requests_contract_unique").on(table.contractId).where(sql`contract_id is not null`),
    unique().on(table.provider, table.externalId),
    check("signature_requests_kind_check", sql`(${table.kind} = 'quote') = (${table.contractId} is null)`),
  ],
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
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("quote_signers_organization_idx").on(table.organizationId)]);

// Lot 31b (JUR-07 ; réponse 1 de l'avocat, D13) — actes d'un signataire sur son portail, avant
// de signer : la commande avec obligation de paiement (contrat à distance) et la demande
// d'exécution avant la fin du délai de rétractation (case distincte de la signature). Horodatés
// et nominatifs (copie du nom et du texte présenté), versés au dossier de preuve.
export const SIGNER_ACT_KINDS = ["order", "early_execution"] as const;

export const contractSignerActs = quotesSchema.table(
  "contract_signer_acts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    signerId: uuid("signer_id")
      .notNull()
      .references(() => quoteSigners.id),
    kind: text("kind", { enum: SIGNER_ACT_KINDS }).notNull(),
    signerName: text("signer_name").notNull(),
    presentedText: text("presented_text").notNull(),
    actedAt: timestamp("acted_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contract_signer_acts_organization_idx").on(table.organizationId),
    unique().on(table.contractId, table.signerId, table.kind),
    check("contract_signer_acts_kind_check", sql`${table.kind} in ('order', 'early_execution')`),
    check("contract_signer_acts_name_check", sql`char_length(${table.signerName}) between 1 and 200`),
    check("contract_signer_acts_text_check", sql`char_length(${table.presentedText}) between 1 and 20000`),
  ],
);

// Lot 31b (réponses 1 et 5 de l'avocat, partie N) — dossier de preuve de Symbola, écrit quand
// tous ont signé : faits figés (canal, catégorie, régime, versions, actes des signataires, niveau
// de signature, empreintes du document signé et du certificat) en JSON, stocké en privé avec son
// empreinte, relu et vérifié à chaque téléchargement.
export const contractEvidence = quotesSchema.table(
  "contract_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => signatureRequests.id),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    documentKey: text("document_key").notNull(),
    sha256: text("sha256").notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("contract_evidence_organization_idx").on(table.organizationId),
    unique().on(table.requestId),
    check("contract_evidence_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

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
}, (table) => [index("signature_webhook_log_organization_idx").on(table.organizationId)]);

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
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
  },
  (table) => [unique().on(table.organizationId, table.number)],
);

// Lot 31b (FAC-05, décision D6) — facture d'acompte de la première échéance, émise d'elle-même
// quand tous ont signé : le jour même, ou le lendemain de la fin du délai de rétractation s'il
// court sans renonciation. Une mention manquante la bloque (« blocked », champs nommés) ; la
// planner l'émet alors en un clic. « issued » garde la facture émise.
export const SCHEDULED_DEPOSIT_STATUSES = ["waiting", "blocked", "issued"] as const;

export const scheduledDepositInvoices = quotesSchema.table(
  "scheduled_deposit_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quoteVersions.id),
    scheduleItemId: uuid("schedule_item_id")
      .notNull()
      .references(() => paymentScheduleItems.id),
    // Jour (Paris) à partir duquel la facture s'émet.
    issueOn: date("issue_on").notNull(),
    // Hors établissement (réponse 1 de l'avocat) : aucun paiement demandé avant la signature
    // plus sept jours.
    paymentNotBefore: date("payment_not_before"),
    status: text("status", { enum: SCHEDULED_DEPOSIT_STATUSES }).notNull().default("waiting"),
    missingFields: text("missing_fields").array().notNull().default(sql`'{}'::text[]`),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("scheduled_deposit_invoices_organization_idx").on(table.organizationId),
    unique().on(table.versionId),
    check("scheduled_deposit_invoices_status_check", sql`${table.status} in ('waiting', 'blocked', 'issued')`),
    check("scheduled_deposit_invoices_issued_check", sql`(${table.status} = 'issued') = (${table.invoiceId} is not null)`),
  ],
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
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
  },
  (table) => [unique().on(table.organizationId, table.number)],
);

// Lot 23b (FAC-14, JUR-05, décision D2, ADR 0061) — encaissements en
// écritures, en ajout seul. Saisir un encaissement crée une écriture
// « received » ; l'annuler crée une écriture « reversal » liée à la première,
// avec un motif obligatoire : rien ne s'efface. Le montant est figé à la saisie.
// Les colonnes paid_on et payment_method_id de l'échéance en restent la copie
// de lecture rapide, mise à jour dans la même transaction.
export const PAYMENT_ENTRY_KINDS = ["received", "reversal"] as const;

export const paymentEntries = quotesSchema.table(
  "payment_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    scheduleItemId: uuid("schedule_item_id")
      .notNull()
      .references(() => paymentScheduleItems.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PAYMENT_ENTRY_KINDS }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    paidOn: date("paid_on"),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
    paymentMethodLabel: text("payment_method_label"),
    reversesEntryId: uuid("reverses_entry_id")
      .unique()
      .references((): AnyPgColumn => paymentEntries.id),
    reason: text("reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
  },
  (table) => [index("payment_entries_organization_idx").on(table.organizationId), 
    check("payment_entries_kind_check", sql`${table.kind} in ('received', 'reversal')`),
    check(
      "payment_entries_received_check",
      sql`${table.kind} <> 'received' or (${table.paidOn} is not null and ${table.reversesEntryId} is null)`,
    ),
    check(
      "payment_entries_reversal_check",
      sql`${table.kind} <> 'reversal' or (${table.reversesEntryId} is not null and length(trim(${table.reason})) > 0)`,
    ),
  ],
);

// Lot 23b (DOC-08, ADR 0061) — original d'une facture ou d'un avoir émis : le
// PDF rendu à l'émission, déposé tel quel dans le stockage privé, avec son
// empreinte. En ajout seul ; jamais recompressé ni reconstruit, sauf une
// facture émise avant le lot 23b, rendue une fois à sa première ouverture et
// marquée « reconstitué » (décision D6). Pas d'original pour une pièce d'essai.
export const ORIGINAL_DOCUMENT_KINDS = ["invoice", "credit_note"] as const;

export const originalDocuments = quotesSchema.table(
  "original_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentKind: text("document_kind", { enum: ORIGINAL_DOCUMENT_KINDS }).notNull(),
    documentId: uuid("document_id").notNull(),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    byteSize: integer("byte_size").notNull(),
    isReconstructed: boolean("is_reconstructed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
  },
  (table) => [index("original_documents_organization_idx").on(table.organizationId), 
    unique().on(table.documentKind, table.documentId),
    check("original_documents_kind_check", sql`${table.documentKind} in ('invoice', 'credit_note')`),
    check("original_documents_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

// Lot 23b (FAC-14, ADR 0061) — chaîne d'empreintes, une par organisation :
// factures, avoirs, originaux, encaissements et écritures inverses, dans
// l'ordre de leur enregistrement. Rang, empreinte précédente et empreinte sont
// calculés par la base (déclencheur quotes.chain_ledger_entry) : l'app ne peut
// ni choisir le rang ni fournir une empreinte. Le contenu (payload) ne porte
// aucune donnée personnelle : les copies figées et le motif y sont réduits à
// leur empreinte. En ajout seul ; les pièces d'essai n'y entrent pas.
export const LEDGER_ENTRY_KINDS = ["invoice", "credit_note", "original", "payment", "payment_reversal"] as const;

export const ledgerEntries = quotesSchema.table(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    entryKind: text("entry_kind", { enum: LEDGER_ENTRY_KINDS }).notNull(),
    objectId: uuid("object_id").notNull(),
    payload: jsonb("payload").notNull(),
    previousHash: text("previous_hash").notNull(),
    hash: text("hash").notNull(),
    // Reprise des pièces émises avant le lot 23b (décision D6).
    isBackfill: boolean("is_backfill").notNull().default(false),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    createdBy: uuid("created_by"),
  },
  (table) => [
    unique().on(table.organizationId, table.sequence),
    unique().on(table.entryKind, table.objectId),
    check(
      "ledger_entries_kind_check",
      sql`${table.entryKind} in ('invoice', 'credit_note', 'original', 'payment', 'payment_reversal')`,
    ),
  ],
);

