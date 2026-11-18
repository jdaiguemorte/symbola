-- Lot 46 (RDV-01 à RDV-04, EVT-10 ; ADR 0083) : Row-Level Security forcée et droits du rôle
-- applicatif sur le schéma appointments (CLAUDE.md § 2.3, SEC-10, SEC-11), même patron que 0063.
-- La page de réservation (booking_pages) est l'exception écrite : son adresse est publique par
-- nature (/reserver/<adresse>), sa ligne se lit sans organisation pour retrouver celle de l'adresse ;
-- elle ne s'écrit que par son organisation. Rien d'autre que l'adresse, l'état et la mention
-- d'information affichée sur la page n'y figure.
GRANT USAGE ON SCHEMA "appointments" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."booking_pages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."booking_pages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY public_lookup ON "appointments"."booking_pages" FOR SELECT
  USING (true);
--> statement-breakpoint
CREATE POLICY organization_insert ON "appointments"."booking_pages" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY organization_update ON "appointments"."booking_pages" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY organization_delete ON "appointments"."booking_pages" FOR DELETE
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."booking_pages" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."appointment_types"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."appointment_types" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_rules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."availability_rules"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."availability_rules" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_closures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_closures" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."availability_closures"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."availability_closures" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."calendar_sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."calendar_sources" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."calendar_sources"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."calendar_sources" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."busy_intervals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."busy_intervals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."busy_intervals"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."busy_intervals" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."appointments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."appointments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."appointments" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_reports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."appointment_reports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."appointment_reports" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_report_actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_report_actions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "appointments"."appointment_report_actions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "appointments"."appointment_report_actions" TO symbola_app;
--> statement-breakpoint
-- Suppression logique (DAT-03, ADR 0073) : un type ou un rendez-vous à la corbeille sort de ce que la
-- base montre, sauf dans une transaction qui voit la corbeille.
CREATE POLICY soft_delete_visibility ON "appointments"."appointment_types" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "appointments"."appointments" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées. Les plages occupées
-- (busy_intervals) sont techniques, remplacées à chaque lecture : ni auteur ni journal.
--> statement-breakpoint
CREATE TRIGGER "booking_pages_stamp" BEFORE INSERT OR UPDATE ON "appointments"."booking_pages"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "booking_pages_journal_deletion" BEFORE DELETE ON "appointments"."booking_pages"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "appointment_types_stamp" BEFORE INSERT OR UPDATE ON "appointments"."appointment_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "appointment_types_journal_deletion" BEFORE DELETE ON "appointments"."appointment_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "availability_rules_stamp" BEFORE INSERT OR UPDATE ON "appointments"."availability_rules"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "availability_rules_journal_deletion" BEFORE DELETE ON "appointments"."availability_rules"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "availability_closures_stamp" BEFORE INSERT OR UPDATE ON "appointments"."availability_closures"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "availability_closures_journal_deletion" BEFORE DELETE ON "appointments"."availability_closures"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "calendar_sources_stamp" BEFORE INSERT OR UPDATE ON "appointments"."calendar_sources"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "calendar_sources_journal_deletion" BEFORE DELETE ON "appointments"."calendar_sources"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "appointments_stamp" BEFORE INSERT OR UPDATE ON "appointments"."appointments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "appointments_journal_deletion" BEFORE DELETE ON "appointments"."appointments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "appointment_reports_stamp" BEFORE INSERT OR UPDATE ON "appointments"."appointment_reports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "appointment_reports_journal_deletion" BEFORE DELETE ON "appointments"."appointment_reports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "appointment_report_actions_stamp" BEFORE INSERT OR UPDATE ON "appointments"."appointment_report_actions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "appointment_report_actions_journal_deletion" BEFORE DELETE ON "appointments"."appointment_report_actions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
