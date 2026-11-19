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

// Lot 31c (D18) : taux des pénalités de retard proposés (packages/starter-templates/late-penalty.json).
export const LATE_PENALTY_RATES = ["ecb_plus_10", "three_times_legal"] as const;

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
  // Lot 48 (DAT-08 ; D5, ADR 0093) : IBAN et BIC de la planner chiffrés au niveau du champ
  // (field-box, ADR 0079), par la migration 0176 et son étape de données (annulable) ; les
  // colonnes en clair iban et bic restent vides, gardées pour l'annulation (et pour le nom des champs
  // de l'export, qui livre la valeur déchiffrée).
  iban: text("iban"),
  bic: text("bic"),
  ibanSealed: text("iban_sealed"),
  bicSealed: text("bic_sealed"),
  quoteIntro: text("quote_intro"),
  quoteTerms: text("quote_terms"),
  invoiceIntro: text("invoice_intro"),
  documentFooter: text("document_footer"),
  // Lot 31a (JUR-08, décision D5) : acompte ou arrhes proposé pour chaque nouveau devis ;
  // lot 31b (réponse 2 de l'avocat, D17) : « acompte » par défaut.
  advanceKindDefault: advanceKindEnum("advance_kind_default").default("deposit"),
  // Lot 31c (réponse 1 de l'expert-comptable, D18) : conditions de paiement face à un
  // professionnel (invoice_mentions reste celui des particuliers et des non-professionnels), et
  // taux des pénalités de retard choisi par la planner, sans valeur par défaut.
  invoiceMentionsProfessional: text("invoice_mentions_professional"),
  latePenaltyRate: text("late_penalty_rate", { enum: LATE_PENALTY_RATES }),
  // Lot 31c (D21) : préfixe de la série des reçus d'arrhes.
  receiptPrefix: text("receipt_prefix").notNull().default("R"),
  // Lot 41 (JUR-12, D11, réponse 7 de l'avocat) : délai de paiement d'un professionnel (30 jours par
  // défaut), compté après l'émission ou « fin de mois », dans les bornes de
  // packages/starter-templates/professional-terms.json ; escompte pour paiement anticipé (null : le
  // texte de départ, « Néant »).
  professionalPaymentTermDays: integer("professional_payment_term_days").notNull().default(30),
  professionalPaymentTermEndOfMonth: boolean("professional_payment_term_end_of_month").notNull().default(false),
  professionalDiscountTerms: text("professional_discount_terms"),
  // Lot 43 (FAC-15, FAC-09 ; D1, D7) : relance avant l'expiration d'un devis (jours avant), relances
  // d'une échéance impayée (jours après), et taux de la clause de pénalités prévue au contrat d'un
  // particulier (points de base). null : les valeurs de départ (payment-reminders.json) ; pour le
  // taux, aucune pénalité (D7, sous réserve de l'avocat, AV-7).
  expiryReminderDays: integer("expiry_reminder_days"),
  paymentReminderDays: integer("payment_reminder_days").array(),
  consumerLatePenaltyBasisPoints: integer("consumer_late_penalty_basis_points"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  check("quote_settings_late_penalty_rate_check", sql`${table.latePenaltyRate} is null or ${table.latePenaltyRate} in ('ecb_plus_10', 'three_times_legal')`),
  check("quote_settings_professional_payment_term_check", sql`${table.professionalPaymentTermDays} between 0 and 120`),
  check("quote_settings_professional_discount_terms_check", sql`${table.professionalDiscountTerms} is null or char_length(${table.professionalDiscountTerms}) <= 500`),
  check("quote_settings_expiry_reminder_days_check", sql`${table.expiryReminderDays} is null or ${table.expiryReminderDays} between 1 and 30`),
  check(
    "quote_settings_payment_reminder_days_check",
    sql`${table.paymentReminderDays} is null or (cardinality(${table.paymentReminderDays}) between 1 and 5 and 1 <= all(${table.paymentReminderDays}) and 120 >= all(${table.paymentReminderDays}))`,
  ),
  check("quote_settings_consumer_late_penalty_check", sql`${table.consumerLatePenaltyBasisPoints} is null or ${table.consumerLatePenaltyBasisPoints} between 1 and 10000`),
  check(
    "quote_settings_sealed_bank_check",
    sql`(${table.ibanSealed} is null or (${table.ibanSealed} like 'f1:%' and ${table.iban} is null)) and (${table.bicSealed} is null or (${table.bicSealed} like 'f1:%' and ${table.bic} is null))`,
  ),
]);

