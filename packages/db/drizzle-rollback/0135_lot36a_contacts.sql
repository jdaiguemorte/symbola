-- Annulation de 0135 (lot 36a) : les clients des évènements retrouvent leurs coordonnées,
-- reprises de leur contact (un contact partagé par deux évènements les donne aux deux) ; un client
-- retiré par le RGPD redevient « [anonymisé] ». Les contacts sans évènement, les notes des contacts
-- et l'adresse de facturation des contacts sont perdus ; liens personnels et signataires perdent
-- leur rattachement au contact (leurs copies restent).
ALTER TABLE "events"."event_clients" ADD COLUMN "first_name" text;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "last_name" text;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "email" text;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "phone" text;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "address_line" text;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "postal_code" text;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "city" text;
--> statement-breakpoint
UPDATE "events"."event_clients" c
SET "first_name" = coalesce(k."first_name", k."name"), "last_name" = k."last_name", "email" = k."email", "phone" = k."phone",
    "address_line" = k."address_line", "postal_code" = k."postal_code", "city" = k."city"
FROM "hub"."contacts" k
WHERE k."id" = c."contact_id";
--> statement-breakpoint
UPDATE "events"."event_clients" SET "first_name" = '[anonymisé]' WHERE "first_name" IS NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ALTER COLUMN "first_name" SET NOT NULL;
--> statement-breakpoint
DROP INDEX "events"."event_clients_contact_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "contact_id";
--> statement-breakpoint
DROP INDEX "events"."event_links_contact_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN "contact_id";
--> statement-breakpoint
DROP INDEX "quotes"."quote_signers_contact_idx";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" DROP COLUMN "contact_id";
--> statement-breakpoint
DROP TABLE "hub"."contact_notes";
--> statement-breakpoint
DROP TABLE "hub"."contacts";
