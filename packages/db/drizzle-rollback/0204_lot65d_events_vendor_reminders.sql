-- Annulation de 0204 (lot 65d) : les relances notées disparaissent ; leurs notes restent (notes
-- internes des prestataires). Refusée tant qu'une relance est notée (elle serait perdue sans que la
-- planner le sache) : les retirer d'abord, ou garder la migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."vendor_reminders") THEN
    RAISE EXCEPTION 'Annulation refusée : des relances sont notées (events.vendor_reminders).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_reminders";
