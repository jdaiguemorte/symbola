-- SOC-13 — droits du rôle applicatif sur la table de compteurs d'usage
-- (ADR 0016). Pas de RLS (même décision que domain_events) : aucune
-- donnée personnelle, agrégée par organisation.
GRANT SELECT, INSERT, UPDATE, DELETE ON "core"."usage_counters" TO symbola_app;
