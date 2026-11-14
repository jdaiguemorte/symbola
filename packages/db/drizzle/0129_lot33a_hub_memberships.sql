-- Lot 33a (HUB-02, HUB-03, SEC-01, Q30, ADR 0067, décision D6) : un compte peut appartenir à
-- plusieurs organisations (hub.memberships, rôle par adhésion) ; la session porte l'organisation
-- active ; le compte connaît son identifiant chez le fournisseur d'identité (idp_subject) ; le
-- compte d'exploitation est marqué (operator). Mot de passe et rôle du compte deviennent
-- facultatifs ; ils seront retirés par la migration de retrait, après la reprise des comptes.
CREATE TYPE "hub"."membership_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "hub"."memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "hub"."membership_role" NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "memberships_user_organization_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "hub"."users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."users" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."sessions" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "idp_subject" text;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "operator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_organization_idx" ON "hub"."memberships" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "hub"."sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_organization_idx" ON "hub"."sessions" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "hub"."users" ADD CONSTRAINT "users_idp_subject_unique" UNIQUE("idp_subject");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."memberships" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "memberships_stamp" BEFORE INSERT OR UPDATE ON "hub"."memberships"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "memberships_journal_deletion" BEFORE DELETE ON "hub"."memberships"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
-- Reprise : chaque compte d'organisation garde son organisation et son rôle, et son retrait
-- d'accès (lot 24b) devient celui de l'adhésion. L'Admin devient le compte d'exploitation.
INSERT INTO "hub"."memberships" ("user_id", "organization_id", "role", "disabled_at", "created_at", "updated_at")
  SELECT "id", "organization_id", "role"::text::"hub"."membership_role", "disabled_at", "created_at", "created_at"
  FROM "hub"."users"
  WHERE "organization_id" IS NOT NULL AND "role" IN ('owner', 'member');
--> statement-breakpoint
UPDATE "hub"."users" SET "operator" = true WHERE "role" = 'admin';
--> statement-breakpoint
UPDATE "hub"."sessions" AS "s" SET "organization_id" = "u"."organization_id"
  FROM "hub"."users" AS "u" WHERE "u"."id" = "s"."user_id" AND "u"."organization_id" IS NOT NULL;
