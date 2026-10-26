// Infrastructure transverse, pas un module métier (SOC-06, ADR 0014) : la
// table domain_events (motif outbox) et le suivi d'idempotence des
// consommateurs. Pas de RLS ici, comme pour hub (SOC-04) : le worker doit
// pouvoir lire les événements de toutes les organisations pour les
// distribuer ; organization_id reste présent sur chaque événement pour un
// filtrage applicatif futur, pas pour une policy RLS.
import { integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const coreSchema = pgSchema("core");

export const domainEvents = coreSchema.table("domain_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  version: integer("version").notNull(),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

export const domainEventConsumers = coreSchema.table(
  "domain_event_consumers",
  {
    consumerName: text("consumer_name").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => domainEvents.id),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.consumerName, table.eventId] })],
);
