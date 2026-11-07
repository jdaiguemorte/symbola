-- Annulation de 0074 (lot 15, DB-01) : droits et RLS de hub.import_jobs.
REVOKE ALL ON "hub"."import_jobs" FROM symbola_app;
DROP POLICY IF EXISTS organization_isolation ON "hub"."import_jobs";
ALTER TABLE "hub"."import_jobs" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "hub"."import_jobs" DISABLE ROW LEVEL SECURITY;
