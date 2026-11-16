-- Lot 37b (CHR-07, DAT-14 ; D8, D9, D10, D11 ; ADR 0071) : versions diffusées du programme du jour J.
-- « Diffuser » fige une copie numérotée des séquences, sans note interne ; clients et prestataires
-- lisent la dernière version diffusée. Chaque lien personnel retient la dernière version vue.
-- Schéma events seulement ; compatible avec l'image du lot 37a (table et colonne nouvelles).
CREATE TABLE "events"."program_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by_user_id" uuid,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "program_versions_event_number_unique" UNIQUE("event_id","number"),
	CONSTRAINT "program_versions_number_check" CHECK ("events"."program_versions"."number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD COLUMN "program_version_seen" integer;--> statement-breakpoint
ALTER TABLE "events"."program_versions" ADD CONSTRAINT "program_versions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_versions_organization_idx" ON "events"."program_versions" USING btree ("organization_id");
--> statement-breakpoint
-- Reprise : le programme que les clients et les prestataires voyaient jusqu'ici (en direct) devient
-- sa version 1, datée de sa dernière modification, sans auteur ; ses liens l'ont déjà vue. Ainsi
-- personne ne perd le programme au déploiement, et rien n'est signalé comme nouveau.
INSERT INTO "events"."program_versions" ("organization_id", "event_id", "number", "published_at", "items", "created_at", "updated_at")
SELECT e."organization_id", e."id", 1, coalesce(e."program_updated_at", now()),
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pi."id",
        'startTime', to_char(pi."start_time", 'HH24:MI'),
        'endTime', CASE WHEN pi."end_time" IS NULL THEN NULL ELSE to_char(pi."end_time", 'HH24:MI') END,
        'label', pi."label",
        'location', pi."location",
        'responsible', pi."responsible",
        'participants', coalesce((
          SELECT jsonb_agg(jsonb_build_object('vendorSlotId', pp."vendor_slot_id", 'label', coalesce(vs."label", pp."free_label", '')) ORDER BY pp."position")
          FROM "events"."program_item_participants" pp
          LEFT JOIN "events"."event_vendor_slots" vs ON vs."id" = pp."vendor_slot_id"
          WHERE pp."program_item_id" = pi."id"
        ), '[]'::jsonb)
      )
      ORDER BY pi."start_time", pi."created_at"
    )
    FROM "events"."program_items" pi
    WHERE pi."event_id" = e."id"
  ),
  now(), now()
FROM "events"."events" e
WHERE EXISTS (SELECT 1 FROM "events"."program_items" pi WHERE pi."event_id" = e."id");
--> statement-breakpoint
UPDATE "events"."event_links" l SET "program_version_seen" = 1
WHERE EXISTS (SELECT 1 FROM "events"."program_versions" v WHERE v."event_id" = l."event_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Une version ne
-- se modifie pas : ni UPDATE pour l'app ; la suppression sert à l'oubli (RGPD-03).
ALTER TABLE "events"."program_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."program_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."program_versions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "events"."program_versions" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "program_versions_stamp" BEFORE INSERT OR UPDATE ON "events"."program_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "program_versions_journal_deletion" BEFORE DELETE ON "events"."program_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
