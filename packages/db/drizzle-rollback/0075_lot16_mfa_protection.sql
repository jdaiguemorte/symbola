-- Annulation de 0075 (lot 16, SEC-01, ADR 0037) : compteur d'échecs, verrouillage
-- et anti-rejeu de la double authentification. Avant de revenir à une image
-- antérieure au lot 16, remettre d'abord les secrets en clair
-- (`pnpm --filter @symbola/auth mfa-secrets -- --unseal`, runbook de
-- déploiement) : cette annulation ne touche pas à totp_secret.
ALTER TABLE "hub"."users" DROP COLUMN "mfa_failed_attempts";
ALTER TABLE "hub"."users" DROP COLUMN "mfa_locked_until";
ALTER TABLE "hub"."users" DROP COLUMN "totp_last_used_step";
