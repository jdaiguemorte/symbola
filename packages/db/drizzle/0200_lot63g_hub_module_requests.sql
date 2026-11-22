-- Lot 63g (HUB-06, HUB-15, HUB-27, ARC-07, SEC-09, SEC-10 ; accord de Julien du 21/11/2026 ; ADR 0108) :
-- l'écran « Apps » et les demandes d'activation pendant le pilote.
-- - hub.module_requests : une demande d'activation d'une app (organisation, clé du module, auteur,
--   date, état, date de traitement), sans champ libre. Une seule demande en attente par app et par
--   organisation. RLS forcée ; l'Exploitation la lit organisation par organisation, comme les
--   abonnements, et n'en garde que l'organisation, la clé du module et la date (SEC-09).
-- - Sorte de notification « module_activated » : l'app demandée est activée (HUB-15).
-- Numéro 0200 réservé le 21/11 aux paquets du lot 63 (0196 à 0199 pour 63c, 63d et 63e).
-- Compatible avec l'image précédente : une table nouvelle et une sorte de plus (ARC-14).
CREATE TABLE "hub"."module_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "module_requests_status_check" CHECK ("hub"."module_requests"."status" in ('pending', 'cancelled', 'activated', 'declined')),
	CONSTRAINT "module_requests_module_key_check" CHECK ("hub"."module_requests"."module_key" ~ '^[a-z][a-z0-9_]{0,39}$'),
	CONSTRAINT "module_requests_handled_check" CHECK (("hub"."module_requests"."status" = 'pending') = ("hub"."module_requests"."handled_at" is null))
);
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" DROP CONSTRAINT "notification_preferences_type_check";--> statement-breakpoint
ALTER TABLE "hub"."notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
CREATE INDEX "module_requests_organization_idx" ON "hub"."module_requests" USING btree ("organization_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "module_requests_pending_idx" ON "hub"."module_requests" USING btree ("organization_id","module_key") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "module_requests_status_idx" ON "hub"."module_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ADD CONSTRAINT "notification_preferences_type_check" CHECK ("hub"."notification_preferences"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced', 'module_activated'));--> statement-breakpoint
ALTER TABLE "hub"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("hub"."notifications"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced', 'module_activated'));
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Aucune
-- suppression par l'app : une demande se clôt (annulée, activée, classée), elle ne s'efface qu'avec
-- l'organisation (fermeture du lot 35c, core.erase_organization_schema).
ALTER TABLE "hub"."module_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."module_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."module_requests"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."module_requests" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "module_requests_stamp" BEFORE INSERT OR UPDATE ON "hub"."module_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "module_requests_journal_deletion" BEFORE DELETE ON "hub"."module_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
