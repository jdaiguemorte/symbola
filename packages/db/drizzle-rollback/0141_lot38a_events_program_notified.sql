-- Annulation de 0141 (lot 38a) : la date et le nombre d'envois d'une version du programme sont perdus.
REVOKE UPDATE ("notified_at", "notified_count") ON "events"."program_versions" FROM symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."program_versions" DROP COLUMN IF EXISTS "notified_count";
--> statement-breakpoint
ALTER TABLE "events"."program_versions" DROP COLUMN IF EXISTS "notified_at";
