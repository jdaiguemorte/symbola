CREATE INDEX "vendor_files_organization_idx" ON "vendors"."vendor_files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_tag_groups_organization_idx" ON "vendors"."vendor_tag_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_tags_organization_idx" ON "vendors"."vendor_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_type_fields_organization_idx" ON "vendors"."vendor_type_fields" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_types_organization_idx" ON "vendors"."vendor_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendors_organization_idx" ON "vendors"."vendors" USING btree ("organization_id");