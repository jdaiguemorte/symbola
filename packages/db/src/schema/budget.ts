// Schéma du module budget (Lot 3, PRD-BUD-01). Tables métier : chaque table a
// organization_id (CLAUDE.md §2.4), protégée par Row-Level Security
// activée par une migration dédiée (même patron que hello/events).
//
// Frontière de module (ADR 0011, voir docs/lots/lot-3-budget.md) :
// default_vendor_slot_id référence un poste du module events, mais jamais
// par une clé étrangère PostgreSQL — une FK inter-schéma serait un
// couplage direct aux données internes d'un autre module. C'est un uuid
// opaque, validé à la couche service via
// eventsService.listDefaultVendorSlots(organizationId).
import { boolean, check, date, integer, pgSchema, text, timestamp, unique, uniqueIndex, uuid, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const budgetSchema = pgSchema("budget");

// PRD-BUD-01 — modèles de répartition par organisation, un pourcentage par
// poste. percentageBasisPoints : 0 à 10000 = 0,00 % à 100,00 %, jamais de
// float (CLAUDE.md §5).
export const allocationModels = budgetSchema.table("allocation_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("allocation_models_organization_idx").on(table.organizationId)]);

export const allocationModelItems = budgetSchema.table("allocation_model_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => allocationModels.id),
  defaultVendorSlotId: uuid("default_vendor_slot_id").notNull(),
  percentageBasisPoints: integer("percentage_basis_points").notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("allocation_model_items_organization_idx").on(table.organizationId)]);

// PRD-BUD-01 — simulation liée à un prospect : un seul event_budgets par
// événement (eventId opaque, module events).
export const eventBudgets = budgetSchema.table("event_budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull().unique(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  guestCount: integer("guest_count").notNull(),
  allocationModelId: uuid("allocation_model_id").references(() => allocationModels.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("event_budgets_organization_idx").on(table.organizationId)]);

export const eventBudgetItems = budgetSchema.table("event_budget_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventBudgetId: uuid("event_budget_id")
    .notNull()
    .references(() => eventBudgets.id),
  defaultVendorSlotId: uuid("default_vendor_slot_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [index("event_budget_items_organization_idx").on(table.organizationId)]);

// PRD-BUD-02 — budget réel. Lot 28b (BUD-01, décision Q33) : le poste de
// l'événement est la catégorie ; il porte plusieurs lignes, chacune avec son
// libellé et, si elle en a un, son prestataire rattaché. eventVendorSlotId et
// vendorCandidateId référencent le module events par des uuid opaques,
// jamais par une FK inter-schéma.
export const budgetLines = budgetSchema.table("budget_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  eventId: uuid("event_id").notNull(),
  eventVendorSlotId: uuid("event_vendor_slot_id").notNull(),
  label: text("label").notNull(),
  vendorCandidateId: uuid("vendor_candidate_id"),
  position: integer("position").notNull().default(0),
  // Lot 12 (L12-EVT-17) : prévu facultatif — la ligne existe dès qu'un montant
  // (prévu ou réel) est connu, sans répartition préalable.
  // Lot 28a (BUD-01, décision D2, ADR 0054) : cinq montants. Le reste à payer
  // (engagé moins payé) se calcule, il ne se stocke pas.
  estimatedAmountCents: integer("estimated_amount_cents"),
  quotedAmountCents: integer("quoted_amount_cents"),
  committedAmountCents: integer("committed_amount_cents"),
  paidAmountCents: integer("paid_amount_cents"),
  // Lot 28c (BUD-09, D5) : taux de TVA de la ligne, en points de base (2000 =
  // 20 %) ; vide, le taux de départ des modèles (ADR 0007). Montants saisis TTC.
  vatRateBasisPoints: integer("vat_rate_basis_points"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, (table) => [
  index("budget_lines_organization_idx").on(table.organizationId),
  index("budget_lines_event_vendor_slot_idx").on(table.eventVendorSlotId),
  check("budget_lines_vat_rate_check", sql`${table.vatRateBasisPoints} between 0 and 10000`),
]);

export const budgetLineFieldEnum = budgetSchema.enum("budget_line_field", ["estimated", "quoted", "committed", "paid"]);

// PRD-BUD-02 : « chaque modification est historisée : ancienne valeur,
// nouvelle valeur, auteur, date. »
export const budgetLineHistory = budgetSchema.table("budget_line_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  lineId: uuid("line_id")
    .notNull()
    .references(() => budgetLines.id),
  field: budgetLineFieldEnum("field").notNull(),
  oldValueCents: integer("old_value_cents"),
  // Lot 47 (PAR-05, D6 ; ADR 0085) : nulle quand un engagé est libéré (le prestataire n'est plus retenu).
  newValueCents: integer("new_value_cents"),
  // Toujours renseigné : l'auteur direct pour un ajustement à la main, ou
  // bookedByUserId (payload events.vendor_slot.booked) pour une mise à
  // jour automatique.
  changedByUserId: uuid("changed_by_user_id").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
}, (table) => [index("budget_line_history_organization_idx").on(table.organizationId)]);

// Lot 28b (BUD-04) : nature d'un document joint à une ligne.
export const BUDGET_DOCUMENT_KINDS = ["quote", "contract", "invoice"] as const;
export const budgetDocumentKindEnum = budgetSchema.enum("budget_document_kind", BUDGET_DOCUMENT_KINDS);

// PRD-BUD-03 — document d'un prestataire joint à une ligne de budget. Le
// fichier vit dans le stockage privé (@symbola/files : type vérifié par le
// contenu, antivirus, jamais d'URL publique) ; seule sa clé est stockée ici.
export const budgetLineAttachments = budgetSchema.table("budget_line_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  lineId: uuid("line_id")
    .notNull()
    .references(() => budgetLines.id),
  kind: budgetDocumentKindEnum("kind").notNull().default("quote"),
  fileKey: text("file_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Lot 23 (DAT-06) : auteur et dates de la ligne (core.stamp_row).
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"),
}, (table) => [index("budget_line_attachments_organization_idx").on(table.organizationId)]);

// Lot 28a (BUD-02, décision D4) — seuil d'alerte, en pourcentage de l'enveloppe
// du client : celui de l'organisation (event_id nul, 90 % sans ligne), ajustable
// par événement. Une donnée de réglage, jamais une constante du code.
export const alertThresholds = budgetSchema.table(
  "alert_thresholds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id"),
    percent: integer("percent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("alert_thresholds_organization_idx").on(table.organizationId),
    unique("alert_thresholds_organization_event_unique").on(table.organizationId, table.eventId).nullsNotDistinct(),
    check("alert_thresholds_percent_check", sql`${table.percent} between 1 and 500`),
  ],
);

// Lot 28b (BUD-03, décisions D7, D12 et D13) — échéance d'un paiement à un
// prestataire, rattachée à une ligne : montant fixe, ou pourcentage de
// l'engagé du prestataire (de la ligne sans prestataire), recalculé quand
// l'engagé change. Le payé de la ligne est la somme de ses échéances payées.
export const vendorPayments = budgetSchema.table(
  "vendor_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id").notNull(),
    lineId: uuid("line_id")
      .notNull()
      .references(() => budgetLines.id),
    label: text("label").notNull(),
    fixedAmountCents: integer("fixed_amount_cents"),
    percentageBasisPoints: integer("percentage_basis_points"),
    dueOn: date("due_on").notNull(),
    paidOn: date("paid_on"),
    // Lot 27a (SC-06, décision D6) : règlement déclaré par un client depuis son
    // lien (date, moyen, lien déclarant), en attente de la confirmation de la
    // planner ; un refus garde son motif, montré au client.
    declaredPaidOn: date("declared_paid_on"),
    declaredMethod: text("declared_method"),
    declaredByLinkId: uuid("declared_by_link_id"),
    declaredAt: timestamp("declared_at", { withTimezone: true }),
    refusalReason: text("refusal_reason"),
    refusedAt: timestamp("refused_at", { withTimezone: true }),
    // Lot 51 (JRJ-09 ; D8, ADR 0091) : échéance « à remettre le jour J » (chèque, espèces,
    // enveloppe), avec son moyen et la personne qui remet ; la remise se pointe dans le mode Jour J
    // (qui, quand, photo du reçu facultative) et règle l'échéance. Une remise reçue deux fois (même
    // action) n'en fait qu'une.
    handoverOnDay: boolean("handover_on_day").notNull().default(false),
    handoverMethod: text("handover_method"),
    handoverBy: text("handover_by"),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    handedOverBy: uuid("handed_over_by"),
    handoverActionId: uuid("handover_action_id"),
    handoverReceiptPhotoId: uuid("handover_receipt_photo_id"),
    // Lot 43 (BUD-06, D8) : payeur désigné de l'échéance (null : les mariés).
    payerId: uuid("payer_id").references((): AnyPgColumn => eventPayers.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
    // Lot 39a (DAT-03, ADR 0073) : suppression logique, cachée par la base (RLS).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("vendor_payments_organization_idx").on(table.organizationId),
    index("vendor_payments_line_idx").on(table.lineId),
    uniqueIndex("vendor_payments_handover_action_idx").on(table.organizationId, table.handoverActionId),
    check(
      "vendor_payments_handover_check",
      sql`(${table.handoverMethod} is null or char_length(${table.handoverMethod}) between 1 and 80) and (${table.handoverBy} is null or char_length(${table.handoverBy}) between 1 and 120) and ((${table.handedOverAt} is null and ${table.handedOverBy} is null and ${table.handoverActionId} is null) or (${table.handedOverAt} is not null and ${table.handedOverBy} is not null))`,
    ),
    check(
      "vendor_payments_amount_check",
      sql`(${table.fixedAmountCents} is not null and ${table.fixedAmountCents} > 0 and ${table.percentageBasisPoints} is null) or (${table.fixedAmountCents} is null and ${table.percentageBasisPoints} between 1 and 10000)`,
    ),
    check(
      "vendor_payments_declaration_check",
      sql`(${table.declaredPaidOn} is null and ${table.declaredMethod} is null and ${table.declaredByLinkId} is null and ${table.declaredAt} is null) or (${table.declaredPaidOn} is not null and ${table.declaredMethod} is not null and ${table.declaredByLinkId} is not null and ${table.declaredAt} is not null)`,
    ),
  ],
);

// Lot 43 (BUD-06, BUD-11 ; D8, D9 ; ADR 0089) — les payeurs d'un évènement : les mariés, la famille
// de l'un, celle de l'autre, une entreprise, ou un autre. Tirés d'un lien personnel du client
// (link_id, uuid opaque du module events) ou ajoutés sans lien. « Sa part seule » (oui par défaut) :
// le client décide si ce payeur ne voit que sa part ou tout le budget ; contrôlé côté serveur.
export const EVENT_PAYER_KINDS = ["couple", "family_one", "family_two", "company", "other"] as const;

export const eventPayers = budgetSchema.table(
  "event_payers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: EVENT_PAYER_KINDS }).notNull(),
    linkId: uuid("link_id"),
    ownShareOnly: boolean("own_share_only").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("event_payers_organization_idx").on(table.organizationId),
    index("event_payers_event_idx").on(table.eventId),
    unique("event_payers_event_link_unique").on(table.eventId, table.linkId),
    check("event_payers_name_check", sql`char_length(trim(${table.name})) between 1 and 120`),
    check("event_payers_kind_check", sql`${table.kind} in ('couple', 'family_one', 'family_two', 'company', 'other')`),
  ],
);

