// Schéma du module budget (Lot 3, BUD-01). Tables métier : chaque table a
// organization_id (CLAUDE.md §2.4), protégée par Row-Level Security
// activée par une migration dédiée (même patron que hello/events).
//
// Frontière de module (ADR 0011, voir docs/lots/lot-3-budget.md) :
// default_vendor_slot_id référence un poste du module events, mais jamais
// par une clé étrangère PostgreSQL — une FK inter-schéma serait un
// couplage direct aux données internes d'un autre module. C'est un uuid
// opaque, validé à la couche service via
// eventsService.listDefaultVendorSlots(organizationId).
import { integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const budgetSchema = pgSchema("budget");

// BUD-01 — modèles de répartition par organisation, un pourcentage par
// poste. percentageBasisPoints : 0 à 10000 = 0,00 % à 100,00 %, jamais de
// float (CLAUDE.md §5).
export const allocationModels = budgetSchema.table("allocation_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const allocationModelItems = budgetSchema.table("allocation_model_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => allocationModels.id),
  defaultVendorSlotId: uuid("default_vendor_slot_id").notNull(),
  percentageBasisPoints: integer("percentage_basis_points").notNull(),
});

// BUD-01 — simulation liée à un prospect : un seul event_budgets par
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
});

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
});
