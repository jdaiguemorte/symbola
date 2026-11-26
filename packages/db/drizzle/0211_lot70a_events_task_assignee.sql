-- Lot 70a (CHR-02, CHR-04, PAR-10 ; A1 à A4, décisions de Julien du 26/11/2026) : une tâche « planner »
-- (quelqu'un de l'agence) nomme le membre de l'équipe qui s'en charge. Schéma events seulement ; pas de
-- clé étrangère vers hub (avenant de l'ADR 0012) : le service n'accepte qu'un membre actif de
-- l'organisation. Ajout d'une colonne facultative : compatible avec l'image précédente (ARC-14).
ALTER TABLE "events"."event_tasks" ADD COLUMN "assignee_user_id" uuid;--> statement-breakpoint
CREATE INDEX "event_tasks_assignee_idx" ON "events"."event_tasks" USING btree ("organization_id","assignee_user_id");--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_assignee_check" CHECK ("events"."event_tasks"."assignee_user_id" is null or "events"."event_tasks"."responsible" = 'planner');
--> statement-breakpoint
-- Étape de données (A2, « Oui, cette règle ») : chaque tâche « planner » existante revient au planner
-- principal de son évènement (lot 52) s'il est encore membre actif ; sinon à la personne qui l'a créée, si
-- elle l'est encore ; sinon à la titulaire (la plus ancienne adhésion « owner » active). Une tâche hors
-- évènement n'a pas de planner principal : elle revient à sa créatrice, sinon à la titulaire. Seules les
-- tâches sans personne changent : la migration se rejoue sans rien changer. Lecture seule de hub (qui est
-- membre) ; l'horodatage des lignes n'est pas touché (ce n'est pas une modification de la planner).
ALTER TABLE "events"."event_tasks" DISABLE TRIGGER "event_tasks_stamp";
--> statement-breakpoint
UPDATE "events"."event_tasks" AS t
SET "assignee_user_id" = coalesce(
  (SELECT lead."user_id" FROM "events"."event_team_members" AS lead
    WHERE t."event_id" IS NOT NULL AND lead."event_id" = t."event_id" AND lead."role" = 'lead'
      AND EXISTS (SELECT 1 FROM "hub"."memberships" AS m WHERE m."user_id" = lead."user_id" AND m."organization_id" = t."organization_id" AND m."disabled_at" IS NULL AND m."role" IN ('owner', 'member'))
    LIMIT 1),
  (SELECT m."user_id" FROM "hub"."memberships" AS m
    WHERE m."user_id" = t."created_by" AND m."organization_id" = t."organization_id" AND m."disabled_at" IS NULL AND m."role" IN ('owner', 'member')),
  (SELECT m."user_id" FROM "hub"."memberships" AS m
    WHERE m."organization_id" = t."organization_id" AND m."role" = 'owner' AND m."disabled_at" IS NULL
    ORDER BY m."created_at", m."user_id" LIMIT 1)
)
WHERE t."responsible" = 'planner' AND t."assignee_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ENABLE TRIGGER "event_tasks_stamp";
