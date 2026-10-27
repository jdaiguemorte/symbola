-- AIDE-01 — droits du rôle applicatif (même raisonnement que les
-- migrations de droits précédentes : pas de RLS, table d'identité).
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."user_tour_seen" TO symbola_app;
