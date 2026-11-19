-- Annulation de 0184 (lot 35b) : la trace des reprises d'un export disparaît. Les archives
-- déposées encore dans le stockage privé (préfixe organization-imports/) n'ont plus de ligne qui y
-- mène : à effacer à la main si l'annulation est définitive (docs/runbooks/restauration.md § 4 bis).
DROP TABLE "hub"."organization_imports";
