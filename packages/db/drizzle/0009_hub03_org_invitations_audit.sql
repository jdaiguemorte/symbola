CREATE TYPE "hub"."language" AS ENUM('fr', 'en');--> statement-breakpoint
CREATE TABLE "hub"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "language" "hub"."language" DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "siret" text;--> statement-breakpoint
ALTER TABLE "hub"."audit_log" ADD CONSTRAINT "audit_log_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "hub"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."audit_log" ADD CONSTRAINT "audit_log_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;