// Lot 43 (BUD-06, D8) — part d'un payeur sur une ligne du budget : un pourcentage ou un montant. Ce
// qui n'est attribué à personne revient aux mariés (par défaut : 100 % aux mariés).
export const budgetLinePayerShares = budgetSchema.table(
  "budget_line_payer_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    lineId: uuid("line_id")
      .notNull()
      .references(() => budgetLines.id, { onDelete: "cascade" }),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => eventPayers.id, { onDelete: "cascade" }),
    percentageBasisPoints: integer("percentage_basis_points"),
    amountCents: integer("amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("budget_line_payer_shares_organization_idx").on(table.organizationId),
    unique("budget_line_payer_shares_line_payer_unique").on(table.lineId, table.payerId),
    check(
      "budget_line_payer_shares_value_check",
      sql`(${table.percentageBasisPoints} between 1 and 10000 and ${table.amountCents} is null) or (${table.percentageBasisPoints} is null and ${table.amountCents} > 0)`,
    ),
  ],
);

// Lot 43 (BUD-06, BUD-11 ; D8) — payeur désigné d'une échéance de la planner (échéancier d'un devis,
// module quotes : uuid opaque, ADR 0011). Sans ligne : les mariés.
export const plannerInstalmentPayers = budgetSchema.table(
  "planner_instalment_payers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    eventId: uuid("event_id").notNull(),
    scheduleItemId: uuid("schedule_item_id").notNull(),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => eventPayers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("planner_instalment_payers_organization_idx").on(table.organizationId),
    unique("planner_instalment_payers_schedule_item_unique").on(table.scheduleItemId),
  ],
);
