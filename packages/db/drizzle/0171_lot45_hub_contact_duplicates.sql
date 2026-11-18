-- Lot 45 (CRM-07 ; D4, D5 ; ADR 0090) : doublons de contacts. Schéma hub seulement : paires de
-- contacts qui se ressemblent (contact_duplicates, même adresse e-mail ou même téléphone normalisés),
-- montrées à la planner, jamais fusionnées seules ; trace des fusions (contact_merges : qui, quand,
-- quelles fiches, noms des champs repris, sans valeur). Ajout seul : compatible avec la version
-- précédente du code (ARC-14).
CREATE TABLE "hub"."contact_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_contact_id" uuid NOT NULL,
	"second_contact_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone,
	"dismissed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contact_duplicates_order_check" CHECK ("hub"."contact_duplicates"."first_contact_id" < "hub"."contact_duplicates"."second_contact_id"),
	CONSTRAINT "contact_duplicates_reason_check" CHECK ("hub"."contact_duplicates"."reason" in ('email', 'phone'))
);
--> statement-breakpoint
CREATE TABLE "hub"."contact_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kept_contact_id" uuid NOT NULL,
	"absorbed_contact_id" uuid NOT NULL,
	"fields_from_absorbed" text[] DEFAULT '{}'::text[] NOT NULL,
	"merged_by_user_id" uuid,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contact_merges_distinct_check" CHECK ("hub"."contact_merges"."kept_contact_id" <> "hub"."contact_merges"."absorbed_contact_id")
);
--> statement-breakpoint
ALTER TABLE "hub"."contact_duplicates" ADD CONSTRAINT "contact_duplicates_first_contact_id_contacts_id_fk" FOREIGN KEY ("first_contact_id") REFERENCES "hub"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."contact_duplicates" ADD CONSTRAINT "contact_duplicates_second_contact_id_contacts_id_fk" FOREIGN KEY ("second_contact_id") REFERENCES "hub"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_duplicates_organization_idx" ON "hub"."contact_duplicates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_duplicates_second_idx" ON "hub"."contact_duplicates" USING btree ("second_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_duplicates_pair_idx" ON "hub"."contact_duplicates" USING btree ("first_contact_id","second_contact_id");--> statement-breakpoint
CREATE INDEX "contact_merges_organization_idx" ON "hub"."contact_merges" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_merges_absorbed_idx" ON "hub"."contact_merges" USING btree ("absorbed_contact_id");--> statement-breakpoint
CREATE INDEX "contact_merges_kept_idx" ON "hub"."contact_merges" USING btree ("kept_contact_id");
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées.
--> statement-breakpoint
ALTER TABLE "hub"."contact_duplicates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."contact_duplicates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."contact_duplicates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."contact_duplicates" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contact_duplicates_stamp" BEFORE INSERT OR UPDATE ON "hub"."contact_duplicates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contact_duplicates_journal_deletion" BEFORE DELETE ON "hub"."contact_duplicates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
-- Lot 39a (ADR 0073) : une paire dont un contact est à la corbeille est cachée avec lui.
CREATE POLICY contact_visibility ON "hub"."contact_duplicates" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "hub"."contacts" p WHERE p.id = contact_duplicates.first_contact_id) AND EXISTS (SELECT 1 FROM "hub"."contacts" q WHERE q.id = contact_duplicates.second_contact_id));
--> statement-breakpoint
ALTER TABLE "hub"."contact_merges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."contact_merges" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."contact_merges"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."contact_merges" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contact_merges_stamp" BEFORE INSERT OR UPDATE ON "hub"."contact_merges"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contact_merges_journal_deletion" BEFORE DELETE ON "hub"."contact_merges"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
