-- Annulation de 0185 (lot 35b) : l'ancre des chaînes reprises disparaît ; la création des
-- écritures et la vérification redeviennent celles du lot 23b (0094). Une organisation qui a repris
-- un export verrait alors sa chaîne signalée « broken_link » à sa première écriture : n'annuler
-- qu'avant toute reprise en production (docs/runbooks/restauration.md § 4 bis).
DROP TABLE "quotes"."ledger_anchors";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."chain_ledger_entry"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  last_rank bigint;
  last_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('quotes.ledger:' || NEW.organization_id::text, 0));
  SELECT e.sequence, e.hash INTO last_rank, last_hash
    FROM "quotes"."ledger_entries" e
    WHERE e.organization_id = NEW.organization_id
    ORDER BY e.sequence DESC
    LIMIT 1;
  NEW.sequence := coalesce(last_rank, 0) + 1;
  NEW.previous_hash := coalesce(last_hash, repeat('0', 64));
  NEW.recorded_at := clock_timestamp();
  NEW.hash := "quotes"."ledger_hash"(NEW.previous_hash, NEW.sequence, NEW.entry_kind, NEW.object_id, NEW.payload);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."verify_ledger"(organization uuid)
  RETURNS TABLE(anomaly_sequence bigint, anomaly_kind text, anomaly_object uuid, anomaly text)
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  entry "quotes"."ledger_entries";
  expected_previous text := repeat('0', 64);
  expected_rank bigint := 1;
  current_payload jsonb;
BEGIN
  FOR entry IN
    SELECT * FROM "quotes"."ledger_entries" e WHERE e.organization_id = organization ORDER BY e.sequence
  LOOP
    IF entry.sequence <> expected_rank THEN
      anomaly_sequence := expected_rank; anomaly_kind := entry.entry_kind; anomaly_object := entry.object_id; anomaly := 'sequence_gap';
      RETURN NEXT;
    END IF;
    IF entry.previous_hash <> expected_previous THEN
      anomaly_sequence := entry.sequence; anomaly_kind := entry.entry_kind; anomaly_object := entry.object_id; anomaly := 'broken_link';
      RETURN NEXT;
    END IF;
    IF entry.hash <> "quotes"."ledger_hash"(entry.previous_hash, entry.sequence, entry.entry_kind, entry.object_id, entry.payload) THEN
      anomaly_sequence := entry.sequence; anomaly_kind := entry.entry_kind; anomaly_object := entry.object_id; anomaly := 'entry_altered';
      RETURN NEXT;
    END IF;
    current_payload := CASE entry.entry_kind
      WHEN 'invoice' THEN (SELECT "quotes"."ledger_payload_invoice"(i) FROM "quotes"."invoices" i WHERE i.id = entry.object_id)
      WHEN 'credit_note' THEN (SELECT "quotes"."ledger_payload_credit_note"(c) FROM "quotes"."credit_notes" c WHERE c.id = entry.object_id)
      WHEN 'original' THEN (SELECT "quotes"."ledger_payload_original"(o) FROM "quotes"."original_documents" o WHERE o.id = entry.object_id)
      ELSE (SELECT "quotes"."ledger_payload_payment"(p) FROM "quotes"."payment_entries" p WHERE p.id = entry.object_id)
    END;
    IF current_payload IS NULL THEN
      anomaly_sequence := entry.sequence; anomaly_kind := entry.entry_kind; anomaly_object := entry.object_id; anomaly := 'object_missing';
      RETURN NEXT;
    ELSIF current_payload <> entry.payload THEN
      anomaly_sequence := entry.sequence; anomaly_kind := entry.entry_kind; anomaly_object := entry.object_id; anomaly := 'object_altered';
      RETURN NEXT;
    END IF;
    expected_previous := entry.hash;
    expected_rank := entry.sequence + 1;
  END LOOP;
  RETURN QUERY
    SELECT NULL::bigint, 'invoice'::text, i.id, 'object_unchained'::text
      FROM "quotes"."invoices" i
      WHERE i.organization_id = organization AND NOT i.is_demo
        AND NOT EXISTS (SELECT 1 FROM "quotes"."ledger_entries" e WHERE e.entry_kind = 'invoice' AND e.object_id = i.id)
    UNION ALL
    SELECT NULL::bigint, 'credit_note'::text, c.id, 'object_unchained'::text
      FROM "quotes"."credit_notes" c
      WHERE c.organization_id = organization AND NOT c.is_demo
        AND NOT EXISTS (SELECT 1 FROM "quotes"."ledger_entries" e WHERE e.entry_kind = 'credit_note' AND e.object_id = c.id)
    UNION ALL
    SELECT NULL::bigint, 'original'::text, o.id, 'object_unchained'::text
      FROM "quotes"."original_documents" o
      WHERE o.organization_id = organization
        AND NOT EXISTS (SELECT 1 FROM "quotes"."ledger_entries" e WHERE e.entry_kind = 'original' AND e.object_id = o.id)
    UNION ALL
    SELECT NULL::bigint, CASE p.kind WHEN 'received' THEN 'payment' ELSE 'payment_reversal' END, p.id, 'object_unchained'::text
      FROM "quotes"."payment_entries" p
      WHERE p.organization_id = organization AND NOT p.is_demo
        AND NOT EXISTS (SELECT 1 FROM "quotes"."ledger_entries" e WHERE e.object_id = p.id AND e.entry_kind IN ('payment', 'payment_reversal'));
END;
$$;
