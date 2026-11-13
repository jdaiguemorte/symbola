-- Lot 32a (D6) : le prestataire relancé, sur l'activité de l'évènement. Son nom est lu par cette
-- référence, jamais recopié (task_label reste vide, RGP-05) ; elle se vide si le prestataire est
-- retiré de l'évènement, et l'activité affiche alors « Relance envoyée à un prestataire retiré. ».
ALTER TABLE "events"."event_activities" ADD COLUMN "vendor_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD CONSTRAINT "event_activities_vendor_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("vendor_candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE set null ON UPDATE no action;