-- Lot 53 (HUB-15, UX-16, ARC-09, HUB-28, GC-02 ; D1 à D5, D7 ; ADR 0095) : notifications de l'équipe,
-- abonnements push, automatismes prêts à activer et radar des risques. Schéma hub seulement :
-- réglages de chaque personne (notification_settings : récapitulatif, plages de silence, jour J ;
-- notification_preferences : chaque sorte coupée ou gardée par canal), notifications (sorte, objet,
-- écran où agir, état de chaque envoi), abonnements push (adresse du service de push et clés publiques,
-- données techniques), automatismes (actif, délai, remise en route) et leur journal, règles du radar
-- (active, seuil). Ajout seul : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "hub"."automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"object_key" text,
	"object_label" text,
	"href" text,
	"result" text NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "automation_runs_key_check" CHECK ("hub"."automation_runs"."key" in ('quote_signed_confirm_event', 'payment_due_reminder', 'rsvp_reminder', 'client_task_reminder', 'invoice_reminder', 'proposal_expiry_reminder', 'prospect_follow_up', 'vendor_roadmap', 'risk_radar')),
	CONSTRAINT "automation_runs_result_check" CHECK ("hub"."automation_runs"."result" in ('sent', 'skipped', 'failed', 'done')),
	CONSTRAINT "automation_runs_label_check" CHECK ("hub"."automation_runs"."object_label" is null or char_length("hub"."automation_runs"."object_label") <= 200),
	CONSTRAINT "automation_runs_href_check" CHECK ("hub"."automation_runs"."href" is null or ("hub"."automation_runs"."href" ~ '^/[^/]' and char_length("hub"."automation_runs"."href") <= 500))
);
--> statement-breakpoint
CREATE TABLE "hub"."automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean NOT NULL,
	"days" integer,
	"resumed_at" timestamp with time zone,
	"last_run_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "automations_key_check" CHECK ("hub"."automations"."key" in ('quote_signed_confirm_event', 'payment_due_reminder', 'rsvp_reminder', 'client_task_reminder', 'invoice_reminder', 'proposal_expiry_reminder', 'prospect_follow_up', 'vendor_roadmap', 'risk_radar')),
	CONSTRAINT "automations_days_check" CHECK ("hub"."automations"."days" is null or "hub"."automations"."days" between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "hub"."notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "notification_preferences_type_check" CHECK ("hub"."notification_preferences"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert')),
	CONSTRAINT "notification_preferences_channel_check" CHECK ("hub"."notification_preferences"."channel" in ('app', 'email', 'push'))
);
--> statement-breakpoint
CREATE TABLE "hub"."notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"digest_enabled" boolean NOT NULL,
	"digest_hour" integer NOT NULL,
	"quiet_enabled" boolean NOT NULL,
	"quiet_start_minute" integer NOT NULL,
	"quiet_end_minute" integer NOT NULL,
	"quiet_sundays" boolean NOT NULL,
	"day_of_override" boolean NOT NULL,
	"time_zone" text DEFAULT 'Europe/Paris' NOT NULL,
	"digest_sent_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "notification_settings_hours_check" CHECK ("hub"."notification_settings"."digest_hour" between 0 and 23 and "hub"."notification_settings"."quiet_start_minute" between 0 and 1439 and "hub"."notification_settings"."quiet_end_minute" between 0 and 1439),
	CONSTRAINT "notification_settings_time_zone_check" CHECK (char_length("hub"."notification_settings"."time_zone") between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "hub"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"event_id" uuid,
	"object_key" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"href" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email_state" text DEFAULT 'none' NOT NULL,
	"email_due_at" timestamp with time zone,
	"push_state" text DEFAULT 'none' NOT NULL,
	"push_due_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "notifications_type_check" CHECK ("hub"."notifications"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert')),
	CONSTRAINT "notifications_object_key_check" CHECK (char_length("hub"."notifications"."object_key") between 1 and 200),
	CONSTRAINT "notifications_href_check" CHECK ("hub"."notifications"."href" ~ '^/[^/]' and char_length("hub"."notifications"."href") <= 500),
	CONSTRAINT "notifications_params_check" CHECK (jsonb_typeof("hub"."notifications"."params") = 'object' and octet_length("hub"."notifications"."params"::text) <= 2000),
	CONSTRAINT "notifications_email_state_check" CHECK ("hub"."notifications"."email_state" in ('none', 'pending', 'digest', 'sent', 'skipped')),
	CONSTRAINT "notifications_push_state_check" CHECK ("hub"."notifications"."push_state" in ('none', 'pending', 'digest', 'sent', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "hub"."push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_label" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "push_subscriptions_endpoint_check" CHECK ("hub"."push_subscriptions"."endpoint" ~ '^https://' and char_length("hub"."push_subscriptions"."endpoint") <= 1000),
	CONSTRAINT "push_subscriptions_keys_check" CHECK (char_length("hub"."push_subscriptions"."p256dh") between 80 and 100 and char_length("hub"."push_subscriptions"."auth") between 16 and 32),
	CONSTRAINT "push_subscriptions_label_check" CHECK (char_length("hub"."push_subscriptions"."device_label") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "hub"."risk_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"enabled" boolean NOT NULL,
	"threshold_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "risk_rules_rule_check" CHECK ("hub"."risk_rules"."rule" in ('vendor_without_contract', 'decision_overdue', 'document_expired', 'payment_overdue', 'milestone_late', 'iban_to_verify', 'roadmap_unconfirmed')),
	CONSTRAINT "risk_rules_threshold_check" CHECK ("hub"."risk_rules"."threshold_days" between 0 and 365)
);
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_runs_organization_idx" ON "hub"."automation_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automation_runs_key_idx" ON "hub"."automation_runs" USING btree ("organization_id","key","ran_at");--> statement-breakpoint
CREATE INDEX "automations_organization_idx" ON "hub"."automations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automations_key_idx" ON "hub"."automations" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "notification_preferences_organization_idx" ON "hub"."notification_preferences" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_type_channel_idx" ON "hub"."notification_preferences" USING btree ("organization_id","user_id","type","channel");--> statement-breakpoint
CREATE INDEX "notification_settings_organization_idx" ON "hub"."notification_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_user_idx" ON "hub"."notification_settings" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_organization_idx" ON "hub"."notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "hub"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_event_idx" ON "hub"."notifications" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_object_idx" ON "hub"."notifications" USING btree ("organization_id","user_id","type","object_key");--> statement-breakpoint
CREATE INDEX "notifications_email_due_idx" ON "hub"."notifications" USING btree ("email_state","email_due_at");--> statement-breakpoint
CREATE INDEX "notifications_push_due_idx" ON "hub"."notifications" USING btree ("push_state","push_due_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_organization_idx" ON "hub"."push_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "hub"."push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "hub"."push_subscriptions" USING btree ("organization_id","endpoint");--> statement-breakpoint
CREATE INDEX "risk_rules_organization_idx" ON "hub"."risk_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_rules_rule_idx" ON "hub"."risk_rules" USING btree ("organization_id","rule");
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées
-- (sauf les notifications, leur journal d'automatismes et les abonnements push : techniques, purgés).
--> statement-breakpoint
ALTER TABLE "hub"."notification_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."notification_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."notification_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."notification_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "notification_settings_stamp" BEFORE INSERT OR UPDATE ON "hub"."notification_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "notification_settings_journal_deletion" BEFORE DELETE ON "hub"."notification_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."notification_preferences"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."notification_preferences" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "notification_preferences_stamp" BEFORE INSERT OR UPDATE ON "hub"."notification_preferences"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "notification_preferences_journal_deletion" BEFORE DELETE ON "hub"."notification_preferences"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "hub"."notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."notifications"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."notifications" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "notifications_stamp" BEFORE INSERT OR UPDATE ON "hub"."notifications"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
ALTER TABLE "hub"."push_subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."push_subscriptions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."push_subscriptions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."push_subscriptions" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "push_subscriptions_stamp" BEFORE INSERT OR UPDATE ON "hub"."push_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
ALTER TABLE "hub"."automations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."automations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."automations"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."automations" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "automations_stamp" BEFORE INSERT OR UPDATE ON "hub"."automations"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "automations_journal_deletion" BEFORE DELETE ON "hub"."automations"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "hub"."automation_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."automation_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."automation_runs"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."automation_runs" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "automation_runs_stamp" BEFORE INSERT OR UPDATE ON "hub"."automation_runs"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
ALTER TABLE "hub"."risk_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."risk_rules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."risk_rules"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."risk_rules" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "risk_rules_stamp" BEFORE INSERT OR UPDATE ON "hub"."risk_rules"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "risk_rules_journal_deletion" BEFORE DELETE ON "hub"."risk_rules"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
