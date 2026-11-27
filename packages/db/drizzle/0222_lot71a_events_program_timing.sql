-- Lot 71a (CHR-06, CHR-08, R12 ; spécification du lot 71, § 4.2) : la forme d'un moment du programme,
-- « span » (un début, une fin à saisir si elle manque), « point » (ponctuel) ou « marker » (repère sans
-- durée). Les moments existants sont « span ». « Le lendemain » reste calculé (fin plus tôt que le
-- début). Compatible avec l'image précédente : une colonne avec une valeur par défaut (ARC-14).
ALTER TABLE "events"."program_items" ADD COLUMN "timing" text DEFAULT 'span' NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD CONSTRAINT "program_items_timing_check" CHECK ("events"."program_items"."timing" in ('span', 'point', 'marker'));
