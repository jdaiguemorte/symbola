-- Lot 33a (SEC-01, ADR 0052 et 0067) : Symbola ne garde plus aucun mot de passe ni secret de
-- double authentification ; le fournisseur d'identité authentifie. Retirés : mots de passe,
-- secrets et compteurs de double authentification, verrouillage, jetons de réinitialisation et
-- appareils de confiance ; l'organisation et le rôle du compte (portés par hub.memberships ou
-- operator depuis 0129). Un compte existant se relie au fournisseur à sa première connexion, par
-- son adresse vérifiée (aucun compte bloqué dehors).
ALTER TABLE "hub"."password_resets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hub"."trusted_devices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "hub"."password_resets" CASCADE;--> statement-breakpoint
DROP TABLE "hub"."trusted_devices" CASCADE;--> statement-breakpoint
ALTER TABLE "hub"."users" DROP CONSTRAINT "users_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "hub"."users_organization_idx";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "totp_secret";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "mfa_enabled";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "mfa_failed_attempts";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "mfa_locked_until";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "totp_last_used_step";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "failed_login_attempts";--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "locked_until";--> statement-breakpoint
DROP TYPE "hub"."role";