-- Annulation de 0113 (lot 26b) : les codes à usage unique et les liens des
-- prestataires sont perdus (le lot 26a ne sait pas les ouvrir) ; les autres
-- liens perdent la demande de code.
DROP TABLE "events"."event_link_codes";
--> statement-breakpoint
DELETE FROM "events"."event_links" WHERE "audience" = 'vendor';
--> statement-breakpoint
DROP INDEX "events"."event_links_vendor_candidate_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_vendor_candidate_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_vendor_candidate_id_event_vendor_candidates_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN "otp_required";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN "vendor_candidate_id";
