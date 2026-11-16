-- Annulation de 0138 (lot 37b) : versions diffusées du programme. Les versions sont perdues ; clients
-- et prestataires revoient le programme en direct (image du lot 37a).
DROP TABLE IF EXISTS "events"."program_versions";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN IF EXISTS "program_version_seen";
