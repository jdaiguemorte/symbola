-- Annulation de 0093 (lot 23, décision D5) : adresses IP des connexions et leur
-- durée de conservation. Les adresses enregistrées sont perdues.
DROP TABLE "hub"."connection_traces";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "connection_trace_retention_months";
