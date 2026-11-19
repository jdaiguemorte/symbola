-- Annulation de 0187 (lot 35c) : les pièces redeviennent inaltérables sans exception.
CREATE OR REPLACE FUNCTION "quotes"."forbid_issued_document_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
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
  RAISE EXCEPTION 'pièce inaltérable (% sur %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
