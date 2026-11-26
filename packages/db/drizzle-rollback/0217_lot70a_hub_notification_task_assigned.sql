-- Annulation de 0217 (lot 70a) : la sorte « task_assigned » disparaît, avec ses notifications (des avis
-- de passage, la tâche dit toujours à qui elle est) et les réglages de cette sorte (l'image précédente ne
-- les connaît pas).
DELETE FROM "hub"."notifications" WHERE "type" = 'task_assigned';
--> statement-breakpoint
DELETE FROM "hub"."notification_preferences" WHERE "type" = 'task_assigned';
--> statement-breakpoint
ALTER TABLE "hub"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";
--> statement-breakpoint
ALTER TABLE "hub"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("hub"."notifications"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced', 'module_activated'));
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" DROP CONSTRAINT IF EXISTS "notification_preferences_type_check";
--> statement-breakpoint
ALTER TABLE "hub"."notification_preferences" ADD CONSTRAINT "notification_preferences_type_check" CHECK ("hub"."notification_preferences"."type" in ('prospect_request', 'quote_signed', 'quote_expired', 'transfer_declared', 'client_decision', 'vendor_answer', 'iban_to_verify', 'document_expiring', 'task_overdue', 'milestone_late', 'risk_alert', 'day_of_alert', 'client_message', 'email_bounced', 'module_activated'));