// Lot 41 (JUR-02, D9, réponse 7 de l'expert-comptable) : nature d'une ligne (catalogue, modèle,
// devis) ; la facture en déduit la catégorie de l'opération.
export const LINE_NATURES = ["service", "goods"] as const;
// Lot 48b (JUR-10, D7) : mode d'une ligne du devis et nature touristique.
export const SUPPLY_MODES = ["resale", "intermediary"] as const;
export const CONTRACT_TEMPLATE_KINDS = ["contract", "mandate", "general_terms", "package_travel"] as const;
export const TOURISM_KINDS = ["transport", "lodging", "other"] as const;

// Lot 31c (D21) : « receipt », la série à part des reçus d'arrhes (non fiscaux).
export const numberSeriesKindEnum = quotesSchema.enum("number_series_kind", ["quote", "invoice", "credit_note", "receipt"]);

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
  // Lot 41 (JUR-02, D9).
  nature: text("nature", { enum: LINE_NATURES }).notNull().default("service"),
  // Lot 5 (IMP-04/IMP-05) : colonnes d'un fichier importé gardées en champ
  // libre (intitulé → texte), affichées en lecture seule sur la fiche.
  importedFields: jsonb("imported_fields").$type<Record<string, string> | null>(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("catalog_items_organization_idx").on(table.organizationId),
  check("catalog_items_nature_check", sql`${table.nature} in ('service', 'goods')`),
]);

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
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
    // Lot 41 (JUR-02, JUR-13 ; D6, D8) : acheteur entreprise (contact « entreprise » du hub, uuid
    // opaque, ADR 0069), numéro de bon de commande du client et référence de l'acheteur, modifiables
    // jusqu'à chaque émission ; adresse de livraison si elle diffère (ligne, code postal, ville, pays).
    buyerContactId: uuid("buyer_contact_id"),
    clientOrderReference: text("client_order_reference"),
    buyerReference: text("buyer_reference"),
    deliveryAddress: jsonb("delivery_address").$type<{ line: string; postalCode: string; city: string; countryCode: string } | null>(),
  },
  (table) => [
    unique().on(table.organizationId, table.number),
    check("quotes_client_order_reference_check", sql`${table.clientOrderReference} is null or char_length(${table.clientOrderReference}) between 1 and 60`),
    check("quotes_buyer_reference_check", sql`${table.buyerReference} is null or char_length(${table.buyerReference}) between 1 and 60`),
  ],
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
    // Lot 43 (FAC-02, FAC-15 ; D1, D2) : mot d'accueil de la page de proposition (repris du modèle
    // de proposition, modifiable tant que la version est un brouillon, figé à l'envoi), modèle et
    // version d'origine ; date de la relance avant expiration (une seule fois). La date
    // d'expiration est valid_until, figée à l'envoi (ADR 0089).
    proposalGreeting: text("proposal_greeting"),
    proposalTemplateId: uuid("proposal_template_id").references((): AnyPgColumn => proposalTemplates.id, { onDelete: "set null" }),
    proposalTemplateVersion: integer("proposal_template_version"),
    expiryRemindedAt: timestamp("expiry_reminded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_versions_organization_idx").on(table.organizationId),
    unique().on(table.quoteId, table.version),
    check("quote_versions_proposal_greeting_check", sql`${table.proposalGreeting} is null or char_length(${table.proposalGreeting}) between 1 and 4000`),
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
  // Lot 41 (JUR-02, D9).
  nature: text("nature", { enum: LINE_NATURES }).notNull().default("service"),
  // Lot 48b (JUR-10 ; réponse 4 de l'avocat, ADR 0093) : « revendeur » (la planner achète et refacture :
  // dans son total et sa TVA) ou « intermédiaire » (le prestataire facture le client : montrée pour
  // information, hors du total) ; nature touristique pour la détection du forfait touristique (D7).
  supplyMode: text("supply_mode", { enum: SUPPLY_MODES }).notNull().default("resale"),
  tourismKind: text("tourism_kind", { enum: TOURISM_KINDS }),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("quote_lines_organization_idx").on(table.organizationId),
  check("quote_lines_nature_check", sql`${table.nature} in ('service', 'goods')`),
  check("quote_lines_supply_mode_check", sql`${table.supplyMode} in ('resale', 'intermediary')`),
  check("quote_lines_tourism_kind_check", sql`${table.tourismKind} is null or ${table.tourismKind} in ('transport', 'lodging', 'other')`),
]);

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
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
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
    // Lot 41 (JUR-02, D9).
    nature: text("nature", { enum: LINE_NATURES }).notNull().default("service"),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("quote_template_lines_organization_idx").on(table.organizationId),
    check("quote_template_lines_nature_check", sql`${table.nature} in ('service', 'goods')`),
  ],
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
    // Lot 48b (JUR-10, DOC-02, HUB-26 ; D7) : contrat, mandat (mode intermédiaire), conditions
    // générales, ou modèle dédié au forfait touristique (seul permis quand le devis en réunit un).
    kind: text("kind", { enum: CONTRACT_TEMPLATE_KINDS }).notNull().default("contract"),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("contract_templates_organization_idx").on(table.organizationId),
    check("contract_templates_kind_check", sql`${table.kind} in ('contract', 'mandate', 'general_terms', 'package_travel')`),
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
    // Lot 37b (DOC-12, D13) : tailles des deux fichiers, pour le relevé de stockage ; lues une fois
    // au stockage pour une signature d'avant le lot.
    signedDocumentSizeBytes: integer("signed_document_size_bytes"),
    auditCertificateSizeBytes: integer("audit_certificate_size_bytes"),
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
  // Lot 36a (CRM-03, D5, ADR 0069) : le contact du hub (uuid opaque) ; nom, e-mail et adresse de
  // facturation restent une copie figée (preuve de signature, DAT-04).
  contactId: uuid("contact_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  billingAddress: text("billing_address").notNull(),
  // Lien personnel de signature chez le fournisseur (secret : ne s'affiche
  // qu'à la planner et au marié concerné).
  signingUrl: text("signing_url").notNull(),
  externalId: text("external_id"),
  status: quoteSignerStatusEnum("status").notNull().default("pending"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  // Lot 43 (SEC-16, D4) : code à usage unique vérifié par ce signataire, depuis son lien, avant que son
  // lien de signature ne s'affiche sur son portail (valable trente minutes).
  signingCodeVerifiedAt: timestamp("signing_code_verified_at", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("quote_signers_organization_idx").on(table.organizationId), index("quote_signers_contact_idx").on(table.contactId)]);

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
    // Lot 37b (DOC-12, D13) : taille du dossier de preuve ; lue une fois au stockage avant le lot.
    sizeBytes: integer("size_bytes"),
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
    // Lot 48b (PRE-07, D8) : vides pour une facture de commission au prestataire (commission_id).
    quoteId: uuid("quote_id").references(() => quotes.id),
    versionId: uuid("version_id").references(() => quoteVersions.id),
    scheduleItemId: uuid("schedule_item_id").references(() => paymentScheduleItems.id),
    // Lot 48b (PRE-07 ; D8, réponse 9 de l'expert-comptable) : facture de la commission adressée au
    // prestataire, même série et mêmes règles que les autres factures (numérotation, chaîne des
    // pièces, Factur-X).
    commissionId: uuid("commission_id").references((): AnyPgColumn => vendorCommissions.id),
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
    // Lot 41 (FAC-10, JUR-02, JUR-12, JUR-13) : copie de la réforme (format Factur-X, catégorie,
    // débits, bon de commande, livraison, conditions d'un professionnel). null : facture émise avant le
    // lot 41 (PDF simple). Seule l'adresse de livraison s'anonymise à la fin de la conservation.
    reformSnapshot: jsonb("reform_snapshot"),
  },
  (table) => [
    unique().on(table.organizationId, table.number),
    uniqueIndex("invoices_commission_idx").on(table.commissionId),
    check(
      "invoices_subject_check",
      sql`(${table.quoteId} is null) = (${table.versionId} is null) and (${table.quoteId} is null) = (${table.commissionId} is not null) and (${table.commissionId} is null or (${table.kind} = 'balance' and ${table.scheduleItemId} is null))`,
    ),
  ],
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
    // Lot 41 (FAC-10) : copie de la réforme, reprise de la facture (null avant le lot 41).
    reformSnapshot: jsonb("reform_snapshot"),
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

