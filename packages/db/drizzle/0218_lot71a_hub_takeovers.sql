-- Lot 71a (HUB-14, PAR-01, UX-02 ; spécification du lot 71 validée par Julien le 27/11/2026, § 4.1 ;
-- ADR 0119) : la reprise d'un mariage en cours.
-- - hub.takeovers : une page de reprise par mariage (event_id nul tant que le mariage n'existe pas ;
--   identifiant contrôlé par le service des évènements, sans clé étrangère entre schémas).
-- - hub.takeover_steps : ses six lignes (carnet, mariage, budget, prestataires retenus, liste
--   « à faire », programme), chacune « à faire », « en cours », « faite », « pas de fichier » ou
--   « avec le budget », et l'import qui la remplit.
-- Aucune donnée personnelle (identifiants, dates, états). RLS forcée.
-- Compatible avec l'image précédente : deux tables nouvelles, que l'ancien code ignore (ARC-14).
CREATE TABLE "hub"."takeover_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"takeover_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'todo' NOT NULL,
	"import_id" uuid,
	"covered_by_step_id" uuid,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "takeover_steps_kind_check" CHECK ("hub"."takeover_steps"."kind" in ('vendor_book', 'event', 'budget', 'event_vendors', 'tasks', 'program')),
	CONSTRAINT "takeover_steps_state_check" CHECK ("hub"."takeover_steps"."state" in ('todo', 'in_progress', 'done', 'no_file', 'covered')),
	CONSTRAINT "takeover_steps_covered_check" CHECK (("hub"."takeover_steps"."state" = 'covered') = ("hub"."takeover_steps"."covered_by_step_id" is not null)),
	CONSTRAINT "takeover_steps_decided_check" CHECK (("hub"."takeover_steps"."state" = 'todo') or "hub"."takeover_steps"."decided_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "hub"."takeovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid,
	"completed_at" timestamp with time zone,
	"checklist_closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "hub"."takeover_steps" ADD CONSTRAINT "takeover_steps_takeover_id_takeovers_id_fk" FOREIGN KEY ("takeover_id") REFERENCES "hub"."takeovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."takeover_steps" ADD CONSTRAINT "takeover_steps_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "hub"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."takeover_steps" ADD CONSTRAINT "takeover_steps_covered_by_step_id_takeover_steps_id_fk" FOREIGN KEY ("covered_by_step_id") REFERENCES "hub"."takeover_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "takeover_steps_organization_idx" ON "hub"."takeover_steps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "takeover_steps_import_idx" ON "hub"."takeover_steps" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "takeover_steps_kind_idx" ON "hub"."takeover_steps" USING btree ("takeover_id","kind");--> statement-breakpoint
CREATE INDEX "takeovers_organization_event_idx" ON "hub"."takeovers" USING btree ("organization_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "takeovers_event_idx" ON "hub"."takeovers" USING btree ("organization_id","event_id") WHERE event_id is not null;

--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). La reprise ne
-- s'efface qu'avec son mariage (lot 71d, « Retirer toute la reprise… ») ou l'organisation.
ALTER TABLE "hub"."takeovers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."takeovers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."takeovers"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "hub"."takeover_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."takeover_steps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."takeover_steps"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."takeovers" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."takeover_steps" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "takeovers_stamp" BEFORE INSERT OR UPDATE ON "hub"."takeovers"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "takeovers_journal_deletion" BEFORE DELETE ON "hub"."takeovers"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "takeover_steps_stamp" BEFORE INSERT OR UPDATE ON "hub"."takeover_steps"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "takeover_steps_journal_deletion" BEFORE DELETE ON "hub"."takeover_steps"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
