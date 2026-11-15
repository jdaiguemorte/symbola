-- Annulation de 0134 (lot 35a) : la trace des exports complets et la durée de conservation de
-- leur archive disparaissent. Les archives encore dans le stockage privé (préfixe
-- organization-exports/) n'ont plus de ligne qui y mène : à effacer à la main si l'annulation
-- est définitive (docs/runbooks/restauration.md § 4 bis).
DROP TABLE "hub"."organization_exports";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN "organization_export_retention_days";
