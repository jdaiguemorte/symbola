-- Lot 54 (HUB-27, ARC-06, NFR-26, DOC-06 ; décisions D1 à D3 de Julien du 19/11/2026 ; ADR 0101) :
-- abonnement en libre-service, forfaits par module, interrupteurs par fonction, quota de stockage.
-- - hub.plans, hub.plan_modules : catalogue des offres et des options, administré par l'Exploitation.
--   Vides : l'app lit le catalogue de départ (plans.json) ; aucun prix n'est écrit ici.
-- - hub.organization_subscriptions : offre, options, période et état d'une organisation (RLS).
--   Absente : l'organisation reste réglée par l'Exploitation, comme avant le lot.
-- - hub.feature_flags, hub.feature_flag_organizations : interrupteurs par fonction (NFR-26).
-- - hub.storage_quota_states : dernière mesure face au quota, paliers annoncés, préavis (RLS). La base
--   refuse au rôle applicatif un refus des dépôts moins de six jours après le début du préavis.
-- - hub.platform_settings : facturation des abonnements éteinte (D1), règles de l'essai et du quota.
-- Compatible avec l'image précédente : tables et colonnes nouvelles seulement (ARC-14).
CREATE TABLE "hub"."feature_flag_organizations" (
	"flag_key" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "feature_flag_organizations_flag_key_organization_id_pk" PRIMARY KEY("flag_key","organization_id")
);
--> statement-breakpoint
CREATE TABLE "hub"."feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"open_to_all" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "hub"."organization_subscriptions" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"plan_key" text NOT NULL,
	"chosen_module" text,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"storage_units" integer DEFAULT 0 NOT NULL,
	"billing_period" text DEFAULT 'monthly' NOT NULL,
	"status" text NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"read_only_since" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancel_effective_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "organization_subscriptions_status_check" CHECK ("hub"."organization_subscriptions"."status" in ('trial', 'active', 'read_only', 'cancelled')),
	CONSTRAINT "organization_subscriptions_period_check" CHECK ("hub"."organization_subscriptions"."billing_period" in ('monthly', 'yearly')),
	CONSTRAINT "organization_subscriptions_units_check" CHECK ("hub"."organization_subscriptions"."storage_units" >= 0),
	CONSTRAINT "organization_subscriptions_trial_check" CHECK ("hub"."organization_subscriptions"."status" <> 'trial' or "hub"."organization_subscriptions"."trial_ends_at" is not null),
	CONSTRAINT "organization_subscriptions_cancel_check" CHECK ("hub"."organization_subscriptions"."status" <> 'cancelled' or ("hub"."organization_subscriptions"."cancel_effective_at" is not null and "hub"."organization_subscriptions"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "hub"."plan_modules" (
	"plan_key" text NOT NULL,
	"module_key" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "plan_modules_plan_key_module_key_pk" PRIMARY KEY("plan_key","module_key"),
	CONSTRAINT "plan_modules_role_check" CHECK ("hub"."plan_modules"."role" in ('included', 'choice', 'option'))
);
--> statement-breakpoint
CREATE TABLE "hub"."plans" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"label_fr" text NOT NULL,
	"label_en" text NOT NULL,
	"description_fr" text NOT NULL,
	"description_en" text NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"yearly_price_cents" integer,
	"max_users" integer,
	"storage_quota_bytes" bigint,
	"storage_unit_bytes" bigint,
	"options_allowed" boolean DEFAULT false NOT NULL,
	"self_service" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "plans_kind_check" CHECK ("hub"."plans"."kind" in ('trial', 'plan', 'pilot', 'module_option', 'storage_option')),
	CONSTRAINT "plans_key_check" CHECK ("hub"."plans"."key" ~ '^[a-z][a-z0-9_]{0,39}$'),
	CONSTRAINT "plans_prices_check" CHECK ("hub"."plans"."monthly_price_cents" >= 0 and ("hub"."plans"."yearly_price_cents" is null or "hub"."plans"."yearly_price_cents" >= 0)),
	CONSTRAINT "plans_limits_check" CHECK (("hub"."plans"."max_users" is null or "hub"."plans"."max_users" >= 1) and ("hub"."plans"."storage_quota_bytes" is null or "hub"."plans"."storage_quota_bytes" >= 0) and ("hub"."plans"."storage_unit_bytes" is null or "hub"."plans"."storage_unit_bytes" >= 1)),
	CONSTRAINT "plans_self_service_check" CHECK ("hub"."plans"."kind" in ('plan', 'module_option', 'storage_option') or not "hub"."plans"."self_service")
);
--> statement-breakpoint
CREATE TABLE "hub"."storage_quota_states" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"used_bytes" bigint NOT NULL,
	"used_by_module" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_bytes" bigint,
	"alerted_percents" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"full_since" timestamp with time zone,
	"uploads_blocked_from" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "storage_quota_states_bytes_check" CHECK ("hub"."storage_quota_states"."used_bytes" >= 0 and ("hub"."storage_quota_states"."quota_bytes" is null or "hub"."storage_quota_states"."quota_bytes" >= 0)),
	CONSTRAINT "storage_quota_states_notice_check" CHECK ("hub"."storage_quota_states"."uploads_blocked_from" is null or ("hub"."storage_quota_states"."full_since" is not null and "hub"."storage_quota_states"."uploads_blocked_from" >= "hub"."storage_quota_states"."full_since" + interval '6 days'))
);
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "subscription_billing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "subscription_rules" jsonb;--> statement-breakpoint
ALTER TABLE "hub"."feature_flag_organizations" ADD CONSTRAINT "feature_flag_organizations_flag_key_feature_flags_key_fk" FOREIGN KEY ("flag_key") REFERENCES "hub"."feature_flags"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."plan_modules" ADD CONSTRAINT "plan_modules_plan_key_plans_key_fk" FOREIGN KEY ("plan_key") REFERENCES "hub"."plans"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feature_flag_organizations_organization_idx" ON "hub"."feature_flag_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_subscriptions_status_idx" ON "hub"."organization_subscriptions" USING btree ("status");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Les tables de
-- l'organisation ont la RLS ; le catalogue et les interrupteurs sont des données de la plateforme
-- (comme platform_settings et organization_modules). Aucune suppression par l'app, sauf le retrait
-- d'une organisation d'un interrupteur et d'un module d'une offre.
ALTER TABLE "hub"."organization_subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."organization_subscriptions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."organization_subscriptions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "hub"."storage_quota_states" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."storage_quota_states" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."storage_quota_states"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."organization_subscriptions" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."storage_quota_states" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."plans" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."plan_modules" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."feature_flags" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "hub"."feature_flag_organizations" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "plans_stamp" BEFORE INSERT OR UPDATE ON "hub"."plans"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "plans_journal_deletion" BEFORE DELETE ON "hub"."plans"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "plan_modules_stamp" BEFORE INSERT OR UPDATE ON "hub"."plan_modules"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "plan_modules_journal_deletion" BEFORE DELETE ON "hub"."plan_modules"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "organization_subscriptions_stamp" BEFORE INSERT OR UPDATE ON "hub"."organization_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "organization_subscriptions_journal_deletion" BEFORE DELETE ON "hub"."organization_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "feature_flags_stamp" BEFORE INSERT OR UPDATE ON "hub"."feature_flags"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "feature_flags_journal_deletion" BEFORE DELETE ON "hub"."feature_flags"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "feature_flag_organizations_stamp" BEFORE INSERT OR UPDATE ON "hub"."feature_flag_organizations"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "feature_flag_organizations_journal_deletion" BEFORE DELETE ON "hub"."feature_flag_organizations"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "storage_quota_states_stamp" BEFORE INSERT OR UPDATE ON "hub"."storage_quota_states"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "storage_quota_states_journal_deletion" BEFORE DELETE ON "hub"."storage_quota_states"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
