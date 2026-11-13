-- Annulation de 0126 (lot 31c, D18 et D21) : les reçus d'arrhes, les séries de reçus, le texte
-- des conditions de paiement face à un professionnel, le taux des pénalités choisi et le préfixe
-- des reçus sont perdus. Les encaissements restent.
DROP TABLE "quotes"."earnest_receipts";
--> statement-breakpoint
DELETE FROM "quotes"."number_series" WHERE "kind"::text = 'receipt';
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT "quote_settings_late_penalty_rate_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "receipt_prefix";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "late_penalty_rate";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "invoice_mentions_professional";
