-- Annulation de 0167 (lot 43) : la contrainte des natures d'e-mails revient exactement à la liste de
-- main (migration 0161 du lot 44 : natures d'origine, invités, rendez-vous, nouvelle demande de
-- contact).
-- Refusée tant qu'un modèle personnalisé d'une des quatre natures du lot existe : il serait perdu ; la
-- planner le remet au texte de départ (« Revenir au texte de départ ») avant l'annulation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" IN ('proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder')) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails de proposition ou de règlement personnalisés existent dans hub.email_templates.';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received'));
