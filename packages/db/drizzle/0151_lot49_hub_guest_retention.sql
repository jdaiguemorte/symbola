-- Lot 49 (RGP-08 ; D9 ; ADR 0082) : durées de la purge des invités dans les réglages RGPD
-- (régimes et allergies à J+7, le reste à J+30, un report de 90 jours au plus ; réponses 2 et 3 de
-- la DPO). Schéma hub seulement ; ajout seul (colonnes avec valeur par défaut) : compatible avec la
-- version précédente du code (ARC-14).
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "guest_retention_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "guest_diet_retention_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "guest_purge_max_postpone_days" integer DEFAULT 90 NOT NULL;
