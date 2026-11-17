-- Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) : suppression logique dans le schéma hub (contacts,
-- notes, modèles de messages). Un contact à la corbeille ne retient plus son adresse e-mail et ses
-- liens de foyer ou d'entreprise sont cachés avec lui.
DROP INDEX "hub"."contacts_email_idx";--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."contacts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."contacts" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."message_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."message_templates" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_idx" ON "hub"."contacts" USING btree ("organization_id","email") WHERE email is not null and deleted_at is null;
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "hub"."contacts" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "hub"."contact_notes" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "hub"."message_templates" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY contact_visibility ON "hub"."contact_members" AS RESTRICTIVE
  USING (group_contact_id IS NULL OR EXISTS (SELECT 1 FROM "hub"."contacts" p WHERE p.id = contact_members.group_contact_id));
--> statement-breakpoint
CREATE POLICY member_visibility ON "hub"."contact_members" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "hub"."contacts" p WHERE p.id = contact_members.member_contact_id));
