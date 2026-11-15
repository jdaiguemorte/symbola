-- Lot 36b (CRM-03, HUB-14 ; D2, D11 ; ADR 0069) : foyers et entreprises, et import de contacts.
-- Les membres d'un foyer ou d'une entreprise (hub.contact_members), les identifiants d'une
-- entreprise (SIREN ou SIRET, numéro de TVA), et la nature d'import « contacts ». Schéma hub
-- seulement ; compatible avec l'image du lot 36a (colonnes facultatives, table et valeur nouvelles).
ALTER TYPE "hub"."import_entity_type" ADD VALUE 'contacts';--> statement-breakpoint
CREATE TABLE "hub"."contact_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"group_contact_id" uuid NOT NULL,
	"member_contact_id" uuid NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contact_members_distinct_check" CHECK ("hub"."contact_members"."group_contact_id" <> "hub"."contact_members"."member_contact_id"),
	CONSTRAINT "contact_members_role_check" CHECK ("hub"."contact_members"."role" is null or char_length("hub"."contact_members"."role") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "hub"."contacts" ADD COLUMN "company_id_number" text;--> statement-breakpoint
ALTER TABLE "hub"."contacts" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "hub"."contact_members" ADD CONSTRAINT "contact_members_group_contact_id_contacts_id_fk" FOREIGN KEY ("group_contact_id") REFERENCES "hub"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."contact_members" ADD CONSTRAINT "contact_members_member_contact_id_contacts_id_fk" FOREIGN KEY ("member_contact_id") REFERENCES "hub"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_members_organization_idx" ON "hub"."contact_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_members_member_idx" ON "hub"."contact_members" USING btree ("member_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_members_pair_idx" ON "hub"."contact_members" USING btree ("group_contact_id","member_contact_id");--> statement-breakpoint
ALTER TABLE "hub"."contacts" ADD CONSTRAINT "contacts_company_ids_check" CHECK (("hub"."contacts"."kind" = 'company' or ("hub"."contacts"."company_id_number" is null and "hub"."contacts"."vat_number" is null)) and ("hub"."contacts"."company_id_number" is null or "hub"."contacts"."company_id_number" ~ '^[0-9]{9}([0-9]{5})?$') and ("hub"."contacts"."vat_number" is null or ("hub"."contacts"."vat_number" = upper(replace("hub"."contacts"."vat_number", ' ', '')) and "hub"."contacts"."vat_number" <> '')));

--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "hub"."contact_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."contact_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."contact_members"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."contact_members" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "contact_members_stamp" BEFORE INSERT OR UPDATE ON "hub"."contact_members"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contact_members_journal_deletion" BEFORE DELETE ON "hub"."contact_members"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
