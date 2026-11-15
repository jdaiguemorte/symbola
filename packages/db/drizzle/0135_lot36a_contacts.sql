-- Lot 36a (CRM-03, DAT-12, UX-02, ARC-03 ; D2 à D6 ; ADR 0069) : le contact unique, dans le noyau
-- du hub. Les clients des évènements deviennent des contacts ; event_clients ne garde que le lien.
-- Exception écrite à la règle « une migration ne touche que le schéma de son module » (DAT-09,
-- ADR 0036) : la reprise va de events vers hub, et rattache les liens personnels et les
-- signataires (quotes). Elle est atomique et s'annule d'un bloc (drizzle-rollback).
-- Pas compatible avec l'image du lot 35 (elle retire les coordonnées de event_clients) :
-- arrêter l'app le temps de la migration (docs/runbooks/deploiement.md).
CREATE TABLE "hub"."contact_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contact_notes_body_check" CHECK (char_length("hub"."contact_notes"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "hub"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text DEFAULT 'person' NOT NULL,
	"first_name" text,
	"last_name" text,
	"name" text,
	"email" text,
	"phone" text,
	"address_line" text,
	"postal_code" text,
	"city" text,
	"country" text,
	"billing_address" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contacts_kind_check" CHECK ("hub"."contacts"."kind" in ('person', 'household', 'company')),
	CONSTRAINT "contacts_name_check" CHECK (case when "hub"."contacts"."kind" = 'person' then "hub"."contacts"."first_name" is not null else "hub"."contacts"."name" is not null end),
	CONSTRAINT "contacts_email_check" CHECK ("hub"."contacts"."email" is null or ("hub"."contacts"."email" = lower(btrim("hub"."contacts"."email")) and "hub"."contacts"."email" <> ''))
);
--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD CONSTRAINT "contact_notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "hub"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_notes_organization_idx" ON "hub"."contact_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_notes_contact_idx" ON "hub"."contact_notes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contacts_organization_idx" ON "hub"."contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_idx" ON "hub"."contacts" USING btree ("organization_id","email") WHERE email is not null;--> statement-breakpoint
CREATE INDEX "event_clients_contact_idx" ON "events"."event_clients" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "event_links_contact_idx" ON "events"."event_links" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "quote_signers_contact_idx" ON "quotes"."quote_signers" USING btree ("contact_id");
--> statement-breakpoint
-- Reprise des clients (D6), avant les déclencheurs d'horodatage, pour garder les dates d'origine.
-- Un contact par client ; les clients d'une même organisation qui ont la même adresse e-mail
-- (casse et espaces mis à part) deviennent un seul contact, qui prend l'identifiant du client le
-- plus récemment modifié. Dans un même évènement, deux clients qui partagent une adresse (un couple
-- et sa boîte commune) restent deux personnes : seul le premier garde l'adresse (D3). Un client
-- déjà anonymisé par le RGPD (oubli ou purge) ne devient pas un contact : son lien reste vide.
CREATE TEMPORARY TABLE "lot36a_client_contacts" AS
WITH ranked AS (
  SELECT c."id", c."organization_id", c."updated_at", nullif(lower(btrim(c."email")), '') AS "email",
         row_number() OVER (PARTITION BY c."event_id", nullif(lower(btrim(c."email")), '') ORDER BY c."position", c."id") AS "in_event"
  FROM "events"."event_clients" c
  WHERE NOT (c."first_name" = '[anonymisé]' AND c."last_name" IS NULL AND c."email" IS NULL AND c."phone" IS NULL)
)
SELECT r."id" AS "client_id",
       (r."email" IS NOT NULL AND r."in_event" = 1) AS "keeps_email",
       CASE
         WHEN r."email" IS NULL OR r."in_event" > 1 THEN r."id"
         ELSE first_value(r."id") OVER (PARTITION BY r."organization_id", r."email", r."in_event" = 1 ORDER BY r."updated_at" DESC, r."id")
       END AS "contact_id"
FROM ranked r;
--> statement-breakpoint
-- Chaque champ prend la valeur renseignée la plus récente du groupe ; un contact est d'essai si
-- tous ses évènements le sont.
INSERT INTO "hub"."contacts" ("id", "organization_id", "kind", "first_name", "last_name", "email", "phone", "address_line", "postal_code", "city", "is_demo", "created_at", "created_by", "updated_at", "updated_by")
SELECT m."contact_id",
       min(c."organization_id"::text)::uuid,
       'person',
       (array_agg(c."first_name" ORDER BY c."updated_at" DESC, c."id"))[1],
       (array_agg(c."last_name" ORDER BY c."updated_at" DESC, c."id") FILTER (WHERE nullif(btrim(c."last_name"), '') IS NOT NULL))[1],
       (array_agg(lower(btrim(c."email")) ORDER BY c."updated_at" DESC, c."id") FILTER (WHERE m."keeps_email"))[1],
       (array_agg(c."phone" ORDER BY c."updated_at" DESC, c."id") FILTER (WHERE nullif(btrim(c."phone"), '') IS NOT NULL))[1],
       (array_agg(c."address_line" ORDER BY c."updated_at" DESC, c."id") FILTER (WHERE nullif(btrim(c."address_line"), '') IS NOT NULL))[1],
       (array_agg(c."postal_code" ORDER BY c."updated_at" DESC, c."id") FILTER (WHERE nullif(btrim(c."postal_code"), '') IS NOT NULL))[1],
       (array_agg(c."city" ORDER BY c."updated_at" DESC, c."id") FILTER (WHERE nullif(btrim(c."city"), '') IS NOT NULL))[1],
       bool_and(e."is_demo"),
       min(c."created_at"),
       (array_agg(c."created_by" ORDER BY c."created_at", c."id"))[1],
       max(c."updated_at"),
       (array_agg(c."updated_by" ORDER BY c."updated_at" DESC, c."id"))[1]
FROM "lot36a_client_contacts" m
JOIN "events"."event_clients" c ON c."id" = m."client_id"
JOIN "events"."events" e ON e."id" = c."event_id"
GROUP BY m."contact_id";
--> statement-breakpoint
UPDATE "events"."event_clients" c SET "contact_id" = m."contact_id" FROM "lot36a_client_contacts" m WHERE m."client_id" = c."id";
--> statement-breakpoint
-- Liens personnels et signataires d'un client : rattachés à son contact.
UPDATE "events"."event_links" l SET "contact_id" = c."contact_id" FROM "events"."event_clients" c WHERE l."event_client_id" = c."id" AND c."contact_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "quotes"."quote_signers" s SET "contact_id" = c."contact_id" FROM "events"."event_clients" c WHERE s."event_client_id" = c."id" AND s."organization_id" = c."organization_id" AND c."contact_id" IS NOT NULL;
--> statement-breakpoint
DROP TABLE "lot36a_client_contacts";
--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "address_line";--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "postal_code";--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN "city";
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "hub"."contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."contacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."contacts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."contact_notes"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."contacts" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."contact_notes" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "contacts_stamp" BEFORE INSERT OR UPDATE ON "hub"."contacts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contacts_journal_deletion" BEFORE DELETE ON "hub"."contacts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "contact_notes_stamp" BEFORE INSERT OR UPDATE ON "hub"."contact_notes"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contact_notes_journal_deletion" BEFORE DELETE ON "hub"."contact_notes"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
