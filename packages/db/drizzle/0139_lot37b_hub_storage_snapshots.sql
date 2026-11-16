-- Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) : relevé mensuel du stockage par organisation et par nature
-- (nombre de fichiers, volume), gardé d'un mois sur l'autre ; et la taille du logo, pour ce relevé.
-- Schéma hub seulement ; compatible avec l'image du lot 37a (table et colonne nouvelles).
CREATE TABLE "hub"."storage_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month" date NOT NULL,
	"nature" text NOT NULL,
	"file_count" integer NOT NULL,
	"total_bytes" bigint NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "storage_snapshots_month_nature_unique" UNIQUE("organization_id","month","nature"),
	CONSTRAINT "storage_snapshots_nature_check" CHECK ("hub"."storage_snapshots"."nature" in ('legal_originals', 'signed_documents', 'uploads', 'images')),
	CONSTRAINT "storage_snapshots_month_check" CHECK (extract(day from "hub"."storage_snapshots"."month") = 1),
	CONSTRAINT "storage_snapshots_counts_check" CHECK ("hub"."storage_snapshots"."file_count" >= 0 and "hub"."storage_snapshots"."total_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "logo_size_bytes" integer;--> statement-breakpoint
CREATE INDEX "storage_snapshots_organization_idx" ON "hub"."storage_snapshots" USING btree ("organization_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Un relevé ne se
-- modifie ni ne se supprime : lecture et ajout seulement.
ALTER TABLE "hub"."storage_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."storage_snapshots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."storage_snapshots"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "hub"."storage_snapshots" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées (celles de
-- l'administration de la base : l'app ne supprime pas).
CREATE TRIGGER "storage_snapshots_stamp" BEFORE INSERT OR UPDATE ON "hub"."storage_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "storage_snapshots_journal_deletion" BEFORE DELETE ON "hub"."storage_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
