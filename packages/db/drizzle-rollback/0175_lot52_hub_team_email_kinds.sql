-- Annulation de 0175 (lot 52) : la contrainte des natures d'e-mails revient exactement à la liste de
-- main (migration 0172 du lot 45).
-- Refusée tant qu'un modèle personnalisé de nouvelle connexion, de changement d'identité, de transfert
-- de propriété ou de lien de renfort existe : il serait perdu ; la planner le remet au texte de départ
-- (« Revenir au texte de départ ») avant l'annulation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" IN ('new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link')) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails de sécurité, de transfert de propriété ou de renfort du jour J personnalisés existent dans hub.email_templates.';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent'));
