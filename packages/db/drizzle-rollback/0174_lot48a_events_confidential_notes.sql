-- Annulation de 0174 (lot 48a) : les notes d'évènement confidentielles disparaissent. Refusée tant
-- qu'une note confidentielle existe : elle serait perdue (la planner la décoche d'abord, ce qui la
-- remet en clair).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."events" WHERE "notes_sealed" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des notes d''évènement sont confidentielles (events.events.notes_sealed).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT IF EXISTS "events_notes_sealed_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "notes_confidential_by", DROP COLUMN IF EXISTS "notes_sealed";
