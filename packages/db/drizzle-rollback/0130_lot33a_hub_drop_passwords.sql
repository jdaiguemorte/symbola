-- Annulation de 0130 (lot 33a) : les colonnes et tables reviennent, vides. Les mots de passe, les
-- secrets de double authentification et les jetons ne reviennent pas (SEC-01) : l'annulation de
-- 0129 reste refusée tant qu'un compte n'a pas de mot de passe. L'organisation et le rôle du
-- compte sont repris des adhésions (la plus ancienne) et du marqueur d'exploitation.
CREATE TYPE "hub"."role" AS ENUM('owner', 'member', 'admin');
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "organization_id" uuid;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "password_hash" text;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "role" "hub"."role";
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "totp_secret" text;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "mfa_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "mfa_failed_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "mfa_locked_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "totp_last_used_step" bigint;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "locked_until" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "users_organization_idx" ON "hub"."users" USING btree ("organization_id");
--> statement-breakpoint
UPDATE "hub"."users" AS "u" SET "organization_id" = "m"."organization_id", "role" = "m"."role"::text::"hub"."role"
  FROM (SELECT DISTINCT ON ("user_id") "user_id", "organization_id", "role" FROM "hub"."memberships" ORDER BY "user_id", "created_at") AS "m"
  WHERE "m"."user_id" = "u"."id";
--> statement-breakpoint
UPDATE "hub"."users" SET "role" = 'admin' WHERE "operator";
--> statement-breakpoint
CREATE TABLE "hub"."password_resets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "hub"."users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub"."trusted_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "hub"."users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."password_resets" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."trusted_devices" TO symbola_app;
