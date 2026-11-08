-- Annulation de 0080 (lot 16, ADR 0045) : types d'événement. Les événements
-- perdent leur type ; le vocabulaire revient à celui du métier de
-- l'organisation (ADR 0042).
ALTER TABLE "events"."events" DROP CONSTRAINT "events_event_type_id_event_types_id_fk";
ALTER TABLE "events"."events" DROP COLUMN "event_type_id";
DROP TABLE "events"."event_types";
DROP TYPE "events"."event_type_audience";
