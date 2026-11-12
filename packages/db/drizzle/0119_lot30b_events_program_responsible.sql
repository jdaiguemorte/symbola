-- Lot 30b (CHR-06, décision D6) : responsable de chaque séquence du programme du
-- jour J, en texte court (« Camille », « Le domaine ») tant que les comptes de
-- l'équipe n'ont pas de nom (lot 52).
ALTER TABLE "events"."program_items" ADD COLUMN "responsible" text;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD CONSTRAINT "program_items_responsible_check" CHECK ("events"."program_items"."responsible" is null or char_length("events"."program_items"."responsible") between 1 and 120);
