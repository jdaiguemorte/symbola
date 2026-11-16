-- Lot 37a (DOC-01, DOC-04, POR-04, POR-10 ; D3, D4, D6, D7 ; ADR 0070) : espace documents d'un
-- évènement. Dossiers (un niveau), versions des documents déposés, partage avec les clients et les
-- prestataires (rien par défaut), liens de partage à durée limitée. Schéma events seulement ;
-- compatible avec l'image du lot 36b (tables et colonnes nouvelles, valeurs par défaut).
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'document_link_opened';--> statement-breakpoint
CREATE TABLE "events"."event_document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_document_folders_name_check" CHECK (char_length("events"."event_document_folders"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "events"."event_document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_document_links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "event_document_links_open_count_check" CHECK ("events"."event_document_links"."open_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "events"."event_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_document_versions_unique" UNIQUE("document_id","version"),
	CONSTRAINT "event_document_versions_version_check" CHECK ("events"."event_document_versions"."version" >= 1),
	CONSTRAINT "event_document_versions_size_check" CHECK ("events"."event_document_versions"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD COLUMN "shared_with_clients" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD COLUMN "shared_with_vendors" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_document_folders" ADD CONSTRAINT "event_document_folders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_document_links" ADD CONSTRAINT "event_document_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_document_links" ADD CONSTRAINT "event_document_links_document_id_event_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "events"."event_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_document_versions" ADD CONSTRAINT "event_document_versions_document_id_event_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "events"."event_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_document_folders_organization_idx" ON "events"."event_document_folders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_document_folders_event_idx" ON "events"."event_document_folders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_document_links_organization_idx" ON "events"."event_document_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_document_links_document_idx" ON "events"."event_document_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "event_document_versions_organization_idx" ON "events"."event_document_versions" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD CONSTRAINT "event_documents_folder_id_event_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "events"."event_document_folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Reprise : chaque document déjà déposé devient sa version 1, sans dossier (« Divers »), non partagé.
INSERT INTO "events"."event_document_versions" ("organization_id", "document_id", "version", "file_key", "mime", "size_bytes", "uploaded_by_user_id", "created_at", "updated_at")
SELECT "organization_id", "id", 1, "file_key", "mime", "size_bytes", "uploaded_by_user_id", "created_at", "created_at"
FROM "events"."event_documents";
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_document_folders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_document_folders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_document_folders"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_document_folders" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."event_document_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_document_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_document_versions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_document_versions" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."event_document_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_document_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_document_links"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_document_links" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "event_document_folders_stamp" BEFORE INSERT OR UPDATE ON "events"."event_document_folders"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_document_folders_journal_deletion" BEFORE DELETE ON "events"."event_document_folders"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_document_versions_stamp" BEFORE INSERT OR UPDATE ON "events"."event_document_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_document_versions_journal_deletion" BEFORE DELETE ON "events"."event_document_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_document_links_stamp" BEFORE INSERT OR UPDATE ON "events"."event_document_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_document_links_journal_deletion" BEFORE DELETE ON "events"."event_document_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
