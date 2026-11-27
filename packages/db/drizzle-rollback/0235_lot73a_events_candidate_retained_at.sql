-- Annulation de 0235 (lot 73a) : la date à laquelle un prestataire a été retenu disparaît, avec son
-- déclencheur ; l'image précédente date « contrat attendu » par la dernière modification (updated_at).
DROP TRIGGER IF EXISTS "event_vendor_candidates_retained_at" ON "events"."event_vendor_candidates";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "events"."stamp_candidate_retained_at"();
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_vendor_candidates_retained_at_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "retained_at";
