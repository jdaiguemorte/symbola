CREATE TABLE "core"."audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"actor_kind" text DEFAULT coalesce(nullif(current_setting('app.actor_kind', true), ''), 'system') NOT NULL,
	"actor_id" uuid DEFAULT nullif(current_setting('app.actor_id', true), '')::uuid,
	"action" text NOT NULL,
	"category" text NOT NULL,
	"object_type" text,
	"object_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "audit_entries_actor_kind_check" CHECK ("core"."audit_entries"."actor_kind" in ('member', 'admin', 'operator', 'system')),
	CONSTRAINT "audit_entries_category_check" CHECK ("core"."audit_entries"."category" in ('connexion', 'droits', 'export', 'partage', 'emission', 'encaissement', 'suppression', 'exploitation', 'administration')),
	CONSTRAINT "audit_entries_operations_reason_check" CHECK ("core"."audit_entries"."category" <> 'exploitation' or length(trim("core"."audit_entries"."reason")) > 0)
);
--> statement-breakpoint
CREATE INDEX "audit_entries_organization_time_idx" ON "core"."audit_entries" USING btree ("organization_id","occurred_at");--> statement-breakpoint
-- Lot 23 (ARC-16, SEC-19, ADR 0060) : journal d'audit commun, en ajout seul.
-- RLS forcée : une organisation lit ses lignes et les accès d'exploitation
-- de la plateforme (organization_id vide, catégorie « exploitation ») ; elle
-- n'écrit que dans son journal ou dans celui de la plateforme. nullif : un
-- paramètre jamais fixé vaut '' dans une connexion déjà servie.
ALTER TABLE "core"."audit_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "core"."audit_entries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_entries_read ON "core"."audit_entries" FOR SELECT
  USING (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR (organization_id IS NULL AND category = 'exploitation')
  );
--> statement-breakpoint
CREATE POLICY audit_entries_write ON "core"."audit_entries" FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
  );
--> statement-breakpoint
CREATE POLICY audit_entries_demo_purge ON "core"."audit_entries" FOR DELETE
  USING (is_demo AND organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
GRANT USAGE ON SCHEMA "core" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "core"."audit_entries" TO symbola_app;
--> statement-breakpoint
-- Ajout seul, pour tout rôle, propriétaire compris : seule la purge d'une
-- ligne d'essai guidé passe (comme les factures fictives, 0042).
CREATE OR REPLACE FUNCTION "core"."forbid_audit_entry_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- IF imbriqués : un déclencheur TRUNCATE (par instruction) n'a pas d'OLD.
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_demo THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'journal d''audit en ajout seul (%)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_entries_append_only BEFORE UPDATE OR DELETE ON "core"."audit_entries"
  FOR EACH ROW EXECUTE FUNCTION "core"."forbid_audit_entry_change"();
--> statement-breakpoint
CREATE TRIGGER audit_entries_no_truncate BEFORE TRUNCATE ON "core"."audit_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "core"."forbid_audit_entry_change"();
