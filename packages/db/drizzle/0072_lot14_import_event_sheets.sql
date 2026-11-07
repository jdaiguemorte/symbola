ALTER TYPE "hub"."import_entity_type" ADD VALUE 'event_sheets';--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "import_max_sheets" integer DEFAULT 50 NOT NULL;