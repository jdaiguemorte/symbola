-- SOC-06 — droits du rôle applicatif sur les tables d'infrastructure
-- domain_events (outbox) et domain_event_consumers (idempotence). Pas de
-- RLS ici, comme pour hub (SOC-04) : voir packages/db/src/schema/core.ts.
GRANT USAGE ON SCHEMA "core" TO symbola_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "core"."domain_events", "core"."domain_event_consumers"
TO symbola_app;
