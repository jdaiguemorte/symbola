-- Lot 52 (HUB-04, EVT-06, SEC-08 ; D1, D3, D6 ; ADR 0094) : les natures « new_device_login » (nouvelle
-- connexion), « identity_changed » (changement d'e-mail ou de facteur, à l'ancienne adresse),
-- « ownership_transfer » (confirmation du transfert de propriété) et « day_helper_link » (lien du renfort
-- du jour J) deviennent personnalisables par l'organisation. Exception écrite à la règle « une migration
-- ne touche que le schéma de son module » (DAT-09, ADR 0036), comme les lots 43 à 47 : seule la
-- contrainte des natures de hub.email_templates est remplacée, par la réunion des natures présentes sur
-- main (lot 45, migration 0172) et des quatre natures du lot ; rien d'autre. Une nature inconnue reste
-- refusée. Ajout seul : compatible avec la version précédente du code (ARC-14).
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder', 'appointment_confirmed', 'appointment_reminder', 'appointment_rescheduled', 'appointment_cancelled', 'prospect_form_received', 'vendor_brief', 'vendor_brief_reminder', 'vendor_roadmap', 'proposal_sent', 'proposal_expiry_reminder', 'payment_details', 'invoice_reminder', 'prospect_reply', 'prospect_follow_up', 'questionnaire_sent', 'new_device_login', 'identity_changed', 'ownership_transfer', 'day_helper_link'));
