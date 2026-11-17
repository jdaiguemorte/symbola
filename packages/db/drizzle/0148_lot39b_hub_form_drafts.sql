-- Lot 39b (UX-09 ; D7 ; ADR 0074) : brouillons des formulaires, par personne et par formulaire, repris
-- sur tout appareil ; effacés à l'enregistrement, purgés au bout de 30 jours. Schéma hub seulement ;
-- table nouvelle, technique (ni auteur ni journal : chaque frappe la réécrit).
CREATE TABLE "hub"."form_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"form_key" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_drafts_form_key_check" CHECK ("hub"."form_drafts"."form_key" ~ '^[a-z][a-z0-9-]{0,40}(:[0-9a-f-]{36})?$'),
	CONSTRAINT "form_drafts_content_check" CHECK (jsonb_typeof("hub"."form_drafts"."content") = 'object' and pg_column_size("hub"."form_drafts"."content") <= 65536)
);
--> statement-breakpoint
ALTER TABLE "hub"."form_drafts" ADD CONSTRAINT "form_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_drafts_person_form_idx" ON "hub"."form_drafts" USING btree ("organization_id","user_id","form_key");--> statement-breakpoint
CREATE INDEX "form_drafts_organization_idx" ON "hub"."form_drafts" USING btree ("organization_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). La personne
-- est vérifiée par l'app (user_id de la session) ; la base garantit l'organisation.
ALTER TABLE "hub"."form_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."form_drafts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."form_drafts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."form_drafts" TO symbola_app;
