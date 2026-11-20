-- Annulation de 0195 (lot 55) : le journal des envois et l'adresse d'expédition choisie disparaissent ;
-- les natures et sortes reviennent aux listes de main (migrations 0183 et 0181). Refusée tant qu'un
-- modèle « Nouveau message » personnalisé existe (il serait perdu : la planner le remet au texte de
-- départ). Les notifications et réglages des deux sortes du lot sont des traces et des réglages
-- personnels sans équivalent avant le lot : ils sont effacés. Le journal des envois est une trace de
-- 13 mois : l'exporter avant si besoin. L'adresse d'expédition choisie est perdue : elle sera proposée
-- de nouveau depuis le nom de l'organisation si la migration est rejouée.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" = 'new_message') THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails « Nouveau message » personnalisés existent dans hub.email_templates.';
  END IF;
END
$$;
--> statement-breakpoint
DELETE FROM "hub"."notifications" WHERE "type" IN ('client_message', 'email_bounced');
--> statement-breakpoint
DELETE FROM "hub"."notification_preferences" WHERE "type" IN ('client_message', 'email_bounced');
--> statement-breakpoint
ALTER TABLE "hub"."notifications" DROP CONSTRAINT "notifications_type_check";
--> statement-breakpoint
ALTER TABLE "hub"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("hub"."notifications"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert'));
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" DROP CONSTRAINT "notification_preferences_type_check";
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ADD CONSTRAINT "notification_preferences_type_check" CHECK ("hub"."notification_preferences"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert'));
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent', 'new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link', 'daily_digest', 'payment_due_reminder', 'notification_alert'));
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."email_deliveries";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP CONSTRAINT IF EXISTS "organizations_sender_local_part_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."organizations_sender_local_part_idx";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN IF EXISTS "sender_local_part";
