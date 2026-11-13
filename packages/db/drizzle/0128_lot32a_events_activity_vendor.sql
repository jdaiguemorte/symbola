-- Lot 32a (D6) : le prestataire relancé, sur l'activité de l'évènement ; la référence se vide si le
-- prestataire est retiré de l'évènement (le nom reste dans task_label).
ALTER TABLE "events"."event_activities" ADD COLUMN "vendor_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD CONSTRAINT "event_activities_vendor_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("vendor_candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE set null ON UPDATE no action;