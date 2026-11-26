-- Lot 70a (CHR-04, UX-07 ; D1, A9, décisions de Julien du 26/11/2026) : qui a coché une tâche (« Cochée
-- par »), pas qui s'en chargeait : un membre (et lequel), les clients par leur lien, un prestataire par le
-- sien. Les deux colonnes sont nulles pour une tâche à faire ; « Rouvrir » les efface. Index pour trier
-- les tâches faites de la plus récente à la plus ancienne. Schéma events seulement ; ajout de colonnes
-- facultatives : compatible avec l'image précédente (ARC-14), que le déclencheur suit sans qu'elle le sache.
ALTER TABLE "events"."event_tasks" ADD COLUMN "done_by_kind" text;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "done_by_user_id" uuid;--> statement-breakpoint
CREATE INDEX "event_tasks_done_at_idx" ON "events"."event_tasks" USING btree ("organization_id","done_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_done_by_check" CHECK (("events"."event_tasks"."done_by_kind" is null or "events"."event_tasks"."done_by_kind" in ('member', 'clients', 'vendor')) and ("events"."event_tasks"."done_at" is not null or ("events"."event_tasks"."done_by_kind" is null and "events"."event_tasks"."done_by_user_id" is null)) and ("events"."event_tasks"."done_by_user_id" is null or "events"."event_tasks"."done_by_kind" = 'member'));
--> statement-breakpoint
-- Étape de données (A9, « Oui, le sûr ») : seulement ce que le journal de l'évènement dit. La dernière
-- coche ou décoche d'une tâche faite, si c'est une coche par un lien (les clients, ou un prestataire), ou
-- par un membre nommé. Sinon rien (« — », non connu) ; le tri par date de fin vaut pour toutes. Rejouable :
-- seules les tâches sans auteur changent. L'horodatage des lignes n'est pas touché.
ALTER TABLE "events"."event_tasks" DISABLE TRIGGER "event_tasks_stamp";
--> statement-breakpoint
UPDATE "events"."event_tasks" AS t
SET "done_by_kind" = CASE WHEN last."actor_user_id" IS NOT NULL THEN 'member' WHEN l."audience" = 'vendor' THEN 'vendor' ELSE 'clients' END,
    "done_by_user_id" = last."actor_user_id"
FROM (
  SELECT DISTINCT ON (a."task_id") a."task_id", a."kind", a."actor_link_id", a."actor_user_id"
  FROM "events"."event_activities" AS a
  WHERE a."task_id" IS NOT NULL AND a."kind" IN ('task_done', 'task_undone')
  ORDER BY a."task_id", a."created_at" DESC, a."id" DESC
) AS last
LEFT JOIN "events"."event_links" AS l ON l."id" = last."actor_link_id"
WHERE last."task_id" = t."id" AND last."kind" = 'task_done' AND t."done_at" IS NOT NULL AND t."done_by_kind" IS NULL
  AND (last."actor_user_id" IS NOT NULL OR l."id" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ENABLE TRIGGER "event_tasks_stamp";
--> statement-breakpoint
-- Qui coche, quel que soit le chemin (fiche, « Tâches », lot, lien des mariés ou d'un prestataire, image
-- précédente) : à la coche, si l'appelant ne l'a pas écrit, l'auteur de la transaction (app.actor_kind,
-- app.actor_id, ADR 0060) ; un lien donne « clients » ou « vendor » selon la tâche, jamais son identifiant.
-- À la décoche (« Rouvrir »), les deux colonnes s'effacent.
CREATE OR REPLACE FUNCTION "events"."task_done_by"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  actor_kind text := current_setting('app.actor_kind', true);
  actor uuid := nullif(current_setting('app.actor_id', true), '')::uuid;
BEGIN
  IF NEW.done_at IS NULL THEN
    NEW.done_by_kind := NULL;
    NEW.done_by_user_id := NULL;
  ELSIF OLD.done_at IS NULL
    AND NEW.done_by_kind IS NOT DISTINCT FROM OLD.done_by_kind
    AND NEW.done_by_user_id IS NOT DISTINCT FROM OLD.done_by_user_id THEN
    IF actor_kind = 'member' AND actor IS NOT NULL THEN
      NEW.done_by_kind := 'member';
      NEW.done_by_user_id := actor;
    ELSIF actor_kind = 'link' THEN
      NEW.done_by_kind := CASE WHEN NEW.responsible = 'vendor' THEN 'vendor' ELSE 'clients' END;
      NEW.done_by_user_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "event_tasks_done_by" BEFORE UPDATE ON "events"."event_tasks"
  FOR EACH ROW EXECUTE FUNCTION "events"."task_done_by"();
