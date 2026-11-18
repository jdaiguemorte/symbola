-- Annulation de 0152 (lot 49) : la contrainte des natures de hub.email_templates revient à la liste
-- de 0142. Refusée tant qu'un modèle d'invitation ou de relance réécrit par une organisation existe
-- (il serait perdu sans qu'elle le sache).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE kind IN ('guest_invitation', 'guest_reminder')) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails des invités ont été réécrits (hub.email_templates).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT IF EXISTS "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published'));
