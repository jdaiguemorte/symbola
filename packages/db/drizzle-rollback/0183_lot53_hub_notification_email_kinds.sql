-- Annulation de 0183 (lot 53) : la contrainte des natures d'e-mails revient exactement à la liste de
-- main (migration 0180 du lot 52 : natures d'origine, invités, rendez-vous, « Nouvelle demande de
-- contact », prestataires, proposition et règlement, réponse, relance et questionnaire, alertes du
-- compte, transfert de propriété, renfort du jour J).
-- Refusée tant qu'un modèle personnalisé de récapitulatif, de rappel J-7 ou d'alerte existe : il serait
-- perdu ; la planner le remet au texte de départ (« Revenir au texte de départ ») avant l'annulation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" IN ('daily_digest', 'payment_due_reminder', 'notification_alert')) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails de récapitulatif, de rappel J-7 ou d''alerte personnalisés existent dans hub.email_templates.';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent', 'new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link'));
