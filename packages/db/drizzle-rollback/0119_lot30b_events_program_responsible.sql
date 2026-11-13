-- Annulation de 0119 (lot 30b) : les responsables saisis pour les séquences du
-- programme sont perdus ; le programme garde ses heures, lieux et intervenants.
ALTER TABLE "events"."program_items" DROP CONSTRAINT "program_items_responsible_check";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN "responsible";
