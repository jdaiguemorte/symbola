-- Lot 63e (PRE-01, PRE-11 ; ADR 0105) : second temps. Les lectures sont passées sur
-- vendors.vendor_type_links ; l'ancienne colonne du type d'une fiche disparaît. Schéma vendors seulement.
-- symbola: arret-requis le type d'une fiche (vendors.type_id) est retiré : l'ancienne version de l'app le lit encore
-- Une fiche typée sans métier (écrite par l'ancienne version entre 0198 et 0199) reçoit d'abord son
-- type comme métier principal : rien ne se perd.
INSERT INTO "vendors"."vendor_type_links" ("organization_id", "vendor_id", "type_id", "is_primary", "position")
SELECT v."organization_id", v."id", v."type_id", NOT EXISTS (SELECT 1 FROM "vendors"."vendor_type_links" p WHERE p."vendor_id" = v."id" AND p."is_primary"), 0
FROM "vendors"."vendors" v
JOIN "vendors"."vendor_types" t ON t."id" = v."type_id" AND t."organization_id" = v."organization_id"
WHERE v."type_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "vendors"."vendor_type_links" l WHERE l."vendor_id" = v."id" AND l."type_id" = v."type_id");
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP CONSTRAINT "vendors_type_id_vendor_types_id_fk";
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP COLUMN "type_id";
