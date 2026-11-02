CREATE TYPE "hub"."privacy_request_status" AS ENUM('open', 'extended', 'closed');--> statement-breakpoint
CREATE TYPE "hub"."privacy_request_type" AS ENUM('access', 'rectification', 'erasure', 'portability', 'objection');--> statement-breakpoint
CREATE TABLE "hub"."privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "hub"."privacy_request_type" NOT NULL,
	"person_label" text NOT NULL,
	"received_on" date NOT NULL,
	"due_on" date NOT NULL,
	"status" "hub"."privacy_request_status" DEFAULT 'open' NOT NULL,
	"extension_reason" text,
	"extended_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub"."privacy_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"request_alert_days" integer NOT NULL,
	"prospect_retention_months" integer NOT NULL,
	"client_retention_months" integer NOT NULL,
	"accounting_retention_months" integer NOT NULL,
	"inactive_account_months" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
