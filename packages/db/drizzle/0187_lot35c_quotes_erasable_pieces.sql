-- Lot 35c (RGP-11 ; décision D8 ; ADR 0100) : les pièces inaltérables (factures, avoirs, reçus,
-- encaissements, originaux, chaîne et son ancre) ne cèdent qu'à l'effacement d'une organisation
-- fermée, à sa date de suppression (core.organization_erasable, migration 0186). Rien d'autre ne
-- change : une modification reste refusée, une suppression aussi avant cette date.
CREATE OR REPLACE FUNCTION "quotes"."forbid_issued_document_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- Lot 35c (RGP-11, D8) : organisation fermée, à sa date de suppression.
  IF TG_OP = 'DELETE' THEN
    IF "core"."organization_erasable"(OLD.organization_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.is_demo THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
    AND current_setting('app.retention_anonymization', true) = 'on'
    AND (to_jsonb(NEW) - 'buyer_snapshot' - 'reform_snapshot') = (to_jsonb(OLD) - 'buyer_snapshot' - 'reform_snapshot')
    AND "quotes"."reform_without_delivery"(to_jsonb(NEW) -> 'reform_snapshot') IS NOT DISTINCT FROM "quotes"."reform_without_delivery"(to_jsonb(OLD) -> 'reform_snapshot') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'document émis immuable (%) : correction par avoir', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_payment_entry_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- Lot 35c (RGP-11, D8) : organisation fermée, à sa date de suppression.
  IF TG_OP = 'DELETE' THEN
    IF "core"."organization_erasable"(OLD.organization_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_demo THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'encaissement en ajout seul (%) : correction par écriture inverse', TG_OP
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_ledger_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- Lot 35c (RGP-11, D8) : organisation fermée, à sa date de suppression.
  IF TG_OP = 'DELETE' THEN
    IF "core"."organization_erasable"(OLD.organization_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'pièce inaltérable (% sur %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
