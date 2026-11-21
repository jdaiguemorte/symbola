-- Lot 63e (PRE-01, PRE-11, HUB-20 ; ADR 0105) : une fiche de prestataire, plusieurs métiers. Premier
-- temps de la migration en deux temps : la table des métiers d'une fiche, puis la reprise, où chaque
-- fiche reçoit son type actuel (vendors.type_id) comme métier principal. Schéma vendors seulement.
-- Ajout seul : l'ancienne version du code lit encore type_id, qui reste jusqu'à 0199.
-- Les types combinés (« Photographe et vidéaste ») ne sont pas scindés ici : la liste qui les
-- reconnaît est un fichier de données (vendor-type-synonyms.json), lu par la commande
-- `vendors:split-types` (rapport d'abord, puis application ; docs/runbooks/deploiement.md).
CREATE TABLE "vendors"."vendor_type_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_type_links_vendor_type_key" UNIQUE("vendor_id","type_id")
);
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_links" ADD CONSTRAINT "vendor_type_links_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_links" ADD CONSTRAINT "vendor_type_links_type_id_vendor_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "vendors"."vendor_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_type_links_organization_idx" ON "vendors"."vendor_type_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_type_links_type_idx" ON "vendors"."vendor_type_links" USING btree ("type_id");--> statement-breakpoint
-- Au plus un métier principal par fiche.
CREATE UNIQUE INDEX "vendor_type_links_one_primary" ON "vendors"."vendor_type_links" USING btree ("vendor_id") WHERE "vendors"."vendor_type_links"."is_primary";
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées.
ALTER TABLE "vendors"."vendor_type_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_type_links"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_type_links" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_type_links_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_type_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_type_links_journal_deletion" BEFORE DELETE ON "vendors"."vendor_type_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
-- Une clé étrangère ne voit pas la Row-Level Security : la fiche et le type d'un lien sont ceux de
-- l'organisation du lien, vérifiés ici (SEC-10), même si un bogue applicatif proposait un type d'une
-- autre organisation. La fonction s'exécute avec les droits de l'appelant : sous le rôle applicatif,
-- la fiche ou le type d'une autre organisation sont invisibles, donc refusés.
CREATE FUNCTION "vendors"."check_type_link_organization"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "vendors"."vendors" WHERE id = NEW.vendor_id AND organization_id = NEW.organization_id)
     OR NOT EXISTS (SELECT 1 FROM "vendors"."vendor_types" WHERE id = NEW.type_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'métier d''une fiche : fiche ou type d''une autre organisation' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "vendor_type_links_same_organization" BEFORE INSERT OR UPDATE OF "organization_id", "vendor_id", "type_id" ON "vendors"."vendor_type_links"
  FOR EACH ROW EXECUTE FUNCTION "vendors"."check_type_link_organization"();
--> statement-breakpoint
-- Reprise : le type actuel de chaque fiche devient son métier principal (même organisation).
INSERT INTO "vendors"."vendor_type_links" ("organization_id", "vendor_id", "type_id", "is_primary", "position", "created_at", "created_by", "updated_at", "updated_by")
SELECT v."organization_id", v."id", v."type_id", true, 0, v."updated_at", v."updated_by", v."updated_at", v."updated_by"
FROM "vendors"."vendors" v
JOIN "vendors"."vendor_types" t ON t."id" = v."type_id" AND t."organization_id" = v."organization_id"
WHERE v."type_id" IS NOT NULL;