// Lot 31c (JUR-08, réponse 7 bis de l'expert-comptable, décision D21) — reçu d'arrhes : les arrhes
// sont une indemnité de dédit, hors TVA et hors facturation tant qu'elles ne sont pas imputées sur
// le prix. À leur encaissement, un reçu non fiscal, de sa propre série, reprend le vendeur, les
// clients, la date et le montant reçus. Immuable comme une facture (même déclencheur : seul un
// reçu d'essai se supprime ; seule la copie des clients s'anonymise à la fin de la conservation).
// Un encaissement annulé laisse le reçu, marqué annulé à l'affichage.
export const earnestReceipts = quotesSchema.table(
  "earnest_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id),
    scheduleItemId: uuid("schedule_item_id")
      .notNull()
      .references(() => paymentScheduleItems.id),
    paymentEntryId: uuid("payment_entry_id")
      .notNull()
      .unique()
      .references(() => paymentEntries.id),
    number: text("number").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    issuedOn: date("issued_on").notNull(),
    paidOn: date("paid_on").notNull(),
    amountCents: integer("amount_cents").notNull(),
    label: text("label").notNull(),
    paymentMethodLabel: text("payment_method_label"),
    sellerSnapshot: jsonb("seller_snapshot").notNull(),
    buyerSnapshot: jsonb("buyer_snapshot").notNull(),
    // Lot 23 (DAT-06) : auteur de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
  },
  (table) => [index("earnest_receipts_organization_idx").on(table.organizationId), unique().on(table.organizationId, table.number)],
);

