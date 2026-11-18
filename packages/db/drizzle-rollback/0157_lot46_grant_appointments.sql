-- Annulation de 0157 (lot 46) : le schéma appointments perd ses politiques, ses déclencheurs et les
-- droits du rôle applicatif ; ses tables restent (0156 les retire).
DROP TRIGGER IF EXISTS "booking_pages_stamp" ON "appointments"."booking_pages";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "booking_pages_journal_deletion" ON "appointments"."booking_pages";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointment_types_stamp" ON "appointments"."appointment_types";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointment_types_journal_deletion" ON "appointments"."appointment_types";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "availability_rules_stamp" ON "appointments"."availability_rules";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "availability_rules_journal_deletion" ON "appointments"."availability_rules";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "availability_closures_stamp" ON "appointments"."availability_closures";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "availability_closures_journal_deletion" ON "appointments"."availability_closures";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "calendar_sources_stamp" ON "appointments"."calendar_sources";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "calendar_sources_journal_deletion" ON "appointments"."calendar_sources";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointments_stamp" ON "appointments"."appointments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointments_journal_deletion" ON "appointments"."appointments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointment_reports_stamp" ON "appointments"."appointment_reports";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointment_reports_journal_deletion" ON "appointments"."appointment_reports";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointment_report_actions_stamp" ON "appointments"."appointment_report_actions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "appointment_report_actions_journal_deletion" ON "appointments"."appointment_report_actions";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "appointments"."appointment_types";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "appointments"."appointments";
--> statement-breakpoint
DROP POLICY IF EXISTS public_lookup ON "appointments"."booking_pages";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_insert ON "appointments"."booking_pages";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_update ON "appointments"."booking_pages";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_delete ON "appointments"."booking_pages";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."appointment_types";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."availability_rules";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."availability_closures";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."calendar_sources";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."busy_intervals";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."appointments";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."appointment_reports";
--> statement-breakpoint
DROP POLICY IF EXISTS organization_isolation ON "appointments"."appointment_report_actions";
--> statement-breakpoint
ALTER TABLE "appointments"."booking_pages" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."booking_pages" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_rules" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_rules" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_closures" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."availability_closures" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."calendar_sources" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."calendar_sources" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."busy_intervals" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."busy_intervals" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointments" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointments" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_reports" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_reports" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_report_actions" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appointments"."appointment_report_actions" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "appointments" FROM symbola_app;
--> statement-breakpoint
REVOKE USAGE ON SCHEMA "appointments" FROM symbola_app;
