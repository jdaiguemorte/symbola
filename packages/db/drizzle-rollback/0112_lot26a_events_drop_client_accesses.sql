-- Annulation de 0112 (lot 26a) : la table des invitations des mariés revient,
-- vide (les invitations supprimées ne reviennent pas).
CREATE TABLE "events"."event_client_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"token_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_client_accesses_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" ADD CONSTRAINT "event_client_accesses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_client_accesses_organization_idx" ON "events"."event_client_accesses" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_client_accesses"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_client_accesses" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_client_accesses_stamp" BEFORE INSERT OR UPDATE ON "events"."event_client_accesses"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_client_accesses_journal_deletion" BEFORE DELETE ON "events"."event_client_accesses"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