// Lot 23b (DOC-08, ADR 0061) — original d'une facture ou d'un avoir émis : le
// PDF rendu à l'émission, déposé tel quel dans le stockage privé, avec son
// empreinte. En ajout seul ; jamais recompressé ni reconstruit, sauf une
// facture émise avant le lot 23b, rendue une fois à sa première ouverture et
// marquée « reconstitué » (décision D6). Pas d'original pour une pièce d'essai.
export const ORIGINAL_DOCUMENT_KINDS = ["invoice", "credit_note"] as const;
export const ORIGINAL_DOCUMENT_FORMATS = ["pdf", "facturx"] as const;

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
    // Lot 41 (FAC-10, D1) : « facturx » pour une pièce émise à partir du lot 41 (PDF/A-3 qui porte son
    // fichier structuré), « pdf » avant.
    format: text("format", { enum: ORIGINAL_DOCUMENT_FORMATS }).notNull().default("pdf"),
  },
  (table) => [index("original_documents_organization_idx").on(table.organizationId), 
    check("original_documents_format_check", sql`${table.format} in ('pdf', 'facturx')`),
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


// Lot 43 (FAC-02, HUB-21 ; D2, ADR 0089) — modèle de la page de proposition, par type d'évènement
// (null : pour tous ; un seul par type) : mot d'accueil, ordre des blocs, jusqu'à trois photos
// (stockage privé, servies par l'app après contrôle du lien). Le devis reste le cœur de la page.
// Données de départ : packages/starter-templates/src/proposal-templates.json.
export const PROPOSAL_BLOCKS = ["greeting", "organization", "photos", "quote", "schedule", "validity"] as const;
export type ProposalPhoto = { key: string; mime: string; sizeBytes: number };

export const proposalTemplates = quotesSchema.table(
  "proposal_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventTypeId: uuid("event_type_id"),
    greeting: text("greeting").notNull(),
    blocks: text("blocks").array().notNull(),
    photos: jsonb("photos").$type<ProposalPhoto[]>().notNull().default(sql`'[]'::jsonb`),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("proposal_templates_organization_idx").on(table.organizationId),
    unique("proposal_templates_organization_event_type_unique").on(table.organizationId, table.eventTypeId).nullsNotDistinct(),
    check("proposal_templates_greeting_check", sql`char_length(${table.greeting}) between 1 and 4000`),
    check(
      "proposal_templates_blocks_check",
      sql`cardinality(${table.blocks}) between 1 and 6 and ${table.blocks} <@ array['greeting', 'organization', 'photos', 'quote', 'schedule', 'validity']::text[] and 'quote' = any(${table.blocks})`,
    ),
    check("proposal_templates_photos_check", sql`jsonb_typeof(${table.photos}) = 'array' and jsonb_array_length(${table.photos}) <= 3`),
    check("proposal_templates_version_check", sql`${table.version} >= 1`),
  ],
);

