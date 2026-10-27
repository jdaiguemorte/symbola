CREATE TYPE "hub"."legal_form" AS ENUM('ei', 'eirl', 'eurl', 'sarl', 'sas', 'sasu', 'sa', 'auto_entrepreneur', 'autre');--> statement-breakpoint
CREATE TYPE "hub"."metier" AS ENUM('wedding_planner', 'autre');--> statement-breakpoint
CREATE TYPE "hub"."vat_regime" AS ENUM('franchise', 'assujetti');--> statement-breakpoint
CREATE TABLE "hub"."organization_profiles" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"siren" text,
	"address" text,
	"logo_key" text,
	"legal_form" "hub"."legal_form",
	"metier" "hub"."metier",
	"metier_precision" text,
	"vat_regime" "hub"."vat_regime",
	"vat_rate_default_basis_points" integer,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub"."platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"franchise_threshold_services_cents" integer,
	"franchise_threshold_goods_cents" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub"."vat_regime_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"previous_regime" "hub"."vat_regime",
	"new_regime" "hub"."vat_regime" NOT NULL,
	"effective_date" date NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."vat_regime_changes" ADD CONSTRAINT "vat_regime_changes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."vat_regime_changes" ADD CONSTRAINT "vat_regime_changes_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "hub"."users"("id") ON DELETE no action ON UPDATE no action;