-- Lot 60 (L60-PLA-01 à L60-PLA-05, prolongement de PRE-06 ; D1 ; ADR 0099) : le module Plans de salle,
-- dans son propre schéma (ADR 0012). Bibliothèque d'éléments, espaces des lieux du catalogue et des
-- évènements (fond de plan calibré), installations fixes, configurations nommées, éléments posés,
-- liaisons aux prises, versions diffusées et dernière version vue par un lien. Le lieu, l'évènement,
-- le prestataire retenu et le lien sont désignés sans clé étrangère entre schémas (avenant de
-- l'ADR 0012). Schéma nouveau : ajout seul, compatible avec la version précédente du code (ARC-14).
CREATE SCHEMA "floorplans";
--> statement-breakpoint
CREATE TABLE "floorplans"."element_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"starter_key" text,
	"label" text,
	"category" text NOT NULL,
	"shape" text NOT NULL,
	"seat_rule" text DEFAULT 'none' NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"power_outlets" integer DEFAULT 0 NOT NULL,
	"power_amps" integer,
	"needs_water" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "element_types_starter_unique" UNIQUE("organization_id","starter_key"),
	CONSTRAINT "element_types_label_check" CHECK (coalesce((("floorplans"."element_types"."starter_key" is not null and "floorplans"."element_types"."label" is null) or ("floorplans"."element_types"."starter_key" is null and char_length(btrim("floorplans"."element_types"."label")) between 1 and 60)), false)),
	CONSTRAINT "element_types_category_check" CHECK ("floorplans"."element_types"."category" in ('table', 'setup')),
	CONSTRAINT "element_types_shape_check" CHECK ("floorplans"."element_types"."shape" in ('circle', 'rect', 'ellipse')),
	CONSTRAINT "element_types_seat_rule_check" CHECK ("floorplans"."element_types"."seat_rule" in ('round', 'two_sides', 'one_side', 'four_sides', 'oval', 'none')),
	CONSTRAINT "element_types_size_check" CHECK ("floorplans"."element_types"."width_cm" between 10 and 10000 and "floorplans"."element_types"."depth_cm" between 10 and 10000),
	CONSTRAINT "element_types_power_check" CHECK ("floorplans"."element_types"."power_outlets" between 0 and 20 and ("floorplans"."element_types"."power_amps" is null or "floorplans"."element_types"."power_amps" between 1 and 125))
);
--> statement-breakpoint
CREATE TABLE "floorplans"."layout_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"layout_id" uuid NOT NULL,
	"element_type_id" uuid,
	"type_starter_key" text,
	"type_label" text,
	"category" text NOT NULL,
	"shape" text NOT NULL,
	"name" text,
	"x_cm" integer NOT NULL,
	"y_cm" integer NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"rotation_deg" integer DEFAULT 0 NOT NULL,
	"seats" integer DEFAULT 0 NOT NULL,
	"color" text,
	"note" text,
	"vendor_candidate_id" uuid,
	"power_outlets" integer DEFAULT 0 NOT NULL,
	"power_amps" integer,
	"needs_water" boolean DEFAULT false NOT NULL,
	"max_cable_m" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "layout_elements_type_check" CHECK (coalesce((("floorplans"."layout_elements"."type_starter_key" is not null and "floorplans"."layout_elements"."type_label" is null) or ("floorplans"."layout_elements"."type_starter_key" is null and char_length(btrim("floorplans"."layout_elements"."type_label")) between 1 and 60)), false)),
	CONSTRAINT "layout_elements_category_check" CHECK ("floorplans"."layout_elements"."category" in ('table', 'setup')),
	CONSTRAINT "layout_elements_shape_check" CHECK ("floorplans"."layout_elements"."shape" in ('circle', 'rect', 'ellipse')),
	CONSTRAINT "layout_elements_name_check" CHECK ("floorplans"."layout_elements"."name" is null or char_length(btrim("floorplans"."layout_elements"."name")) between 1 and 60),
	CONSTRAINT "layout_elements_note_check" CHECK ("floorplans"."layout_elements"."note" is null or char_length("floorplans"."layout_elements"."note") between 1 and 500),
	CONSTRAINT "layout_elements_color_check" CHECK ("floorplans"."layout_elements"."color" is null or "floorplans"."layout_elements"."color" in ('surface', 'primary-soft', 'attention-soft', 'critical-soft', 'ground', 'line')),
	CONSTRAINT "layout_elements_geometry_check" CHECK ("floorplans"."layout_elements"."x_cm" between -100000 and 200000 and "floorplans"."layout_elements"."y_cm" between -100000 and 200000 and "floorplans"."layout_elements"."width_cm" between 10 and 10000 and "floorplans"."layout_elements"."depth_cm" between 10 and 10000 and "floorplans"."layout_elements"."rotation_deg" between 0 and 359),
	CONSTRAINT "layout_elements_seats_check" CHECK ("floorplans"."layout_elements"."seats" between 0 and 500),
	CONSTRAINT "layout_elements_power_check" CHECK ("floorplans"."layout_elements"."power_outlets" between 0 and 20 and ("floorplans"."layout_elements"."power_amps" is null or "floorplans"."layout_elements"."power_amps" between 1 and 125) and ("floorplans"."layout_elements"."max_cable_m" is null or "floorplans"."layout_elements"."max_cable_m" between 1 and 500))
);
--> statement-breakpoint
CREATE TABLE "floorplans"."layout_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"layout_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"background_key" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "layout_versions_number_unique" UNIQUE("layout_id","version"),
	CONSTRAINT "layout_versions_version_check" CHECK ("floorplans"."layout_versions"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "floorplans"."layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"event_id" uuid,
	"source_layout_id" uuid,
	"name" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"published_version" integer DEFAULT 0 NOT NULL,
	"show_vendor_names" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "layouts_name_check" CHECK (char_length(btrim("floorplans"."layouts"."name")) between 1 and 80),
	CONSTRAINT "layouts_versions_check" CHECK ("floorplans"."layouts"."revision" >= 0 and "floorplans"."layouts"."published_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "floorplans"."link_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"layout_id" uuid NOT NULL,
	"seen_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "link_views_link_layout_unique" UNIQUE("link_id","layout_id"),
	CONSTRAINT "link_views_version_check" CHECK ("floorplans"."link_views"."seen_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "floorplans"."power_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"element_id" uuid NOT NULL,
	"fixture_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "power_links_element_unique" UNIQUE("element_id")
);
--> statement-breakpoint
CREATE TABLE "floorplans"."space_fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"source_fixture_id" uuid,
	"kind" text NOT NULL,
	"label" text,
	"x_cm" integer NOT NULL,
	"y_cm" integer NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"rotation_deg" integer DEFAULT 0 NOT NULL,
	"outlet_count" integer,
	"amps" integer,
	"three_phase" boolean DEFAULT false NOT NULL,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "space_fixtures_kind_check" CHECK ("floorplans"."space_fixtures"."kind" in ('outlet', 'water', 'door', 'emergency_exit', 'delivery', 'pillar', 'stage')),
	CONSTRAINT "space_fixtures_label_check" CHECK ("floorplans"."space_fixtures"."label" is null or char_length(btrim("floorplans"."space_fixtures"."label")) between 1 and 60),
	CONSTRAINT "space_fixtures_note_check" CHECK ("floorplans"."space_fixtures"."note" is null or char_length("floorplans"."space_fixtures"."note") between 1 and 500),
	CONSTRAINT "space_fixtures_geometry_check" CHECK ("floorplans"."space_fixtures"."x_cm" between -100000 and 200000 and "floorplans"."space_fixtures"."y_cm" between -100000 and 200000 and "floorplans"."space_fixtures"."width_cm" between 5 and 100000 and "floorplans"."space_fixtures"."depth_cm" between 5 and 100000 and "floorplans"."space_fixtures"."rotation_deg" between 0 and 359),
	CONSTRAINT "space_fixtures_outlet_check" CHECK (coalesce((("floorplans"."space_fixtures"."kind" = 'outlet' and "floorplans"."space_fixtures"."outlet_count" between 1 and 50 and "floorplans"."space_fixtures"."amps" between 1 and 125) or ("floorplans"."space_fixtures"."kind" <> 'outlet' and "floorplans"."space_fixtures"."outlet_count" is null and "floorplans"."space_fixtures"."amps" is null and not "floorplans"."space_fixtures"."three_phase")), false))
);
--> statement-breakpoint
CREATE TABLE "floorplans"."spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid,
	"event_id" uuid,
	"event_place_id" uuid,
	"source_space_id" uuid,
	"name" text NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"background_key" text,
	"background_mime" text,
	"background_size_bytes" integer,
	"background_width_px" integer,
	"background_height_px" integer,
	"calibration_ax" integer,
	"calibration_ay" integer,
	"calibration_bx" integer,
	"calibration_by" integer,
	"calibration_distance_cm" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "spaces_owner_check" CHECK ("floorplans"."spaces"."vendor_id" is not null or "floorplans"."spaces"."event_id" is not null),
	CONSTRAINT "spaces_name_check" CHECK (char_length(btrim("floorplans"."spaces"."name")) between 1 and 80),
	CONSTRAINT "spaces_size_check" CHECK ("floorplans"."spaces"."width_cm" between 100 and 100000 and "floorplans"."spaces"."depth_cm" between 100 and 100000),
	CONSTRAINT "spaces_background_check" CHECK (coalesce((("floorplans"."spaces"."background_key" is null and "floorplans"."spaces"."background_mime" is null and "floorplans"."spaces"."background_size_bytes" is null and "floorplans"."spaces"."background_width_px" is null and "floorplans"."spaces"."background_height_px" is null)
      or ("floorplans"."spaces"."background_key" is not null and "floorplans"."spaces"."background_mime" in ('image/png', 'image/jpeg', 'image/webp') and "floorplans"."spaces"."background_size_bytes" > 0 and "floorplans"."spaces"."background_width_px" > 0 and "floorplans"."spaces"."background_height_px" > 0)), false)),
	CONSTRAINT "spaces_calibration_check" CHECK (("floorplans"."spaces"."calibration_distance_cm" is null and "floorplans"."spaces"."calibration_ax" is null and "floorplans"."spaces"."calibration_ay" is null and "floorplans"."spaces"."calibration_bx" is null and "floorplans"."spaces"."calibration_by" is null)
      or ("floorplans"."spaces"."background_key" is not null and "floorplans"."spaces"."calibration_distance_cm" between 1 and 100000 and "floorplans"."spaces"."calibration_ax" is not null and "floorplans"."spaces"."calibration_ay" is not null and "floorplans"."spaces"."calibration_bx" is not null and "floorplans"."spaces"."calibration_by" is not null
        and ("floorplans"."spaces"."calibration_ax" <> "floorplans"."spaces"."calibration_bx" or "floorplans"."spaces"."calibration_ay" <> "floorplans"."spaces"."calibration_by")))
);
--> statement-breakpoint
ALTER TABLE "floorplans"."layout_elements" ADD CONSTRAINT "layout_elements_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "floorplans"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."layout_elements" ADD CONSTRAINT "layout_elements_element_type_id_element_types_id_fk" FOREIGN KEY ("element_type_id") REFERENCES "floorplans"."element_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."layout_versions" ADD CONSTRAINT "layout_versions_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "floorplans"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."layouts" ADD CONSTRAINT "layouts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "floorplans"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."link_views" ADD CONSTRAINT "link_views_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "floorplans"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."power_links" ADD CONSTRAINT "power_links_element_id_layout_elements_id_fk" FOREIGN KEY ("element_id") REFERENCES "floorplans"."layout_elements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."power_links" ADD CONSTRAINT "power_links_fixture_id_space_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "floorplans"."space_fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floorplans"."space_fixtures" ADD CONSTRAINT "space_fixtures_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "floorplans"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "element_types_organization_idx" ON "floorplans"."element_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "layout_elements_organization_idx" ON "floorplans"."layout_elements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "layout_elements_layout_idx" ON "floorplans"."layout_elements" USING btree ("layout_id");--> statement-breakpoint
CREATE INDEX "layout_versions_organization_idx" ON "floorplans"."layout_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "layouts_organization_idx" ON "floorplans"."layouts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "layouts_space_idx" ON "floorplans"."layouts" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "layouts_event_idx" ON "floorplans"."layouts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "link_views_organization_idx" ON "floorplans"."link_views" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "power_links_organization_idx" ON "floorplans"."power_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "power_links_fixture_idx" ON "floorplans"."power_links" USING btree ("fixture_id");--> statement-breakpoint
CREATE INDEX "space_fixtures_organization_idx" ON "floorplans"."space_fixtures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "space_fixtures_space_idx" ON "floorplans"."space_fixtures" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "spaces_organization_idx" ON "floorplans"."spaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "spaces_vendor_idx" ON "floorplans"."spaces" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "spaces_event_idx" ON "floorplans"."spaces" USING btree ("event_id");
--> statement-breakpoint
-- Le rôle applicatif lit le schéma ; il n'en est pas propriétaire (SEC-11).
GRANT USAGE ON SCHEMA "floorplans" TO symbola_app;
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées
-- (CLAUDE.md § 2.3, SEC-10, SEC-11, DAT-06, SEC-19).
--> statement-breakpoint
ALTER TABLE "floorplans"."element_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."element_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."element_types"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."element_types" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "element_types_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."element_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "element_types_journal_deletion" BEFORE DELETE ON "floorplans"."element_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."spaces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."spaces" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."spaces"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."spaces" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "spaces_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."spaces"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "spaces_journal_deletion" BEFORE DELETE ON "floorplans"."spaces"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."space_fixtures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."space_fixtures" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."space_fixtures"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."space_fixtures" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "space_fixtures_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."space_fixtures"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "space_fixtures_journal_deletion" BEFORE DELETE ON "floorplans"."space_fixtures"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."layouts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."layouts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."layouts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."layouts" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "layouts_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."layouts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "layouts_journal_deletion" BEFORE DELETE ON "floorplans"."layouts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."layout_elements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."layout_elements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."layout_elements"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."layout_elements" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "layout_elements_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."layout_elements"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "layout_elements_journal_deletion" BEFORE DELETE ON "floorplans"."layout_elements"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."power_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."power_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."power_links"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."power_links" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "power_links_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."power_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "power_links_journal_deletion" BEFORE DELETE ON "floorplans"."power_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."layout_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."layout_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."layout_versions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."layout_versions" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "layout_versions_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."layout_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "layout_versions_journal_deletion" BEFORE DELETE ON "floorplans"."layout_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "floorplans"."link_views" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "floorplans"."link_views" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "floorplans"."link_views"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "floorplans"."link_views" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "link_views_stamp" BEFORE INSERT OR UPDATE ON "floorplans"."link_views"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "link_views_journal_deletion" BEFORE DELETE ON "floorplans"."link_views"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
