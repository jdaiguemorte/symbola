-- Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) : équipe par évènement et renfort du jour J.
-- - event_team_members : planner principal (un par évènement) et assistants.
-- - Public « day_helper » des liens personnels (sans rubrique du portail, code à l'ouverture), et
--   téléphone du renfort. La valeur s'ajoute au type sans être employée dans cette migration (ADD VALUE
--   en transaction : la contrainte compare le texte).
-- - Actions du jour J (pointage, main courante, case cochée, photo) : l'auteur est un compte, ou le lien
--   du renfort ; les colonnes d'auteur du compte deviennent facultatives.
-- Ajouts et assouplissements seuls : compatibles avec la version précédente du code (ARC-14).
ALTER TYPE "events"."event_link_audience" ADD VALUE 'day_helper';--> statement-breakpoint
CREATE TABLE "events"."event_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_team_members_event_user_unique" UNIQUE("event_id","user_id"),
	CONSTRAINT "event_team_members_role_check" CHECK ("events"."event_team_members"."role" in ('lead', 'assistant'))
);
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" DROP CONSTRAINT "day_checklist_items_check_check";--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."day_photos" ALTER COLUMN "taken_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" ADD COLUMN "checked_by_link_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ADD COLUMN "link_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ADD COLUMN "link_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."day_photos" ADD COLUMN "taken_by_link_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "events"."event_team_members" ADD CONSTRAINT "event_team_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_team_members_organization_idx" ON "events"."event_team_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_team_members_event_idx" ON "events"."event_team_members" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_team_members_user_idx" ON "events"."event_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_team_members_one_lead" ON "events"."event_team_members" USING btree ("event_id") WHERE "events"."event_team_members"."role" = 'lead';--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" ADD CONSTRAINT "day_checklist_items_checked_by_link_id_event_links_id_fk" FOREIGN KEY ("checked_by_link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ADD CONSTRAINT "day_checkpoints_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ADD CONSTRAINT "day_incidents_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_photos" ADD CONSTRAINT "day_photos_taken_by_link_id_event_links_id_fk" FOREIGN KEY ("taken_by_link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" ADD CONSTRAINT "day_checklist_items_check_check" CHECK (("events"."day_checklist_items"."checked_at" is null and "events"."day_checklist_items"."checked_by" is null and "events"."day_checklist_items"."checked_by_link_id" is null) or ("events"."day_checklist_items"."checked_at" is not null and ("events"."day_checklist_items"."checked_by" is null or "events"."day_checklist_items"."checked_by_link_id" is null)));--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ADD CONSTRAINT "day_checkpoints_author_check" CHECK ("events"."day_checkpoints"."user_id" is null or "events"."day_checkpoints"."link_id" is null);--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ADD CONSTRAINT "day_incidents_author_check" CHECK ("events"."day_incidents"."user_id" is null or "events"."day_incidents"."link_id" is null);--> statement-breakpoint
ALTER TABLE "events"."day_photos" ADD CONSTRAINT "day_photos_author_check" CHECK ("events"."day_photos"."taken_by" is null or "events"."day_photos"."taken_by_link_id" is null);--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_day_helper_check" CHECK ("events"."event_links"."audience"::text <> 'day_helper' or ("events"."event_links"."rubrics" = '{}'::text[] and "events"."event_links"."otp_required"));--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_phone_check" CHECK ("events"."event_links"."phone" is null or char_length("events"."event_links"."phone") between 1 and 40);
--> statement-breakpoint
ALTER TABLE "events"."event_team_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_team_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_team_members"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Lot 39a (DAT-03, ADR 0073) : la ligne d'un évènement à la corbeille est cachée avec lui.
CREATE POLICY event_visibility ON "events"."event_team_members" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_team_members.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_team_members" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_team_members_stamp" BEFORE INSERT OR UPDATE ON "events"."event_team_members"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_team_members_journal_deletion" BEFORE DELETE ON "events"."event_team_members"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
