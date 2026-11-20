-- Annulation de 0191 (lot 60) : le module Plans de salle disparaît avec son schéma. Refusée tant
-- qu'un espace existe encore (configurations des lieux ou plans d'évènements : le savoir-faire de la
-- planner) ; supprimez-les d'abord depuis l'app, qui retire aussi les fonds de plan stockés. La
-- bibliothèque d'éléments, sans donnée propre à un lieu, part avec le schéma.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "floorplans"."spaces") THEN
    RAISE EXCEPTION 'Annulation refusée : des espaces de plans de salle existent encore (floorplans.spaces).';
  END IF;
END $$;
--> statement-breakpoint
-- La fonction d'effacement d'un espace fermé reprend la liste du lot 35c (sans floorplans).
CREATE OR REPLACE FUNCTION "core"."erase_organization_schema"(organization uuid, target_schema text) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  remaining text[];
  next_round text[];
  table_name text;
  deleted bigint;
  total bigint := 0;
  progressed boolean;
  rounds integer := 0;
BEGIN
  IF target_schema NOT IN ('hub', 'events', 'budget', 'quotes', 'vendors', 'guests', 'appointments', 'core') THEN
    RAISE EXCEPTION 'schéma non effaçable : %', target_schema USING ERRCODE = 'P0001';
  END IF;
  IF NOT "core"."organization_erasable"(organization) THEN
    RAISE EXCEPTION 'organisation non supprimable (fermée et à sa date de suppression seulement)' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.organization_id', organization::text, true);
  PERFORM set_config('app.audit_bulk', 'on', true);
  PERFORM set_config('app.include_deleted', 'on', true);
  SELECT coalesce(array_agg(c.relname::text ORDER BY c.relname), '{}') INTO remaining
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped
    WHERE n.nspname = target_schema AND c.relkind IN ('r', 'p')
      AND NOT (n.nspname = 'hub' AND c.relname = 'organization_closures');
  LOOP
    rounds := rounds + 1;
    progressed := false;
    next_round := '{}';
    FOREACH table_name IN ARRAY remaining LOOP
      BEGIN
        EXECUTE format('DELETE FROM %I.%I WHERE organization_id = $1', target_schema, table_name) USING organization;
        GET DIAGNOSTICS deleted = ROW_COUNT;
        total := total + deleted;
        progressed := true;
      EXCEPTION WHEN foreign_key_violation THEN
        next_round := next_round || table_name;
      END;
    END LOOP;
    EXIT WHEN cardinality(next_round) = 0;
    IF NOT progressed OR rounds > 50 THEN
      RAISE EXCEPTION 'effacement bloqué par des clés étrangères : %', next_round USING ERRCODE = 'P0001';
    END IF;
    remaining := next_round;
  END LOOP;
  PERFORM set_config('app.audit_bulk', '', true);
  RETURN total;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "core"."erase_organization_schema"(uuid, text) TO symbola_app;
--> statement-breakpoint
DROP SCHEMA IF EXISTS "floorplans" CASCADE;
