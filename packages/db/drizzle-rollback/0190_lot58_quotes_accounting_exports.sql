-- Annulation de 0190 (lot 58) : réglages et traces des exports comptables disparaissent. Refusée tant
-- qu'un export a été demandé (sa trace est une preuve de ce qui a été remis au comptable) ou qu'un plan
-- de comptes est réglé (il serait perdu).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."accounting_exports") THEN
    RAISE EXCEPTION 'Annulation refusée : des exports comptables ont été demandés (quotes.accounting_exports).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."accounting_export_settings") THEN
    RAISE EXCEPTION 'Annulation refusée : des réglages d''export comptable existent (quotes.accounting_export_settings).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "quotes"."accounting_exports";
--> statement-breakpoint
DROP TABLE IF EXISTS "quotes"."accounting_export_settings";
