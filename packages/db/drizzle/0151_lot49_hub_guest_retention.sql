-- Lot 49 (RGP-08, INV-03, INV-04 ; D4, D9, D10 ; ADR 0081) : durées de la purge des invités dans
-- les réglages RGPD (régimes et allergies à J+7, le reste à J+30, un report de 90 jours au plus ;
-- réponses 2 et 3 de la DPO), et deux modèles d'e-mails (invitation à répondre, relance). Schéma
-- hub seulement ; ajout seul (colonnes avec valeur par défaut, contrainte élargie) : compatible
-- avec la version précédente du code (ARC-14).
ALTER TABLE "hub"."email_templates" DROP CONSTRAINT "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "guest_retention_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "guest_diet_retention_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "guest_purge_max_postpone_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published', 'guest_invitation', 'guest_reminder'));
