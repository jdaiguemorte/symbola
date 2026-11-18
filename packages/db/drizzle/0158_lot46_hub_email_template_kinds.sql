-- Lot 46 (RDV-03, D10 ; ADR 0082) : les quatre natures des e-mails de rendez-vous (confirmé, rappel,
-- déplacé, annulé) deviennent personnalisables par l'organisation. Exception écrite à la règle
-- « une migration ne touche que le schéma de son module » (DAT-09, ADR 0036), accordée par Julien le
-- 18/11/2026 : seule la contrainte des natures de hub.email_templates est remplacée, par la réunion
-- des natures laissées par le lot 49 (migration 0152, invitations et relances des invités) et des
-- quatre natures appointment_* ; rien d'autre dans hub. Une nature inconnue reste refusée.
-- Ajout seul : compatible avec la version précédente du code (ARC-14).
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled'));