// Lot 43 (FAC-08 Divergent, GC-01, FAC-09 ; D5, ADR 0087, ADR 0089) — règlement d'une échéance par
// virement au RIB : référence unique dans l'organisation (« SYM-<année>-<numéro court> », sans
// donnée personnelle, elle passe par les banques), déclaration du payeur (date, lien, nom copié),
// suspension des relances par la planner (motif), RIB envoyé au 8e jour hors établissement. La
// planner confirme l'encaissement par le rapprochement existant (payment_entries) : aucun
// rapprochement automatique.
export const paymentReferences = quotesSchema.table(
  "payment_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    scheduleItemId: uuid("schedule_item_id")
      .notNull()
      .unique()
      .references(() => paymentScheduleItems.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    declaredAt: timestamp("declared_at", { withTimezone: true }),
    declaredPaidOn: date("declared_paid_on"),
    declaredByLinkId: uuid("declared_by_link_id"),
    declaredByName: text("declared_by_name"),
    remindersSuspendedAt: timestamp("reminders_suspended_at", { withTimezone: true }),
    remindersSuspensionReason: text("reminders_suspension_reason"),
    remindersSuspendedBy: uuid("reminders_suspended_by"),
    detailsMailedAt: timestamp("details_mailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("payment_references_organization_idx").on(table.organizationId),
    unique("payment_references_organization_reference_unique").on(table.organizationId, table.reference),
    check("payment_references_reference_check", sql`${table.reference} ~ '^SYM-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{6}$'`),
    check(
      "payment_references_declaration_check",
      sql`(${table.declaredAt} is null and ${table.declaredPaidOn} is null and ${table.declaredByLinkId} is null and ${table.declaredByName} is null) or (${table.declaredAt} is not null and ${table.declaredPaidOn} is not null and ${table.declaredByLinkId} is not null and char_length(${table.declaredByName}) between 1 and 200)`,
    ),
    check(
      "payment_references_suspension_check",
      sql`(${table.remindersSuspendedAt} is null and ${table.remindersSuspensionReason} is null) or (${table.remindersSuspendedAt} is not null and char_length(trim(${table.remindersSuspensionReason})) between 1 and 500)`,
    ),
  ],
);

// Lot 43 (FAC-09 ; D7) — relances d'une échéance impayée : une ligne par rang (J+3, J+10, J+20…),
// écrite juste avant l'envoi, après avoir revérifié que l'échéance n'est ni réglée, ni déclarée, ni
// suspendue. L'unicité (échéance, rang) garantit une seule relance par rang, même rejouée.
export const paymentReminders = quotesSchema.table(
  "payment_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    scheduleItemId: uuid("schedule_item_id")
      .notNull()
      .references(() => paymentScheduleItems.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    // Jour (Paris) où la relance était prévue ; envoyée le (instant réel).
    dueOn: date("due_on").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("payment_reminders_organization_idx").on(table.organizationId),
    unique("payment_reminders_item_rank_unique").on(table.scheduleItemId, table.rank),
    check("payment_reminders_rank_check", sql`${table.rank} between 1 and 5`),
  ],
);

// Lot 48b (BUD-08 ; D6, ADR 0093) — honoraires de la planner pour un évènement : forfait, pourcentage
// du budget (estimé ou engagé, lu au module Budget), ou les deux. Ils vont sur son devis ; dans le
// budget du client, une ligne à part, jamais dans les dépenses de l'évènement.
export const PLANNER_FEE_KINDS = ["flat", "percent", "mixed"] as const;
export const PLANNER_FEE_BASES = ["estimated", "committed"] as const;
export const plannerFees = quotesSchema.table(
  "planner_fees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    // Évènement du module events (uuid opaque, ADR 0011).
    eventId: uuid("event_id").notNull(),
    kind: text("kind", { enum: PLANNER_FEE_KINDS }).notNull(),
    flatCents: integer("flat_cents"),
    percentBasisPoints: integer("percent_basis_points"),
    base: text("base", { enum: PLANNER_FEE_BASES }).notNull().default("estimated"),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull().default(2000),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("planner_fees_organization_idx").on(table.organizationId),
    uniqueIndex("planner_fees_event_idx").on(table.organizationId, table.eventId),
    check(
      "planner_fees_terms_check",
      sql`${table.kind} in ('flat', 'percent', 'mixed') and ${table.base} in ('estimated', 'committed') and (${table.flatCents} is null or ${table.flatCents} > 0) and (${table.percentBasisPoints} is null or ${table.percentBasisPoints} between 1 and 10000) and ((${table.kind} = 'flat') = (${table.percentBasisPoints} is null)) and ((${table.kind} = 'percent') = (${table.flatCents} is null))`,
    ),
    check("planner_fees_vat_rate_check", sql`${table.vatRateBasisPoints} between 0 and 10000`),
  ],
);

