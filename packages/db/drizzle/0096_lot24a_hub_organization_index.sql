CREATE INDEX "import_items_organization_idx" ON "hub"."import_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "import_jobs_organization_idx" ON "hub"."import_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "imports_organization_idx" ON "hub"."imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_organization_idx" ON "hub"."invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "privacy_erasures_organization_idx" ON "hub"."privacy_erasures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "privacy_exports_organization_idx" ON "hub"."privacy_exports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "privacy_purges_organization_idx" ON "hub"."privacy_purges" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "privacy_requests_organization_idx" ON "hub"."privacy_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_organization_idx" ON "hub"."users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vat_regime_changes_organization_idx" ON "hub"."vat_regime_changes" USING btree ("organization_id");