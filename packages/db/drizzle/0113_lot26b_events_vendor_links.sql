-- Lot 26b (POR-01, SEC-14 ; décisions D6 et D9, ADR 0053) : lien personnel d'un
-- prestataire, qui désigne son prestataire consulté sur l'événement (retirer le
-- prestataire retire le lien) ; code à usage unique demandé à l'ouverture d'un
-- lien qui l'exige. Seul le haché du code est gardé (dix minutes, cinq essais,
-- un usage) ; c'est un jeton technique, comme les sessions de lien.
ALTER TABLE "events"."event_links" ADD COLUMN "vendor_candidate_id" uuid;
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD COLUMN "otp_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_vendor_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("vendor_candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_vendor_candidate_check" CHECK ("events"."event_links"."audience" <> 'vendor' or "events"."event_links"."vendor_candidate_id" is not null);
--> statement-breakpoint
CREATE INDEX "event_links_vendor_candidate_idx" ON "events"."event_links" USING btree ("vendor_candidate_id");
--> statement-breakpoint
CREATE TABLE "events"."event_link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events"."event_link_codes" ADD CONSTRAINT "event_link_codes_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_link_codes_organization_idx" ON "events"."event_link_codes" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_link_codes_link_idx" ON "events"."event_link_codes" USING btree ("link_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_link_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_link_codes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_link_codes"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_link_codes" TO symbola_app;
