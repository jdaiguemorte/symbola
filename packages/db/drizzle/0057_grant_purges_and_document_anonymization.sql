-- Lot 6 (RGPD-05, ADR 0024) — purges mensuelles : données métier, RLS forcée
-- comme hub.privacy_erasures, jamais supprimées par l'app (preuve).
ALTER TABLE "hub"."privacy_purges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."privacy_purges" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."privacy_purges"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."privacy_purges" TO symbola_app;
--> statement-breakpoint
-- Factures et avoirs à la fin de leur conservation légale (ADR 0024, qui
-- précise l'ADR 0010) : seule la copie de l'acheteur peut être remplacée
-- (droit UPDATE sur cette seule colonne), et seulement dans une transaction
-- qui le déclare (`SET LOCAL app.retention_anonymization = 'on'`, posé par le
-- module quotes après avoir vérifié l'échéance). Toute autre modification
-- reste refusée : un document émis ne change jamais.
GRANT UPDATE ("buyer_snapshot") ON "quotes"."invoices", "quotes"."credit_notes" TO symbola_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_issued_document_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_demo THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
    AND current_setting('app.retention_anonymization', true) = 'on'
    AND (to_jsonb(NEW) - 'buyer_snapshot') = (to_jsonb(OLD) - 'buyer_snapshot') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'document émis immuable (%) : correction par avoir', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
