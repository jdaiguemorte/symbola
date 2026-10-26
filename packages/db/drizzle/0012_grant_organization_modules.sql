-- HUB-03 — droits du rôle applicatif sur organization_modules (même
-- raisonnement que 0003/0010 : pas de RLS ici, table d'administration).
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."organization_modules" TO symbola_app;
