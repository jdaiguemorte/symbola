-- Lot 50 (INV-05, INV-06 ; D1 à D8 ; ADR 0086) : plan de table et synthèse pour le traiteur, dans le
-- schéma du module Invités (ADR 0083). Types de repas de l'organisation (données de départ
-- meal-types.json) et type choisi d'un invité ; un plan par temps fort à table, ses tables (forme,
-- capacité), les places (une par invité et par plan, à une table du même plan : référence composée),
-- les contraintes « ensemble » et « séparés » (internes, jamais exportées), les repas des
-- prestataires (un nombre par temps fort) et la trace des téléchargements de la synthèse (sans son
-- contenu). Les évènements et temps forts sont désignés sans clé étrangère entre schémas (avenant de
-- l'ADR 0012). Ajout seul : tables nouvelles et une colonne facultative, compatibles avec la version
-- précédente du code (ARC-14).
CREATE TABLE "guests"."caterer_summary_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"key_moment_id" uuid NOT NULL,
	"version" text NOT NULL,
	"format" text NOT NULL,
	"downloaded_by" uuid NOT NULL,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "caterer_summary_downloads_version_check" CHECK ("guests"."caterer_summary_downloads"."version" in ('nominative', 'aggregate')),
	CONSTRAINT "caterer_summary_downloads_format_check" CHECK ("guests"."caterer_summary_downloads"."format" in ('pdf', 'csv'))
);
--> statement-breakpoint
CREATE TABLE "guests"."meal_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"starter_key" text,
	"label" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "meal_types_starter_unique" UNIQUE("organization_id","starter_key"),
	CONSTRAINT "meal_types_label_check" CHECK (("guests"."meal_types"."starter_key" is not null or "guests"."meal_types"."label" is not null) and ("guests"."meal_types"."label" is null or char_length("guests"."meal_types"."label") between 1 and 60))
);
--> statement-breakpoint
CREATE TABLE "guests"."seat_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"table_id" uuid,
	"guest_id" uuid NOT NULL,
	"released_at" timestamp with time zone,
	"released_table_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "seat_assignments_plan_guest_unique" UNIQUE("plan_id","guest_id"),
	CONSTRAINT "seat_assignments_state_check" CHECK (("guests"."seat_assignments"."released_at" is null and "guests"."seat_assignments"."table_id" is not null) or ("guests"."seat_assignments"."released_at" is not null and "guests"."seat_assignments"."table_id" is null)),
	CONSTRAINT "seat_assignments_released_name_check" CHECK ("guests"."seat_assignments"."released_table_name" is null or char_length("guests"."seat_assignments"."released_table_name") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "guests"."seating_constraint_members" (
	"organization_id" uuid NOT NULL,
	"constraint_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "seating_constraint_members_pk" PRIMARY KEY("constraint_id","guest_id")
);
--> statement-breakpoint
CREATE TABLE "guests"."seating_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "seating_constraints_kind_check" CHECK ("guests"."seating_constraints"."kind" in ('together', 'apart'))
);
--> statement-breakpoint
CREATE TABLE "guests"."seating_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"key_moment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "seating_plans_moment_unique" UNIQUE("key_moment_id")
);
--> statement-breakpoint
CREATE TABLE "guests"."seating_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"shape" text NOT NULL,
	"capacity" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "seating_tables_id_plan_unique" UNIQUE("id","plan_id"),
	CONSTRAINT "seating_tables_name_check" CHECK (char_length(btrim("guests"."seating_tables"."name")) between 1 and 60),
	CONSTRAINT "seating_tables_shape_check" CHECK ("guests"."seating_tables"."shape" in ('round', 'rectangular', 'head')),
	CONSTRAINT "seating_tables_capacity_check" CHECK ("guests"."seating_tables"."capacity" between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "guests"."vendor_meal_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"key_moment_id" uuid NOT NULL,
	"meal_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_meal_counts_moment_unique" UNIQUE("key_moment_id"),
	CONSTRAINT "vendor_meal_counts_count_check" CHECK ("guests"."vendor_meal_counts"."meal_count" between 0 and 1000)
);
--> statement-breakpoint
ALTER TABLE "guests"."guests" ADD COLUMN "meal_type_id" uuid;--> statement-breakpoint
ALTER TABLE "guests"."seat_assignments" ADD CONSTRAINT "seat_assignments_plan_id_seating_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "guests"."seating_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."seat_assignments" ADD CONSTRAINT "seat_assignments_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "guests"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."seat_assignments" ADD CONSTRAINT "seat_assignments_table_fk" FOREIGN KEY ("table_id","plan_id") REFERENCES "guests"."seating_tables"("id","plan_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."seating_constraint_members" ADD CONSTRAINT "seating_constraint_members_constraint_id_seating_constraints_id_fk" FOREIGN KEY ("constraint_id") REFERENCES "guests"."seating_constraints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."seating_constraint_members" ADD CONSTRAINT "seating_constraint_members_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "guests"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."seating_constraints" ADD CONSTRAINT "seating_constraints_plan_id_seating_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "guests"."seating_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."seating_tables" ADD CONSTRAINT "seating_tables_plan_id_seating_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "guests"."seating_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "caterer_summary_downloads_organization_idx" ON "guests"."caterer_summary_downloads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "caterer_summary_downloads_event_idx" ON "guests"."caterer_summary_downloads" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "meal_types_organization_idx" ON "guests"."meal_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seat_assignments_organization_idx" ON "guests"."seat_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seat_assignments_table_idx" ON "guests"."seat_assignments" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "seat_assignments_guest_idx" ON "guests"."seat_assignments" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "seating_constraint_members_organization_idx" ON "guests"."seating_constraint_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seating_constraint_members_guest_idx" ON "guests"."seating_constraint_members" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "seating_constraints_organization_idx" ON "guests"."seating_constraints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seating_constraints_plan_idx" ON "guests"."seating_constraints" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "seating_plans_organization_idx" ON "guests"."seating_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seating_plans_event_idx" ON "guests"."seating_plans" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "seating_tables_organization_idx" ON "guests"."seating_tables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "seating_tables_plan_idx" ON "guests"."seating_tables" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "vendor_meal_counts_organization_idx" ON "guests"."vendor_meal_counts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_meal_counts_event_idx" ON "guests"."vendor_meal_counts" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "guests"."guests" ADD CONSTRAINT "guests_meal_type_id_meal_types_id_fk" FOREIGN KEY ("meal_type_id") REFERENCES "guests"."meal_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."meal_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."meal_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."meal_types"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."meal_types" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."seating_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."seating_plans" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."seating_plans"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."seating_plans" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."seating_tables" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."seating_tables" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."seating_tables"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."seating_tables" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."seat_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."seat_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."seat_assignments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."seat_assignments" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."seating_constraints" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."seating_constraints" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."seating_constraints"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."seating_constraints" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."seating_constraint_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."seating_constraint_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."seating_constraint_members"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."seating_constraint_members" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."vendor_meal_counts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."vendor_meal_counts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."vendor_meal_counts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."vendor_meal_counts" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."caterer_summary_downloads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."caterer_summary_downloads" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."caterer_summary_downloads"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."caterer_summary_downloads" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées (une purge en
-- masse écrit sa ligne de synthèse, app.audit_bulk).
CREATE TRIGGER "meal_types_stamp" BEFORE INSERT OR UPDATE ON "guests"."meal_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "meal_types_journal_deletion" BEFORE DELETE ON "guests"."meal_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "seating_plans_stamp" BEFORE INSERT OR UPDATE ON "guests"."seating_plans"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "seating_plans_journal_deletion" BEFORE DELETE ON "guests"."seating_plans"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "seating_tables_stamp" BEFORE INSERT OR UPDATE ON "guests"."seating_tables"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "seating_tables_journal_deletion" BEFORE DELETE ON "guests"."seating_tables"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "seat_assignments_stamp" BEFORE INSERT OR UPDATE ON "guests"."seat_assignments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "seat_assignments_journal_deletion" BEFORE DELETE ON "guests"."seat_assignments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "seating_constraints_stamp" BEFORE INSERT OR UPDATE ON "guests"."seating_constraints"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "seating_constraints_journal_deletion" BEFORE DELETE ON "guests"."seating_constraints"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "seating_constraint_members_stamp" BEFORE INSERT OR UPDATE ON "guests"."seating_constraint_members"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "seating_constraint_members_journal_deletion" BEFORE DELETE ON "guests"."seating_constraint_members"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "vendor_meal_counts_stamp" BEFORE INSERT OR UPDATE ON "guests"."vendor_meal_counts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_meal_counts_journal_deletion" BEFORE DELETE ON "guests"."vendor_meal_counts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "caterer_summary_downloads_stamp" BEFORE INSERT OR UPDATE ON "guests"."caterer_summary_downloads"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "caterer_summary_downloads_journal_deletion" BEFORE DELETE ON "guests"."caterer_summary_downloads"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
