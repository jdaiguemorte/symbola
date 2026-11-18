-- Lot 45 (CRM-05, CRM-06, POR-07 ; D9 ; ADR 0090) : les natures « prospect_reply » (réponse à un
-- prospect), « prospect_follow_up » (relance) et « questionnaire_sent » (questionnaire envoyé)
-- deviennent personnalisables par l'organisation. Exception écrite à la règle « une migration ne touche
-- que le schéma de son module » (DAT-09, ADR 0036), accordée par Julien le 18/11/2026 : seule la
-- contrainte des natures de hub.email_templates est remplacée, par la réunion des natures présentes
-- sur main (lot 44, migration 0161 ; lot 47, migration 0163) et des trois natures du lot ; rien
-- d'autre dans hub. Une nature inconnue reste refusée. Ajout seul : compatible avec la version précédente du code (ARC-14).
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent'));
