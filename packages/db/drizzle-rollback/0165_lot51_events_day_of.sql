-- Annulation de 0165 (lot 51) : le jour J de terrain disparaît, et le programme redevient celui du
-- seul jour de l'évènement. Refusée tant que le jour J a laissé une trace (pointages, décalages,
-- photos, main courante, listes, bilan) : c'est le travail de l'équipe sur place. Refusée aussi tant
-- qu'une séquence appartient à un temps fort d'un autre jour que celui de l'évènement (le chrono sur
-- plusieurs jours se perdrait), ou qu'un modèle de programme porte des temps forts. Les modèles de
-- listes de contrôle (copiés des données de départ) partent avec leur table ; le temps fort créé de
-- lui-même, jamais modifié par la planner (donc jamais proposé aux invités), est retiré.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."day_checkpoints") OR EXISTS (SELECT 1 FROM "events"."day_shifts")
    OR EXISTS (SELECT 1 FROM "events"."day_incidents") OR EXISTS (SELECT 1 FROM "events"."day_photos") THEN
    RAISE EXCEPTION 'Annulation refusée : le jour J a des pointages, des décalages, des incidents ou des photos (events.day_*).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."day_checklists") OR EXISTS (SELECT 1 FROM "events"."day_reports") THEN
    RAISE EXCEPTION 'Annulation refusée : des listes de contrôle ou des bilans du jour J existent encore (events.day_checklists, events.day_reports).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "events"."program_items" i
    JOIN "events"."key_moments" m ON m."id" = i."key_moment_id"
    JOIN "events"."events" e ON e."id" = i."event_id"
    WHERE e."event_date" IS NULL OR m."date" <> e."event_date"
  ) THEN
    RAISE EXCEPTION 'Annulation refusée : des séquences appartiennent à un temps fort d''un autre jour (events.program_items.key_moment_id).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."program_template_items" WHERE "moment_name" IS NOT NULL OR "day_offset" <> 0) THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles de programme portent des temps forts (events.program_template_items.moment_name).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP CONSTRAINT IF EXISTS "program_items_key_moment_id_key_moments_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."program_items_key_moment_idx";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN IF EXISTS "key_moment_id";
--> statement-breakpoint
DELETE FROM "events"."key_moments" WHERE "auto_created";
--> statement-breakpoint
ALTER TABLE "events"."key_moments" DROP COLUMN IF EXISTS "auto_created";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP CONSTRAINT IF EXISTS "program_template_items_moment_check";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP COLUMN IF EXISTS "moment_name";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP COLUMN IF EXISTS "day_offset";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_reports";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_checklist_items";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_checklists";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_checklist_templates";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_incidents";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_photos";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_shifts";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_checkpoints";
