-- ONB-01/02 — droits du rôle applicatif (même raisonnement que les
-- migrations de droits précédentes : pas de RLS, tables d'identité/
-- administration).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "hub"."organization_profiles", "hub"."vat_regime_changes", "hub"."platform_settings"
TO symbola_app;
