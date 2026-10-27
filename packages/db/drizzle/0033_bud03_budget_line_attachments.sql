CREATE TABLE "budget"."budget_line_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" ADD CONSTRAINT "budget_line_attachments_line_id_budget_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "budget"."budget_lines"("id") ON DELETE no action ON UPDATE no action;