// Lot 48b (PRE-07, JUR-10 ; D6, D8) — commissions et apports d'affaires reçus d'un prestataire pour un
// évènement : montant ou pourcentage d'une base, statut (attendue, facturée, reçue). Affichées d'office
// à un client particulier (réponse 4 de l'avocat) ; au choix pour un professionnel.
export const COMMISSION_NATURES = ["commission", "referral"] as const;
export const COMMISSION_STATUSES = ["expected", "invoiced", "received"] as const;
export const vendorCommissions = quotesSchema.table(
  "vendor_commissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id").notNull(),
    // Fiche du carnet (module vendors, uuid opaque) et son nom copié (la facture le fige).
    vendorId: uuid("vendor_id"),
    vendorName: text("vendor_name").notNull(),
    nature: text("nature", { enum: COMMISSION_NATURES }).notNull().default("commission"),
    amountCents: integer("amount_cents"),
    percentBasisPoints: integer("percent_basis_points"),
    baseCents: integer("base_cents"),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull().default(2000),
    status: text("status", { enum: COMMISSION_STATUSES }).notNull().default("expected"),
    receivedOn: date("received_on"),
    shownToClient: boolean("shown_to_client").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("vendor_commissions_organization_idx").on(table.organizationId),
    index("vendor_commissions_event_idx").on(table.eventId),
    check("vendor_commissions_name_check", sql`char_length(${table.vendorName}) between 1 and 200`),
    check(
      "vendor_commissions_amount_check",
      sql`(${table.amountCents} is not null and ${table.amountCents} > 0 and ${table.percentBasisPoints} is null and ${table.baseCents} is null) or (${table.amountCents} is null and ${table.percentBasisPoints} between 1 and 10000 and ${table.baseCents} is not null and ${table.baseCents} > 0)`,
    ),
    check("vendor_commissions_status_check", sql`${table.nature} in ('commission', 'referral') and ${table.status} in ('expected', 'invoiced', 'received') and ((${table.status} = 'received') = (${table.receivedOn} is not null))`),
    check("vendor_commissions_vat_rate_check", sql`${table.vatRateBasisPoints} between 0 and 10000`),
  ],
);

