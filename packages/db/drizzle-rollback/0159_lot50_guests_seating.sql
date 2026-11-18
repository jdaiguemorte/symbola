-- Annulation de 0159 (lot 50) : le plan de table et la synthèse pour le traiteur disparaissent.
-- Refusée tant qu'un plan, une contrainte ou un type de repas choisi pour un invité existe : ce sont
-- des données de personnes ou le travail de la planner (supprimez les plans, ou purgez les invités,
-- RGP-08). Les types de repas de l'organisation (copiés des données de départ), les repas des
-- prestataires et la trace des téléchargements, sans donnée d'invité, partent avec les tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "guests"."seating_plans") THEN
    RAISE EXCEPTION 'Annulation refusée : des plans de table existent encore (guests.seating_plans).';
  END IF;
  IF EXISTS (SELECT 1 FROM "guests"."guests" WHERE "meal_type_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des invités ont un type de repas choisi (guests.guests.meal_type_id).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "guests"."guests" DROP COLUMN IF EXISTS "meal_type_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."caterer_summary_downloads";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."vendor_meal_counts";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."seating_constraint_members";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."seating_constraints";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."seat_assignments";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."seating_tables";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."seating_plans";
--> statement-breakpoint
DROP TABLE IF EXISTS "guests"."meal_types";
