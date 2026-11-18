-- Lot 47 (PRE-03, PAR-05 ; D2, D4, D8, D9 ; ADR 0085) : trois natures de modèles d'e-mails, le brief
-- à un prestataire, sa relance la veille de la date limite et la feuille de route (J-30, J-7).
-- Remplace seulement la contrainte des natures de hub.email_templates par la liste élargie (accord
-- de Julien du 18/11/2026 : migration hub à part, comme les lots 46 et 49) ; une nature inconnue
-- reste refusée. La liste réunit les natures présentes sur main (lots 49, 46 et 44 compris) ; si une
-- autre PR ajoute des natures et fusionne avant, celle-ci réunit les listes et renumérote.
-- Ajout seul : compatible avec la version précédente du code (ARC-14).
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap'));