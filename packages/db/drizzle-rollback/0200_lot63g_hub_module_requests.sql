-- Annulation de 0200 (lot 63g) : les demandes d'activation disparaissent, et la sorte de notification
-- « module_activated » avec ses notifications et ses réglages (des traces et des réglages personnels
-- sans équivalent avant le lot) ; les sortes reviennent à la liste de 0195. Les modules déjà activés
-- restent dans hub.organization_modules : aucune donnée métier n'est touchée. Refusée tant qu'une
-- demande attend (la planner la perdrait sans le savoir) : l'Exploitation la traite d'abord.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."module_requests" WHERE "status" = 'pending') THEN
    RAISE EXCEPTION 'annulation refusée : des demandes d''activation attendent dans hub.module_requests';
  END IF;
END;
$$;
--> statement-breakpoint
DELETE FROM "hub"."notifications" WHERE "type" = 'module_activated';
--> statement-breakpoint
DELETE FROM "hub"."notification_preferences" WHERE "type" = 'module_activated';
--> statement-breakpoint
ALTER TABLE "hub"."notifications" DROP CONSTRAINT "notifications_type_check";
--> statement-breakpoint
ALTER TABLE "hub"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("hub"."notifications"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced'));
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" DROP CONSTRAINT "notification_preferences_type_check";
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ADD CONSTRAINT "notification_preferences_type_check" CHECK ("hub"."notification_preferences"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced'));
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."module_requests";
