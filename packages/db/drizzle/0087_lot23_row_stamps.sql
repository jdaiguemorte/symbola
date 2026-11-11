-- Lot 23 (DAT-06, SEC-19, ADR 0060) : fonctions communes, posées sur les
-- tables de chaque module par leurs propres migrations (0088 à 0092).
--
-- core.stamp_row() : date de création, date de modification et auteur sur
-- chaque ligne. L'auteur est celui fixé par withOrganization
-- (app.actor_id) ; vide = Symbola (tâche de fond) ou inconnu. created_* ne se
-- réécrit pas. Une date de modification fixée par l'appelant (horloge
-- simulée des tests, date métier) est respectée ; sinon, now().
CREATE OR REPLACE FUNCTION "core"."stamp_row"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  actor uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, actor);
    NEW.updated_by := coalesce(NEW.updated_by, NEW.created_by);
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
      NEW.updated_at := now();
    END IF;
    IF NEW.updated_by IS NOT DISTINCT FROM OLD.updated_by THEN
      NEW.updated_by := actor;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- core.stamp_created_row() : tables en ajout seul (historiques, factures,
-- avoirs) : une ligne qui ne change jamais n'a que sa création. Sa date est
-- created_at, ou la date métier qui en tient lieu (issued_at d'une facture,
-- changed_at d'un historique) ; seul l'auteur est posé ici.
CREATE OR REPLACE FUNCTION "core"."stamp_created_row"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, nullif(current_setting('app.actor_id', true), '')::uuid);
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- core.journal_deletion() (SEC-19, partie C) : toute suppression d'une ligne
-- d'une table métier laisse une ligne <schéma>.<table>.deleted au journal,
-- même si le code oublie de l'écrire. Sauf :
-- - une suppression en cascade (seul l'objet supprimé compte) : déclencheur
--   BEFORE DELETE, exécuté à l'intérieur de la cascade (profondeur 2), là où
--   un AFTER DELETE s'exécuterait au même niveau que l'objet supprimé ;
-- - une ligne d'essai guidé (is_demo) ;
-- - une purge en masse (app.audit_bulk = on), qui écrit sa ligne de synthèse.
-- Droits de l'appelant (pas de SECURITY DEFINER) : pour écrire dans le
-- journal de l'organisation de la ligne, y compris depuis une table du hub
-- supprimée hors contexte d'organisation, la fonction fixe ce contexte le
-- temps de l'écriture, puis remet la valeur précédente.
CREATE OR REPLACE FUNCTION "core"."journal_deletion"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  old_row jsonb := to_jsonb(OLD);
  previous_organization text := current_setting('app.organization_id', true);
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF current_setting('app.audit_bulk', true) = 'on' THEN
    RETURN OLD;
  END IF;
  IF coalesce((old_row ->> 'is_demo')::boolean, false) THEN
    RETURN OLD;
  END IF;
  PERFORM set_config('app.organization_id', coalesce(old_row ->> 'organization_id', ''), true);
  INSERT INTO "core"."audit_entries" ("organization_id", "action", "category", "object_type", "object_id")
  VALUES (
    (old_row ->> 'organization_id')::uuid,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || '.deleted',
    'suppression',
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    (old_row ->> 'id')::uuid
  );
  PERFORM set_config('app.organization_id', coalesce(previous_organization, ''), true);
  RETURN OLD;
END;
$$;
