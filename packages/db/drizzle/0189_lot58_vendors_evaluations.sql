-- Lot 58 (PRE-08 ; ADR 0097) : évaluation d'un prestataire après un évènement (note de 1 à 5, trois
-- critères facultatifs, commentaire), toujours interne à l'organisation. Schéma vendors seulement.
-- Ajout seul : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "vendors"."vendor_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"punctuality" integer,
	"quality" integer,
	"value" integer,
	"comment" text,
	"evaluated_by" uuid,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_evaluations_vendor_event_key" UNIQUE("vendor_id","event_id"),
	CONSTRAINT "vendor_evaluations_rating_check" CHECK ("vendors"."vendor_evaluations"."rating" between 1 and 5),
	CONSTRAINT "vendor_evaluations_criteria_check" CHECK (("vendors"."vendor_evaluations"."punctuality" is null or "vendors"."vendor_evaluations"."punctuality" between 1 and 5) and ("vendors"."vendor_evaluations"."quality" is null or "vendors"."vendor_evaluations"."quality" between 1 and 5) and ("vendors"."vendor_evaluations"."value" is null or "vendors"."vendor_evaluations"."value" between 1 and 5)),
	CONSTRAINT "vendor_evaluations_comment_check" CHECK ("vendors"."vendor_evaluations"."comment" is null or char_length("vendors"."vendor_evaluations"."comment") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_evaluations" ADD CONSTRAINT "vendor_evaluations_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_evaluations_organization_idx" ON "vendors"."vendor_evaluations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_evaluations_event_idx" ON "vendors"."vendor_evaluations" USING btree ("event_id");
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées.
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_evaluations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_evaluations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_evaluations"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_evaluations" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_evaluations_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_evaluations"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_evaluations_journal_deletion" BEFORE DELETE ON "vendors"."vendor_evaluations"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
