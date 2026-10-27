-- Le schéma "quotes" existe déjà (migration 0001, SOC-05) : CREATE SCHEMA
-- IF NOT EXISTS à la place de la ligne générée par drizzle-kit pour
-- rester rejouable.
CREATE SCHEMA IF NOT EXISTS "quotes";
--> statement-breakpoint
CREATE TYPE "quotes"."global_discount_kind" AS ENUM('none', 'percent', 'amount');--> statement-breakpoint
CREATE TYPE "quotes"."number_series_kind" AS ENUM('quote', 'invoice', 'credit_note');--> statement-breakpoint
CREATE TYPE "quotes"."quote_status" AS ENUM('draft', 'sent', 'signed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "quotes"."catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"category" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes"."number_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "quotes"."number_series_kind" NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "number_series_organization_id_kind_is_demo_year_unique" UNIQUE("organization_id","kind","is_demo","year")
);
--> statement-breakpoint
CREATE TABLE "quotes"."quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"label" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"quantity_milli" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"discount_basis_points" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes"."quote_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"validity_days" integer DEFAULT 30 NOT NULL,
	"quote_prefix" text DEFAULT 'D' NOT NULL,
	"invoice_prefix" text DEFAULT 'F' NOT NULL,
	"credit_note_prefix" text DEFAULT 'A' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "quotes"."quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"global_discount_kind" "quotes"."global_discount_kind" DEFAULT 'none' NOT NULL,
	"global_discount_value" integer DEFAULT 0 NOT NULL,
	"valid_until" date,
	"vat_regime" text,
	"legal_mention" text,
	"seller_snapshot" jsonb,
	"totals_snapshot" jsonb,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_quote_id_version_unique" UNIQUE("quote_id","version")
);
--> statement-breakpoint
CREATE TABLE "quotes"."quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" "quotes"."quote_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_organization_id_number_unique" UNIQUE("organization_id","number")
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD CONSTRAINT "quote_lines_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD CONSTRAINT "quote_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "quotes"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"."quotes"("id") ON DELETE no action ON UPDATE no action;