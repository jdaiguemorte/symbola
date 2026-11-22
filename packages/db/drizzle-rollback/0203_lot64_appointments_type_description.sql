-- Annulation de 0203 (lot 64) : la description des types de rendez-vous disparaît. Refusée tant
-- qu'un type en a une (le texte serait perdu) : la planner la vide d'abord.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "appointments"."appointment_types" WHERE "description" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des types de rendez-vous ont une description (appointments.appointment_types.description).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" DROP CONSTRAINT IF EXISTS "appointment_types_description_check";
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" DROP COLUMN IF EXISTS "description";
