-- Lot 49 (EVT-04 premier pas, INV-02, INV-03 ; D2, D5 ; ADR 0081) : temps forts de l'évènement
-- (events.key_moments), gérés depuis la fiche, et rubrique « Invités » du portail (fermée par
-- défaut, POR-10). Schéma events seulement ; ajout seul (table nouvelle, contrainte élargie) :
-- compatible avec la version précédente du code (ARC-14).
CREATE TABLE "events"."key_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"place_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "key_moments_name_check" CHECK (char_length("events"."key_moments"."name") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";--> statement-breakpoint
ALTER TABLE "events"."key_moments" ADD CONSTRAINT "key_moments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."key_moments" ADD CONSTRAINT "key_moments_place_id_event_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "events"."event_places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "key_moments_organization_idx" ON "events"."key_moments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "key_moments_event_idx" ON "events"."key_moments" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests']::text[]);
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."key_moments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."key_moments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."key_moments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Lot 39a (DAT-03, ADR 0073) : une ligne marquée est cachée, et le contenu d'un évènement supprimé
-- est caché avec lui.
CREATE POLICY soft_delete_visibility ON "events"."key_moments" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."key_moments" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = key_moments.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."key_moments" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "key_moments_stamp" BEFORE INSERT OR UPDATE ON "events"."key_moments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "key_moments_journal_deletion" BEFORE DELETE ON "events"."key_moments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
