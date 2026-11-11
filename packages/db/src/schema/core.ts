// Infrastructure transverse, pas un module métier (SOC-06, ADR 0014) : la
// table domain_events (motif outbox) et le suivi d'idempotence des
// consommateurs. Pas de RLS ici, comme pour hub (SOC-04) : le worker doit
// pouvoir lire les événements de toutes les organisations pour les
// distribuer ; organization_id reste présent sur chaque événement pour un
// filtrage applicatif futur, pas pour une policy RLS.
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

// Compteurs d'usage (SOC-13, ADR 0017) : collecte brute pour la future
// brique empreinte carbone (module carbon, V2). Pas de calcul ici,
// seulement des compteurs agrégés par organisation et par jour — aucune
// donnée personnelle, pas de contrat privacy/v1 nécessaire.
export const usageCounters = coreSchema.table(
  "usage_counters",
  {
    organizationId: uuid("organization_id").notNull(),
    date: date("date").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    responseBytes: bigint("response_bytes", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.date] })],
);

// Lot 16 (L16-SEC-02, ADR 0044) : limitation de débit à fenêtre glissante, une
// ligne par tentative (connexion, double authentification, mot de passe
// oublié, recherche, envoi de fichier). La clé (adresse IP, e-mail ou compte)
// n'est gardée que sous forme d'empreinte SHA-256, 24 heures au plus. Pas de
// RLS : la limite s'applique avant toute connexion, hors de toute
// organisation.
export const rateLimitEvents = coreSchema.table(
  "rate_limit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bucket: text("bucket").notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("rate_limit_events_lookup_idx").on(table.bucket, table.keyHash, table.createdAt)],
);

// Lot 23 (ARC-16, SEC-19, ADR 0060) : journal d'audit commun, en ajout seul.
// Le rôle applicatif n'y a que SELECT, INSERT et DELETE ; un trigger refuse
// toute modification et toute suppression, sauf celle d'une ligne d'essai
// guidé (is_demo), purgée avec l'essai. RLS forcée : une organisation ne lit
// que ses lignes, plus les accès d'exploitation de la plateforme
// (organization_id vide). Aucune donnée personnelle : des identifiants, des
// numéros de pièce, des codes (SEC-20).
export const AUDIT_ACTOR_KINDS = ["member", "admin", "operator", "system"] as const;
export const AUDIT_CATEGORIES = [
  "connexion",
  "droits",
  "export",
  "partage",
  "emission",
  "encaissement",
  "suppression",
  "exploitation",
  "administration",
] as const;

export const auditEntries = coreSchema.table(
  "audit_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id"),
    // clock_timestamp() et non now() : l'instant réel de chaque ligne, même
    // pour plusieurs gestes d'une même transaction (now() est l'heure de son
    // début), pour que le journal garde leur ordre.
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    // Par défaut, l'auteur fixé par withOrganization (lot 23, partie B) :
    // un déclencheur ou une fonction SQL qui écrit au journal n'a rien à
    // passer. Sans auteur déclaré : « system ».
    actorKind: text("actor_kind", { enum: AUDIT_ACTOR_KINDS })
      .notNull()
      .default(sql`coalesce(nullif(current_setting('app.actor_kind', true), ''), 'system')`),
    actorId: uuid("actor_id").default(sql`nullif(current_setting('app.actor_id', true), '')::uuid`),
    action: text("action").notNull(),
    category: text("category", { enum: AUDIT_CATEGORIES }).notNull(),
    objectType: text("object_type"),
    objectId: uuid("object_id"),
    details: jsonb("details").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    reason: text("reason"),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (table) => [
    index("audit_entries_organization_time_idx").on(table.organizationId, table.occurredAt),
    check("audit_entries_actor_kind_check", sql`${table.actorKind} in ('member', 'admin', 'operator', 'system')`),
    check(
      "audit_entries_category_check",
      sql`${table.category} in ('connexion', 'droits', 'export', 'partage', 'emission', 'encaissement', 'suppression', 'exploitation', 'administration')`,
    ),
    check("audit_entries_operations_reason_check", sql`${table.category} <> 'exploitation' or length(trim(${table.reason})) > 0`),
  ],
);
