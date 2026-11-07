-- Annulation de 0069 (lot 14b, DB-01) : site web, réseaux sociaux, SIRET et
-- champs importés des fiches du carnet. Ces données sont perdues : à ne lancer
-- qu'après une sauvegarde.
ALTER TABLE "vendors"."vendors" DROP COLUMN "website";
ALTER TABLE "vendors"."vendors" DROP COLUMN "social_links";
ALTER TABLE "vendors"."vendors" DROP COLUMN "siret";
ALTER TABLE "vendors"."vendors" DROP COLUMN "imported_fields";
