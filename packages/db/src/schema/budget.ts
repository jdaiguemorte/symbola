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
import { check, date, integer, pgSchema, text, timestamp, unique, uuid, index } from "drizzle-orm/pg-core";
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
  newValueCents: integer("new_value_cents").notNull(),
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
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("vendor_payments_organization_idx").on(table.organizationId),
    index("vendor_payments_line_idx").on(table.lineId),
    check(
      "vendor_payments_amount_check",
      sql`(${table.fixedAmountCents} is not null and ${table.fixedAmountCents} > 0 and ${table.percentageBasisPoints} is null) or (${table.fixedAmountCents} is null and ${table.percentageBasisPoints} between 1 and 10000)`,
    ),
  ],
);
