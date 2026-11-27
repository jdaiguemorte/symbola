-- Annulation de 0234 (lot 73a) : le nom court et « demandée d'habitude » des natures de pièces
-- disparaissent. Réglages de l'organisation sans autre trace : l'image précédente ne les lit pas, rien
-- n'est perdu qui ne se règle à nouveau.
ALTER TABLE "vendors"."vendor_document_kinds" DROP CONSTRAINT IF EXISTS "vendor_document_kinds_short_label_check";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_document_kinds" DROP COLUMN IF EXISTS "requested_by_default";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_document_kinds" DROP COLUMN IF EXISTS "short_label";
