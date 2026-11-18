-- Annulation de 0160 (lot 44) : la contrainte des natures d'e-mails revient exactement à la liste
-- d'avant (migration 0152 du lot 49 : natures d'origine, invitations et relances des invités).
-- Refusée tant qu'un modèle « Nouvelle demande de contact » personnalisé existe : il serait perdu ; la
-- planner le remet au texte de départ (« Revenir au texte de départ ») avant l'annulation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE "kind" = 'prospect_form_received') THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails « Nouvelle demande de contact » personnalisés existent dans hub.email_templates.';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder'));
