-- Lot 9 — mot de passe oublié : table d'identité (pas de RLS, isolation par
-- packages/auth, ADR 0013), comme hub.sessions et hub.invitations.
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."password_resets" TO symbola_app;
