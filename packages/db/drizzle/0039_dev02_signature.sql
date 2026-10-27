CREATE TYPE "quotes"."quote_signer_status" AS ENUM('pending', 'signed', 'declined');--> statement-breakpoint
CREATE TYPE "quotes"."signature_request_status" AS ENUM('pending', 'completed', 'declined');--> statement-breakpoint
CREATE TABLE "quotes"."quote_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"event_client_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"billing_address" text NOT NULL,
	"signing_url" text NOT NULL,
	"external_id" text,
	"status" "quotes"."quote_signer_status" DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes"."signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"status" "quotes"."signature_request_status" DEFAULT 'pending' NOT NULL,
	"signed_document_key" text,
	"audit_certificate_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "signature_requests_version_id_unique" UNIQUE("version_id"),
	CONSTRAINT "signature_requests_provider_external_id_unique" UNIQUE("provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "quotes"."signature_webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid,
	"event_type" text NOT NULL,
	"outcome" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD CONSTRAINT "quote_signers_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "quotes"."signature_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD CONSTRAINT "signature_requests_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."signature_webhook_log" ADD CONSTRAINT "signature_webhook_log_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "quotes"."signature_requests"("id") ON DELETE no action ON UPDATE no action;