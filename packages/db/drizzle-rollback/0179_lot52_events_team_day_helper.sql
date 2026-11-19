-- Annulation de 0179 (lot 52) : les liens des renforts du jour J sont supprimés (avec leurs sessions et
-- leurs codes) ; leurs pointages, incidents et photos sont supprimés, leurs coches retirées : ces
-- lignes n'auraient plus d'auteur. L'équipe des évènements et le téléphone des renforts sont perdus.
DELETE FROM "events"."day_checkpoints" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "events"."day_incidents" WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "events"."day_photos" WHERE "taken_by" IS NULL;
--> statement-breakpoint
UPDATE "events"."day_checklist_items" SET "checked_at" = NULL, "check_action_id" = NULL, "checked_by_link_id" = NULL WHERE "checked_at" IS NOT NULL AND "checked_by" IS NULL;
--> statement-breakpoint
DELETE FROM "events"."event_links" WHERE "audience"::text = 'day_helper';
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_day_helper_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_phone_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN "phone";
--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" DROP CONSTRAINT "day_checkpoints_author_check";
--> statement-breakpoint
ALTER TABLE "events"."day_incidents" DROP CONSTRAINT "day_incidents_author_check";
--> statement-breakpoint
ALTER TABLE "events"."day_photos" DROP CONSTRAINT "day_photos_author_check";
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" DROP CONSTRAINT "day_checklist_items_check_check";
--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" DROP COLUMN "link_id";
--> statement-breakpoint
ALTER TABLE "events"."day_incidents" DROP COLUMN "link_id";
--> statement-breakpoint
ALTER TABLE "events"."day_photos" DROP COLUMN "taken_by_link_id";
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" DROP COLUMN "checked_by_link_id";
--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."day_photos" ALTER COLUMN "taken_by" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" ADD CONSTRAINT "day_checklist_items_check_check" CHECK (("events"."day_checklist_items"."checked_at" is null and "events"."day_checklist_items"."checked_by" is null) or ("events"."day_checklist_items"."checked_at" is not null and "events"."day_checklist_items"."checked_by" is not null));
--> statement-breakpoint
DROP TABLE "events"."event_team_members";
--> statement-breakpoint
ALTER TYPE "events"."event_link_audience" RENAME TO "event_link_audience_lot52";
--> statement-breakpoint
CREATE TYPE "events"."event_link_audience" AS ENUM('client', 'vendor', 'guest');
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_vendor_candidate_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" ALTER COLUMN "audience" SET DATA TYPE "events"."event_link_audience" USING "audience"::text::"events"."event_link_audience";
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_vendor_candidate_check" CHECK ("events"."event_links"."audience" <> 'vendor' or "events"."event_links"."vendor_candidate_id" is not null);
--> statement-breakpoint
DROP TYPE "events"."event_link_audience_lot52";
