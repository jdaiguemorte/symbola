-- Annulation de 0128 (lot 32a, D6) : la référence au prestataire relancé disparaît de l'activité ;
-- les relances inscrites gardent le nom du prestataire.
ALTER TABLE "events"."event_activities" DROP CONSTRAINT "event_activities_vendor_candidate_id_event_vendor_candidates_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_activities" DROP COLUMN "vendor_candidate_id";
