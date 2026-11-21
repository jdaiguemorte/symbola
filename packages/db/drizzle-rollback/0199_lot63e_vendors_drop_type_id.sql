-- Annulation de 0199 (lot 63e) : la colonne du type d'une fiche revient, remplie par son métier
-- principal (à défaut, le premier de ses métiers). Les autres métiers restent dans
-- vendors.vendor_type_links, que l'ancienne version ignore. Après cette annulation, l'image d'avant
-- le lot 63e peut tourner (docs/runbooks/deploiement.md, § Retour arrière).
ALTER TABLE "vendors"."vendors" ADD COLUMN IF NOT EXISTS "type_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_type_id_vendor_types_id_fk') THEN
    ALTER TABLE "vendors"."vendors" ADD CONSTRAINT "vendors_type_id_vendor_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "vendors"."vendor_types"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END
$$;
--> statement-breakpoint
UPDATE "vendors"."vendors" v
SET "type_id" = (
  SELECT l."type_id" FROM "vendors"."vendor_type_links" l
  WHERE l."vendor_id" = v."id"
  ORDER BY l."is_primary" DESC, l."position", l."created_at"
  LIMIT 1
);
