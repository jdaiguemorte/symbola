-- Annulation de 0073 (lot 15, DB-01) : table des traitements de fond. Refusée
-- tant qu'un traitement est en cours (des fiches attendent leur lecture).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."import_jobs" WHERE status IN ('pending', 'running')) THEN
    RAISE EXCEPTION 'Annulation refusée : un traitement d''import est en cours. Attendez sa fin ou abandonnez l''import.';
  END IF;
END $$;
DROP TABLE "hub"."import_jobs";
