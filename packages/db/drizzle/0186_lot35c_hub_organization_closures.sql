-- Lot 35c (RGP-11 ; décision D8 de Julien du 18/11/2026 ; ADR 0100) : fermeture d'un espace.
-- - hub.organizations : date de fermeture, auteur, date de suppression (30 jours, à minuit à Paris),
--   préavis envoyé. La base refuse au rôle applicatif une fermeture antidatée et toute date de
--   suppression plus proche que 29 jours après la fermeture : un défaut de l'app ne peut pas avancer
--   une suppression.
-- - hub.organization_closures : trace de chaque fermeture, sans donnée personnelle ; elle survit à la
--   suppression et sert à effacer de nouveau après une restauration.
-- - core.organization_erasable : vrai seulement pour une organisation fermée dont la date de
--   suppression est passée (horloge de la base). core.erase_organization_schema efface, par module,
--   toutes les lignes d'une telle organisation ; core.erase_organization_identity efface ensuite
--   l'organisation, puis les comptes qui n'ont plus aucune adhésion. Le journal d'audit, en ajout
--   seul, ne cède qu'à cet effacement.
-- Compatible avec l'image précédente : une table, des colonnes facultatives et des fonctions
-- nouvelles ; aucune organisation n'est fermée tant que l'app du lot 35c ne le fait pas.
CREATE TABLE "hub"."organization_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"deletion_due_at" timestamp with time zone NOT NULL,
	"reopened_at" timestamp with time zone,
	"erased_at" timestamp with time zone,
	"erased_rows" integer,
	"files_erased_at" timestamp with time zone,
	"erased_files" integer,
	"replayed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "organization_closures_dates_check" CHECK ("hub"."organization_closures"."deletion_due_at" >= "hub"."organization_closures"."closed_at" + interval '29 days')
);
--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "closed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "deletion_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "closure_notice_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "organization_closures_organization_idx" ON "hub"."organization_closures" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_closures_open_idx" ON "hub"."organization_closures" USING btree ("organization_id") WHERE reopened_at is null and erased_at is null;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD CONSTRAINT "organizations_closure_check" CHECK (("hub"."organizations"."closed_at" is null) = ("hub"."organizations"."deletion_due_at" is null) and ("hub"."organizations"."deletion_due_at" is null or "hub"."organizations"."deletion_due_at" >= "hub"."organizations"."closed_at" + interval '29 days'));

--> statement-breakpoint
-- Pas de RLS : la trace sert quand l'organisation n'existe plus ; l'app la lit avec un filtre
-- explicite. Ni DELETE ni TRUNCATE pour le rôle applicatif.
GRANT SELECT, INSERT, UPDATE ON "hub"."organization_closures" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "organization_closures_stamp" BEFORE INSERT OR UPDATE ON "hub"."organization_closures"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "organization_closures_journal_deletion" BEFORE DELETE ON "hub"."organization_closures"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "hub"."guard_organization_closure"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'symbola_app' THEN
    IF NEW.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at AND NEW.closed_at < now() - interval '1 hour' THEN
      RAISE EXCEPTION 'fermeture antidatée refusée' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.deletion_due_at IS NOT NULL AND OLD.deletion_due_at IS NOT NULL AND NEW.deletion_due_at < OLD.deletion_due_at THEN
      RAISE EXCEPTION 'date de suppression avancée refusée' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organizations_closure_guard BEFORE UPDATE OF closed_at, deletion_due_at ON "hub"."organizations"
  FOR EACH ROW EXECUTE FUNCTION "hub"."guard_organization_closure"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "core"."organization_erasable"(organization uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM "hub"."organizations" o
    WHERE o.id = organization AND o.closed_at IS NOT NULL AND o.deletion_due_at <= now()
  )
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "core"."organization_erasable"(uuid) TO symbola_app;
--> statement-breakpoint
-- Toutes les lignes d'une organisation supprimable dans les tables d'un schéma qui ont la colonne
-- organization_id (sauf la trace des fermetures). Ordre libre : une table refusée par une clé
-- étrangère est reprise au tour suivant. Suppressions non journalisées une à une (app.audit_bulk).
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
-- Après les modules : l'organisation elle-même, puis les comptes de son équipe qui n'ont plus
-- aucune adhésion (et ne sont pas de l'Exploitation), avec tout ce qui les cite. Renvoie le sujet
-- chez le fournisseur d'identité de chaque compte effacé, pour l'effacer aussi là-bas.
CREATE OR REPLACE FUNCTION "core"."erase_organization_identity"(organization uuid, team uuid[]) RETURNS text[]
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  account uuid;
  subject text;
  subjects text[] := '{}';
  reference record;
BEGIN
  IF NOT "core"."organization_erasable"(organization) THEN
    RAISE EXCEPTION 'organisation non supprimable (fermée et à sa date de suppression seulement)' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."memberships" m WHERE m.organization_id = organization) THEN
    RAISE EXCEPTION 'organisation encore peuplée : effacer d''abord ses données' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.audit_bulk', 'on', true);
  DELETE FROM "hub"."organizations" WHERE id = organization;
  FOREACH account IN ARRAY coalesce(team, '{}') LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM "hub"."memberships" m WHERE m.user_id = account);
    CONTINUE WHEN EXISTS (SELECT 1 FROM "hub"."users" u WHERE u.id = account AND u.operator);
    SELECT u.idp_subject INTO subject FROM "hub"."users" u WHERE u.id = account;
    CONTINUE WHEN NOT FOUND;
    FOR reference IN
      SELECT cn.nspname AS schema_name, cl.relname AS table_name, att.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        JOIN pg_namespace cn ON cn.oid = cl.relnamespace
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
        WHERE con.contype = 'f' AND con.confrelid = '"hub"."users"'::regclass AND cardinality(con.conkey) = 1
    LOOP
      EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', reference.schema_name, reference.table_name, reference.column_name) USING account;
    END LOOP;
    DELETE FROM "hub"."users" WHERE id = account;
    IF subject IS NOT NULL THEN
      subjects := subjects || subject;
    END IF;
  END LOOP;
  PERFORM set_config('app.audit_bulk', '', true);
  RETURN subjects;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "core"."erase_organization_identity"(uuid, uuid[]) TO symbola_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "core"."forbid_audit_entry_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- IF imbriqués : un déclencheur TRUNCATE (par instruction) n'a pas d'OLD.
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_demo THEN
      RETURN OLD;
    END IF;
    -- Lot 35c (RGP-11, D8) : une organisation fermée, à sa date de suppression, perd aussi son journal.
    IF OLD.organization_id IS NOT NULL AND "core"."organization_erasable"(OLD.organization_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'journal d''audit en ajout seul (%)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;
