-- Lot 43 (BUD-06, BUD-11 ; D8, D9 ; ADR 0089) : payeurs d'un évènement, parts des payeurs sur les
-- lignes du budget (pourcentage ou montant), payeur désigné des échéances des prestataires et de la
-- planner. Ajouts seulement (tables, colonne facultative) : compatible avec la version précédente.
-- RLS forcée sur les trois tables neuves, auteur et suppressions journalisées (DAT-06, SEC-19).
CREATE TABLE "budget"."budget_line_payer_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"percentage_basis_points" integer,
	"amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "budget_line_payer_shares_line_payer_unique" UNIQUE("line_id","payer_id"),
	CONSTRAINT "budget_line_payer_shares_value_check" CHECK (("budget"."budget_line_payer_shares"."percentage_basis_points" between 1 and 10000 and "budget"."budget_line_payer_shares"."amount_cents" is null) or ("budget"."budget_line_payer_shares"."percentage_basis_points" is null and "budget"."budget_line_payer_shares"."amount_cents" > 0))
);
--> statement-breakpoint
CREATE TABLE "budget"."event_payers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"link_id" uuid,
	"own_share_only" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_payers_event_link_unique" UNIQUE("event_id","link_id"),
	CONSTRAINT "event_payers_name_check" CHECK (char_length(trim("budget"."event_payers"."name")) between 1 and 120),
	CONSTRAINT "event_payers_kind_check" CHECK ("budget"."event_payers"."kind" in ('couple', 'family_one', 'family_two', 'company', 'other'))
);
--> statement-breakpoint
CREATE TABLE "budget"."planner_instalment_payers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"schedule_item_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "planner_instalment_payers_schedule_item_unique" UNIQUE("schedule_item_id")
);
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "payer_id" uuid;--> statement-breakpoint
ALTER TABLE "budget"."budget_line_payer_shares" ADD CONSTRAINT "budget_line_payer_shares_line_id_budget_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "budget"."budget_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget"."budget_line_payer_shares" ADD CONSTRAINT "budget_line_payer_shares_payer_id_event_payers_id_fk" FOREIGN KEY ("payer_id") REFERENCES "budget"."event_payers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget"."planner_instalment_payers" ADD CONSTRAINT "planner_instalment_payers_payer_id_event_payers_id_fk" FOREIGN KEY ("payer_id") REFERENCES "budget"."event_payers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_line_payer_shares_organization_idx" ON "budget"."budget_line_payer_shares" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_payers_organization_idx" ON "budget"."event_payers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_payers_event_idx" ON "budget"."event_payers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "planner_instalment_payers_organization_idx" ON "budget"."planner_instalment_payers" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD CONSTRAINT "vendor_payments_payer_id_event_payers_id_fk" FOREIGN KEY ("payer_id") REFERENCES "budget"."event_payers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget"."event_payers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."event_payers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."event_payers"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."event_payers" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_payers_stamp" BEFORE INSERT OR UPDATE ON "budget"."event_payers"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_payers_journal_deletion" BEFORE DELETE ON "budget"."event_payers"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_payer_shares" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_payer_shares" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."budget_line_payer_shares"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."budget_line_payer_shares" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "budget_line_payer_shares_stamp" BEFORE INSERT OR UPDATE ON "budget"."budget_line_payer_shares"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "budget_line_payer_shares_journal_deletion" BEFORE DELETE ON "budget"."budget_line_payer_shares"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "budget"."planner_instalment_payers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."planner_instalment_payers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."planner_instalment_payers"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."planner_instalment_payers" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "planner_instalment_payers_stamp" BEFORE INSERT OR UPDATE ON "budget"."planner_instalment_payers"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "planner_instalment_payers_journal_deletion" BEFORE DELETE ON "budget"."planner_instalment_payers"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
