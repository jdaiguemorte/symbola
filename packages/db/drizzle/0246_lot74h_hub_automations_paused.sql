-- Lot 74h (HUB-28, GC-02 ; spécification du lot 74, § 4.1 ; G10, A6 ; L74-D6 tranchée le 27/11/2026) : quand
-- et par qui un automatisme a été coupé, pour dire « Coupé le 20 nov. par Camille » dans « Automatismes » et en
-- tête des règles du radar. Les deux colonnes sont nulles quand l'automatisme est en marche ; un automatisme
-- coupé avant ce lot reste « Coupé », sans date ni nom. paused_by est l'identifiant d'un membre (registre
-- RGPD), sans nom ni e-mail. Aucune étape de données. Compatible avec l'image précédente (ARC-14) : colonnes
-- ajoutées, nulles.
ALTER TABLE "hub"."automations" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."automations" ADD COLUMN "paused_by" uuid;
