// Schéma du module hello (SOC-05) : une table de démonstration dans son
// propre schéma PostgreSQL, protégée par Row-Level Security (ADR 0012).
// Chaque module futur (events, budget, quotes…) suit le même patron : un
// schema() dédié, organization_id sur chaque table, policy RLS appliquée
// par une migration custom (packages/db/drizzle).
import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const helloSchema = pgSchema("hello");

export const greetings = helloSchema.table("greetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
