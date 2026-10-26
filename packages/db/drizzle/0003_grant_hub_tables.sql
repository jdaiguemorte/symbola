-- SOC-04 — droits du rôle applicatif sur les tables d'identité. Pas de RLS
-- ici (voir packages/db/src/schema/hub.ts) : l'isolation entre
-- organisations pour ces tables est assurée exclusivement par
-- packages/auth, seule porte d'entrée (ADR 0013).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "hub"."organizations", "hub"."users", "hub"."sessions"
TO symbola_app;
