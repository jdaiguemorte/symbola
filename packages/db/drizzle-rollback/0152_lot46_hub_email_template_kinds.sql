-- Annulation de 0152 (lot 46) : la contrainte des natures d'e-mails revient à la liste d'avant les
-- rendez-vous. Refusée tant qu'un modèle de rendez-vous personnalisé existe : il serait perdu ; la
-- planner le remet au texte de départ (« Revenir au texte de départ ») avant l'annulation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" LIKE 'appointment\_%') THEN
    RAISE EXCEPTION 'annulation refusée : des modèles d''e-mails de rendez-vous personnalisés existent dans hub.email_templates';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published'));
