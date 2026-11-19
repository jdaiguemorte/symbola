-- Lot 55 (MSG-04 révisée, MSG-05, MSG-03 ; D1, D2 ; ADR 0101) : adresse d'expédition de
-- l'organisation (partie locale unique sur le domaine d'envoi de Symbola), journal des envois (statut
-- par le webhook signé du service d'envoi, purgé à 13 mois), nature d'e-mail « new_message » et deux
-- sortes de notification (message d'un client, e-mail rejeté). Schéma hub seulement : les contraintes
-- des natures et des sortes sont remplacées par la réunion des valeurs de main (migrations 0183 et
-- 0181) et de celles du lot. Ajout seul : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "hub"."email_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"recipient" text,
	"recipient_hash" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text,
	"event_id" uuid,
	"status" text DEFAULT 'sent' NOT NULL,
	"reason" text,
	"sent_at" timestamp with time zone NOT NULL,
	"status_at" timestamp with time zone NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "email_deliveries_status_check" CHECK ("hub"."email_deliveries"."status" in ('sent', 'delivered', 'bounced', 'complained')),
	CONSTRAINT "email_deliveries_reason_check" CHECK ("hub"."email_deliveries"."reason" is null or "hub"."email_deliveries"."reason" in ('mailbox_not_found', 'mailbox_full', 'blocked', 'spam_complaint', 'other')),
	CONSTRAINT "email_deliveries_reference_check" CHECK (char_length("hub"."email_deliveries"."reference") between 1 and 300),
	CONSTRAINT "email_deliveries_hash_check" CHECK ("hub"."email_deliveries"."recipient_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "email_deliveries_subject_check" CHECK (char_length("hub"."email_deliveries"."subject") <= 300),
	CONSTRAINT "email_deliveries_kind_check" CHECK ("hub"."email_deliveries"."kind" is null or char_length("hub"."email_deliveries"."kind") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" DROP CONSTRAINT "notification_preferences_type_check";--> statement-breakpoint
ALTER TABLE "hub"."notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "sender_local_part" text;--> statement-breakpoint
CREATE INDEX "email_deliveries_organization_idx" ON "hub"."email_deliveries" USING btree ("organization_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_reference_idx" ON "hub"."email_deliveries" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "email_deliveries_recipient_idx" ON "hub"."email_deliveries" USING btree ("organization_id","recipient_hash","status_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_event_idx" ON "hub"."email_deliveries" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_sender_local_part_idx" ON "hub"."organizations" USING btree ("sender_local_part");--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent', 'new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link', 'daily_digest', 'payment_due_reminder', 'notification_alert', 'new_message'));--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ADD CONSTRAINT "notification_preferences_type_check" CHECK ("hub"."notification_preferences"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced'));--> statement-breakpoint
ALTER TABLE "hub"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("hub"."notifications"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced'));--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD CONSTRAINT "organizations_sender_local_part_check" CHECK ("hub"."organizations"."sender_local_part" is null or "hub"."organizations"."sender_local_part" ~ '^[a-z0-9]([a-z0-9]|[.-][a-z0-9]){1,39}$');
--> statement-breakpoint
-- Row-Level Security du journal des envois ; ses suppressions (purge à 13 mois) ne vont pas au journal
-- d'audit. La colonne de l'adresse d'expédition suit les droits existants de hub.organizations.
--> statement-breakpoint
ALTER TABLE "hub"."email_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."email_deliveries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."email_deliveries"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."email_deliveries" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "email_deliveries_stamp" BEFORE INSERT OR UPDATE ON "hub"."email_deliveries"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
