-- Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17 ; ADR 0053) : liens
-- personnels des tiers. Un lien = une personne, un événement, des droits
-- (rubriques du portail, budget entier ou catégories choisies) ; jeton haché,
-- expiration calculée ou choisie, retrait. Les sessions ouvertes par un lien
-- gardent le seul haché de leur cookie. Les coches d'un tiers ont pour auteur
-- son lien (event_activities.actor_link_id).
CREATE TYPE "events"."event_link_audience" AS ENUM('client', 'vendor', 'guest');
--> statement-breakpoint
CREATE TABLE "events"."event_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"audience" "events"."event_link_audience" NOT NULL,
	"person_name" text NOT NULL,
	"email" text NOT NULL,
	"event_client_id" uuid,
	"rubrics" text[] DEFAULT '{}'::text[] NOT NULL,
	"budget_scope" text DEFAULT 'all' NOT NULL,
	"custom_expires_on" date,
	"token_hash" text,
	"renewal_requested_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes']::text[]),
	CONSTRAINT "event_links_budget_scope_check" CHECK ("events"."event_links"."budget_scope" in ('all', 'selected'))
);
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_event_client_id_event_clients_id_fk" FOREIGN KEY ("event_client_id") REFERENCES "events"."event_clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_links_organization_idx" ON "events"."event_links" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_links_event_idx" ON "events"."event_links" USING btree ("event_id");
--> statement-breakpoint
CREATE TABLE "events"."event_link_shared_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"vendor_slot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_link_shared_slots_link_slot_unique" UNIQUE("link_id","vendor_slot_id")
);
--> statement-breakpoint
ALTER TABLE "events"."event_link_shared_slots" ADD CONSTRAINT "event_link_shared_slots_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_link_shared_slots" ADD CONSTRAINT "event_link_shared_slots_vendor_slot_id_event_vendor_slots_id_fk" FOREIGN KEY ("vendor_slot_id") REFERENCES "events"."event_vendor_slots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_link_shared_slots_organization_idx" ON "events"."event_link_shared_slots" USING btree ("organization_id");
--> statement-breakpoint
CREATE TABLE "events"."event_link_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_link_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "events"."event_link_sessions" ADD CONSTRAINT "event_link_sessions_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_link_sessions_organization_idx" ON "events"."event_link_sessions" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "events"."event_activities" ALTER COLUMN "actor_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD COLUMN "actor_link_id" uuid;
--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD CONSTRAINT "event_activities_actor_link_id_event_links_id_fk" FOREIGN KEY ("actor_link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_links"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_links" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."event_link_shared_slots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_link_shared_slots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_link_shared_slots"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_link_shared_slots" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."event_link_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_link_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_link_sessions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_link_sessions" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
-- Les sessions sont des jetons techniques (packages/db/src/row-stamps.ts).
CREATE TRIGGER "event_links_stamp" BEFORE INSERT OR UPDATE ON "events"."event_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_links_journal_deletion" BEFORE DELETE ON "events"."event_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_link_shared_slots_stamp" BEFORE INSERT OR UPDATE ON "events"."event_link_shared_slots"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_link_shared_slots_journal_deletion" BEFORE DELETE ON "events"."event_link_shared_slots"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
