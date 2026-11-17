-- Annulation de 0145 (lot 39a) : la suppression logique du schéma hub disparaît et l'adresse
-- e-mail d'un contact redevient unique sans condition. Refusée tant qu'une ligne est à la corbeille.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."contacts" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de hub.contacts sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."contact_notes" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de hub.contact_notes sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."message_templates" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de hub.message_templates sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS contact_visibility ON "hub"."contact_members";
--> statement-breakpoint
DROP POLICY IF EXISTS member_visibility ON "hub"."contact_members";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "hub"."contacts";
--> statement-breakpoint
ALTER TABLE "hub"."contacts" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "hub"."contacts" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "hub"."contact_notes";
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "hub"."message_templates";
--> statement-breakpoint
ALTER TABLE "hub"."message_templates" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "hub"."message_templates" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."contacts_email_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_idx" ON "hub"."contacts" USING btree ("organization_id","email") WHERE email is not null;
