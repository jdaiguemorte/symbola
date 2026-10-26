-- HUB-03 — droits du rôle applicatif sur les nouvelles tables (même
-- raisonnement que 0003_grant_hub_tables.sql : pas de RLS ici, tables
-- d'identité/administration, isolation assurée par le code applicatif).
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."invitations", "hub"."audit_log" TO symbola_app;
