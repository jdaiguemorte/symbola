-- Annulation de 0210 (lot 66b) : les modèles du rappel du jour J ne sont plus modifiables. Refusée tant
-- qu'une organisation en a modifié un (son texte serait perdu sans qu'elle le sache).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" IN ('day_reminder_planner', 'day_reminder_vendor', 'day_reminder_team', 'day_reminder_client')) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles du rappel du jour J sont modifiés (hub.email_templates).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT IF EXISTS "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent', 'new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link', 'daily_digest', 'payment_due_reminder', 'notification_alert', 'new_message'));
