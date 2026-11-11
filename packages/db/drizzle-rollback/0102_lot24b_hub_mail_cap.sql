-- Annulation de 0102 (lot 24b, SEC-22) : plafond d'e-mails par organisation et par heure.
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "mail_hourly_cap";
