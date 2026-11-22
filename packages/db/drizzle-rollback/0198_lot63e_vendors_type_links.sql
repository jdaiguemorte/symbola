-- Annulation de 0198 (lot 63e) : la table des métiers des fiches disparaît. Refusée tant que 0199
-- n'est pas annulée (le type de chaque fiche ne vivrait plus nulle part) ou qu'une fiche a plus d'un
-- métier (les métiers secondaires seraient perdus) : retirer d'abord ces métiers sur les fiches.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'vendors' AND table_name = 'vendors' AND column_name = 'type_id') THEN
    RAISE EXCEPTION 'Annulation refusée : annuler d''abord 0199_lot63e_vendors_drop_type_id (vendors.type_id absente).';
  END IF;
  IF EXISTS (SELECT 1 FROM "vendors"."vendor_type_links" GROUP BY "vendor_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Annulation refusée : des fiches de prestataires ont plusieurs métiers (vendors.vendor_type_links).';
  END IF;
END
$$;
--> statement-breakpoint
UPDATE "vendors"."vendors" v
SET "type_id" = l."type_id"
FROM "vendors"."vendor_type_links" l
WHERE l."vendor_id" = v."id" AND v."type_id" IS DISTINCT FROM l."type_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "vendors"."vendor_type_links";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "vendors"."check_type_link_organization"();
