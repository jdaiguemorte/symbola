-- Annulation de 0163 (lot 47) : la contrainte des natures de hub.email_templates revient à la liste
-- d'avant (celle de main : lots 49, 46 et 44, 0161). Refusée tant qu'un modèle de brief, de relance ou de feuille de
-- route réécrit par une organisation existe (il serait perdu sans qu'elle le sache).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."email_templates" WHERE kind IN ('vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap')) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''e-mails des prestataires ont été réécrits (hub.email_templates).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT IF EXISTS "email_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received'));
