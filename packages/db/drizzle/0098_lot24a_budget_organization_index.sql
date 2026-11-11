CREATE INDEX "allocation_model_items_organization_idx" ON "budget"."allocation_model_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "allocation_models_organization_idx" ON "budget"."allocation_models" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "budget_line_attachments_organization_idx" ON "budget"."budget_line_attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "budget_line_history_organization_idx" ON "budget"."budget_line_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "budget_lines_organization_idx" ON "budget"."budget_lines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_budget_items_organization_idx" ON "budget"."event_budget_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_budgets_organization_idx" ON "budget"."event_budgets" USING btree ("organization_id");