// Lot 35b (HUB-13, décision D7 de Julien du 18/11/2026, ADR 0098) — ancrage de la chaîne des pièces
// d'une organisation qui a repris un export Symbola : la chaîne reprise, vérifiée à la reprise, se
// termine sur cette empreinte, et la chaîne de l'organisation la prolonge (sa première écriture
// pointe sur elle au lieu de 64 zéros). Une ligne par organisation, posée une fois, jamais modifiée.
export const ledgerAnchors = quotesSchema.table(
  "ledger_anchors",
  {
    organizationId: uuid("organization_id").primaryKey(),
    previousHash: text("previous_hash").notNull(),
    // Chaîne d'origine : son organisation, son dernier rang et son nombre d'écritures.
    sourceOrganizationId: uuid("source_organization_id").notNull(),
    sourceLastSequence: bigint("source_last_sequence", { mode: "number" }).notNull(),
    sourceEntries: integer("source_entries").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    check("ledger_anchors_previous_hash_check", sql`${table.previousHash} ~ '^[0-9a-f]{64}$'`),
    check("ledger_anchors_source_check", sql`${table.sourceEntries} >= 0 and ${table.sourceLastSequence} >= 0`),
  ],
);

// Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097) — réglages des exports comptables, un par organisation : mois
// de début de l'exercice et plan de comptes (comptes et codes des journaux), qui remplacent ceux des
// données de départ (accounting-exports.json, à relire par l'expert-comptable : EC-9). La famille
// d'export se déduit de la forme juridique du profil et se choisit à chaque export (D1).
export type AccountingAccountsOverride = Partial<Record<"sales" | "vatCollected" | "clients" | "bank" | "clientAdvances", { number: string; label: string }>>;
export type AccountingJournalsOverride = Partial<Record<"sales" | "bank", { code: string; label: string }>>;
export const accountingExportSettings = quotesSchema.table(
  "accounting_export_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
    accounts: jsonb("accounts").$type<AccountingAccountsOverride>().notNull().default(sql`'{}'::jsonb`),
    journals: jsonb("journals").$type<AccountingJournalsOverride>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("accounting_export_settings_organization_idx").on(table.organizationId),
    check("accounting_export_settings_month_check", sql`${table.fiscalYearStartMonth} between 1 and 12`),
    check("accounting_export_settings_json_check", sql`jsonb_typeof(${table.accounts}) = 'object' and jsonb_typeof(${table.journals}) = 'object'`),
  ],
);

// Lot 58 (FAC-11 ; D3 ; ADR 0097) — chaque export comptable demandé, en ajout seul : période, format,
// totaux rapprochés et contrôle (« done », ou « blocked » avec les écarts expliqués). Aucune donnée
// personnelle : des numéros de pièces et des montants. Une copie va au journal d'audit.
export const ACCOUNTING_EXPORT_FORMATS = ["receipts_journal", "sales_journal", "payments_journal", "fec", "originals"] as const;
export const ACCOUNTING_PERIOD_KINDS = ["month", "quarter", "year", "fiscal_year"] as const;
export const ACCOUNTING_EXPORT_STATUSES = ["done", "blocked"] as const;
export const accountingExports = quotesSchema.table(
  "accounting_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    format: text("format", { enum: ACCOUNTING_EXPORT_FORMATS }).notNull(),
    periodKind: text("period_kind", { enum: ACCOUNTING_PERIOD_KINDS }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: text("status", { enum: ACCOUNTING_EXPORT_STATUSES }).notNull(),
    invoicedCents: bigint("invoiced_cents", { mode: "number" }).notNull(),
    creditedCents: bigint("credited_cents", { mode: "number" }).notNull(),
    receivedCents: bigint("received_cents", { mode: "number" }).notNull(),
    documentCount: integer("document_count").notNull(),
    issues: jsonb("issues").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Lot 23 (DAT-06) : auteur de la ligne (core.stamp_row).
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("accounting_exports_organization_idx").on(table.organizationId),
    check("accounting_exports_format_check", sql`${table.format} in ('receipts_journal', 'sales_journal', 'payments_journal', 'fec', 'originals')`),
    check("accounting_exports_period_check", sql`${table.periodKind} in ('month', 'quarter', 'year', 'fiscal_year') and ${table.periodStart} <= ${table.periodEnd}`),
    check("accounting_exports_status_check", sql`${table.status} in ('done', 'blocked') and jsonb_typeof(${table.issues}) = 'array'`),
  ],
);
