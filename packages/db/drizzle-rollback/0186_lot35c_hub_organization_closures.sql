-- Annulation de 0186 (lot 35c) : la fermeture des espaces disparaît. Refusée tant qu'une organisation
-- est fermée (sa date de suppression serait perdue). La trace des fermetures passées est perdue avec
-- la table : l'exporter d'abord (docs/runbooks/restauration.md, § Rejeu des effacements).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."organizations" WHERE closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'annulation refusée : des espaces sont fermés (rouvrir ou attendre leur suppression)';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "core"."forbid_audit_entry_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- IF imbriqués : un déclencheur TRUNCATE (par instruction) n'a pas d'OLD.
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_demo THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'journal d''audit en ajout seul (%)', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
DROP FUNCTION "core"."erase_organization_identity"(uuid, uuid[]);
--> statement-breakpoint
DROP FUNCTION "core"."erase_organization_schema"(uuid, text);
--> statement-breakpoint
DROP TRIGGER organizations_closure_guard ON "hub"."organizations";
--> statement-breakpoint
DROP FUNCTION "hub"."guard_organization_closure"();
--> statement-breakpoint
DROP TABLE "hub"."organization_closures";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP CONSTRAINT "organizations_closure_check";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN "closure_notice_sent_at";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN "deletion_due_at";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN "closed_by_user_id";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN "closed_at";
