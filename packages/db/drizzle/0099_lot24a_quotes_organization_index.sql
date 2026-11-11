CREATE INDEX "catalog_items_organization_idx" ON "quotes"."catalog_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "original_documents_organization_idx" ON "quotes"."original_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_entries_organization_idx" ON "quotes"."payment_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_methods_organization_idx" ON "quotes"."payment_methods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_schedule_items_organization_idx" ON "quotes"."payment_schedule_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "quote_lines_organization_idx" ON "quotes"."quote_lines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "quote_signers_organization_idx" ON "quotes"."quote_signers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "quote_versions_organization_idx" ON "quotes"."quote_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "signature_requests_organization_idx" ON "quotes"."signature_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "signature_webhook_log_organization_idx" ON "quotes"."signature_webhook_log" USING btree ("organization_id");