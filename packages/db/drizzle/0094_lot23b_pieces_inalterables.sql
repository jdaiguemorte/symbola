CREATE TABLE "quotes"."ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"entry_kind" text NOT NULL,
	"object_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"previous_hash" text NOT NULL,
	"hash" text NOT NULL,
	"is_backfill" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "ledger_entries_organization_id_sequence_unique" UNIQUE("organization_id","sequence"),
	CONSTRAINT "ledger_entries_entry_kind_object_id_unique" UNIQUE("entry_kind","object_id"),
	CONSTRAINT "ledger_entries_kind_check" CHECK ("quotes"."ledger_entries"."entry_kind" in ('invoice', 'credit_note', 'original', 'payment', 'payment_reversal'))
);
--> statement-breakpoint
CREATE TABLE "quotes"."original_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_kind" text NOT NULL,
	"document_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"is_reconstructed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "original_documents_document_kind_document_id_unique" UNIQUE("document_kind","document_id"),
	CONSTRAINT "original_documents_kind_check" CHECK ("quotes"."original_documents"."document_kind" in ('invoice', 'credit_note')),
	CONSTRAINT "original_documents_sha256_check" CHECK ("quotes"."original_documents"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "quotes"."payment_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"schedule_item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_on" date,
	"payment_method_id" uuid,
	"payment_method_label" text,
	"reverses_entry_id" uuid,
	"reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "payment_entries_reverses_entry_id_unique" UNIQUE("reverses_entry_id"),
	CONSTRAINT "payment_entries_kind_check" CHECK ("quotes"."payment_entries"."kind" in ('received', 'reversal')),
	CONSTRAINT "payment_entries_received_check" CHECK ("quotes"."payment_entries"."kind" <> 'received' or ("quotes"."payment_entries"."paid_on" is not null and "quotes"."payment_entries"."reverses_entry_id" is null)),
	CONSTRAINT "payment_entries_reversal_check" CHECK ("quotes"."payment_entries"."kind" <> 'reversal' or ("quotes"."payment_entries"."reverses_entry_id" is not null and length(trim("quotes"."payment_entries"."reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "signed_document_sha256" text;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "audit_certificate_sha256" text;--> statement-breakpoint
ALTER TABLE "quotes"."payment_entries" ADD CONSTRAINT "payment_entries_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "quotes"."payment_schedule_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."payment_entries" ADD CONSTRAINT "payment_entries_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "quotes"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."payment_entries" ADD CONSTRAINT "payment_entries_reverses_entry_id_payment_entries_id_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "quotes"."payment_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Lot 23b (FAC-14, JUR-05, DOC-08, ADR 0061) : pièces inaltérables.
-- Isolation : RLS forcée, comme chaque table métier.
ALTER TABLE "quotes"."payment_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."payment_entries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."payment_entries"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "quotes"."original_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."original_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."original_documents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "quotes"."ledger_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."ledger_entries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."ledger_entries"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Ajout seul : ni UPDATE pour le rôle applicatif, et un déclencheur pour tout
-- rôle. Une écriture d'encaissement d'essai part avec l'essai.
GRANT SELECT, INSERT, DELETE ON "quotes"."payment_entries" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "quotes"."original_documents", "quotes"."ledger_entries" TO symbola_app;
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
CREATE TRIGGER payment_entries_append_only BEFORE UPDATE OR DELETE ON "quotes"."payment_entries"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."forbid_payment_entry_change"();
--> statement-breakpoint
CREATE TRIGGER payment_entries_no_truncate BEFORE TRUNCATE ON "quotes"."payment_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "quotes"."forbid_payment_entry_change"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_ledger_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'pièce inaltérable (% sur %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER original_documents_append_only BEFORE UPDATE OR DELETE ON "quotes"."original_documents"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."forbid_ledger_change"();
--> statement-breakpoint
CREATE TRIGGER original_documents_no_truncate BEFORE TRUNCATE ON "quotes"."original_documents"
  FOR EACH STATEMENT EXECUTE FUNCTION "quotes"."forbid_ledger_change"();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON "quotes"."ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."forbid_ledger_change"();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON "quotes"."ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "quotes"."forbid_ledger_change"();
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "payment_entries_stamp" BEFORE INSERT OR UPDATE ON "quotes"."payment_entries"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "payment_entries_journal_deletion" BEFORE DELETE ON "quotes"."payment_entries"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "original_documents_stamp" BEFORE INSERT OR UPDATE ON "quotes"."original_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "original_documents_journal_deletion" BEFORE DELETE ON "quotes"."original_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "ledger_entries_stamp" BEFORE INSERT OR UPDATE ON "quotes"."ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "ledger_entries_journal_deletion" BEFORE DELETE ON "quotes"."ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
-- Contenu chaîné de chaque pièce. Aucune donnée personnelle : les copies figées
-- (vendeur, acheteur, lignes, totaux), les mentions et les motifs sont réduits
-- à leur empreinte. Dates et instants en texte fixe (UTC), indépendant du
-- fuseau de la session, pour que le contenu recalculé soit identique.
CREATE OR REPLACE FUNCTION "quotes"."ledger_sha256"(value text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(coalesce(value, ''), 'UTF8')), 'hex')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."ledger_utc"(value timestamptz) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(value AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."ledger_payload_invoice"(piece "quotes"."invoices") RETURNS jsonb
  LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'number', piece.number,
    'kind', piece.kind::text,
    'quoteId', piece.quote_id,
    'versionId', piece.version_id,
    'scheduleItemId', piece.schedule_item_id,
    'issuedAt', "quotes"."ledger_utc"(piece.issued_at),
    'issuedOn', to_char(piece.issued_on, 'YYYY-MM-DD'),
    'serviceDate', to_char(piece.service_date, 'YYYY-MM-DD'),
    'paymentDueOn', to_char(piece.payment_due_on, 'YYYY-MM-DD'),
    'amountCents', piece.amount_cents,
    'vatRegime', piece.vat_regime,
    'legalMentionSha256', "quotes"."ledger_sha256"(piece.legal_mention),
    'mentionsSha256', "quotes"."ledger_sha256"(piece.mentions),
    'sellerSha256', "quotes"."ledger_sha256"(piece.seller_snapshot::text),
    'buyerSha256', "quotes"."ledger_sha256"(piece.buyer_snapshot::text),
    'linesSha256', "quotes"."ledger_sha256"(piece.lines_snapshot::text),
    'totalsSha256', "quotes"."ledger_sha256"(piece.totals_snapshot::text)
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."ledger_payload_credit_note"(piece "quotes"."credit_notes") RETURNS jsonb
  LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'number', piece.number,
    'invoiceId', piece.invoice_id,
    'issuedAt', "quotes"."ledger_utc"(piece.issued_at),
    'issuedOn', to_char(piece.issued_on, 'YYYY-MM-DD'),
    'amountCents', piece.amount_cents,
    'reasonSha256', "quotes"."ledger_sha256"(piece.reason),
    'legalMentionSha256', "quotes"."ledger_sha256"(piece.legal_mention),
    'sellerSha256', "quotes"."ledger_sha256"(piece.seller_snapshot::text),
    'buyerSha256', "quotes"."ledger_sha256"(piece.buyer_snapshot::text),
    'totalsSha256', "quotes"."ledger_sha256"(piece.totals_snapshot::text)
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."ledger_payload_original"(piece "quotes"."original_documents") RETURNS jsonb
  LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'documentKind', piece.document_kind,
    'documentId', piece.document_id,
    'storageKey', piece.storage_key,
    'sha256', piece.sha256,
    'byteSize', piece.byte_size,
    'isReconstructed', piece.is_reconstructed
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."ledger_payload_payment"(piece "quotes"."payment_entries") RETURNS jsonb
  LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'kind', piece.kind,
    'scheduleItemId', piece.schedule_item_id,
    'amountCents', piece.amount_cents,
    'paidOn', to_char(piece.paid_on, 'YYYY-MM-DD'),
    'paymentMethodId', piece.payment_method_id,
    'paymentMethodLabel', piece.payment_method_label,
    'reversesEntryId', piece.reverses_entry_id,
    'reasonSha256', "quotes"."ledger_sha256"(piece.reason)
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."ledger_hash"(previous text, rank bigint, kind text, object uuid, payload jsonb) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(previous || '|' || rank::text || '|' || kind || '|' || object::text || '|' || payload::text, 'UTF8')), 'hex')
$$;
--> statement-breakpoint
-- Rang, empreinte précédente et empreinte : calculés ici, sous un verrou propre
-- à la chaîne de l'organisation (deux pièces simultanées ne prennent jamais le
-- même rang). Ce que l'app fournit pour ces colonnes est ignoré.
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
CREATE TRIGGER ledger_entries_chain BEFORE INSERT ON "quotes"."ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."chain_ledger_entry"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."chain_piece"(organization uuid, kind text, object uuid, payload jsonb, backfill boolean) RETURNS void
  LANGUAGE sql AS $$
  INSERT INTO "quotes"."ledger_entries" ("organization_id", "sequence", "entry_kind", "object_id", "payload", "previous_hash", "hash", "is_backfill")
  VALUES (organization, 0, kind, object, payload, '', '', backfill)
$$;
--> statement-breakpoint
-- Vérification (FAC-14) : recalcule la chaîne et compare chaque écriture à la
-- pièce actuelle. Une ligne par anomalie : sequence_gap (rang manquant),
-- broken_link (empreinte précédente fausse), entry_altered (écriture
-- modifiée), object_missing (pièce supprimée), object_altered (pièce
-- modifiée), object_unchained (pièce sans écriture).
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
--> statement-breakpoint
-- Reprise des données existantes (décision D6 ; aucune pièce réelle en
-- production à ce jour). Les échéances payées deviennent des écritures
-- « received », au montant de l'échéancier (même règle que l'écran :
-- montant fixe, ou pourcentage du total TTC arrondi au centime le plus proche).
INSERT INTO "quotes"."payment_entries"
  ("organization_id", "schedule_item_id", "kind", "amount_cents", "paid_on", "payment_method_id", "payment_method_label", "is_demo", "created_at")
SELECT
  s.organization_id,
  s.id,
  'received',
  coalesce(s.amount_cents, floor((coalesce((v.totals_snapshot ->> 'totalTtcCents')::bigint, 0) * s.percentage_basis_points + 5000) / 10000)::int),
  s.paid_on,
  s.payment_method_id,
  m.label,
  q.is_demo,
  coalesce(s.paid_recorded_at, now())
FROM "quotes"."payment_schedule_items" s
JOIN "quotes"."quote_versions" v ON v.id = s.version_id
JOIN "quotes"."quotes" q ON q.id = v.quote_id
LEFT JOIN "quotes"."payment_methods" m ON m.id = s.payment_method_id
WHERE s.paid_on IS NOT NULL;
--> statement-breakpoint
-- Puis la chaîne de chaque organisation, dans l'ordre chronologique des pièces,
-- marquées « reprise ».
DO $$
DECLARE
  piece record;
BEGIN
  FOR piece IN
    SELECT i.organization_id, 'invoice' AS kind, i.id, "quotes"."ledger_payload_invoice"(i) AS payload, i.issued_at AS at
      FROM "quotes"."invoices" i WHERE NOT i.is_demo
    UNION ALL
    SELECT c.organization_id, 'credit_note', c.id, "quotes"."ledger_payload_credit_note"(c), c.issued_at
      FROM "quotes"."credit_notes" c WHERE NOT c.is_demo
    UNION ALL
    SELECT p.organization_id, 'payment', p.id, "quotes"."ledger_payload_payment"(p), p.created_at
      FROM "quotes"."payment_entries" p WHERE NOT p.is_demo
    ORDER BY at, id
  LOOP
    PERFORM "quotes"."chain_piece"(piece.organization_id, piece.kind, piece.id, piece.payload, true);
  END LOOP;
END;
$$;
--> statement-breakpoint
-- À partir d'ici, chaque pièce enregistrée s'enchaîne d'elle-même, même si le
-- code oublie de le faire.
CREATE OR REPLACE FUNCTION "quotes"."chain_new_piece"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    IF NOT NEW.is_demo THEN
      PERFORM "quotes"."chain_piece"(NEW.organization_id, 'invoice', NEW.id, "quotes"."ledger_payload_invoice"(NEW), false);
    END IF;
  ELSIF TG_TABLE_NAME = 'credit_notes' THEN
    IF NOT NEW.is_demo THEN
      PERFORM "quotes"."chain_piece"(NEW.organization_id, 'credit_note', NEW.id, "quotes"."ledger_payload_credit_note"(NEW), false);
    END IF;
  ELSIF TG_TABLE_NAME = 'original_documents' THEN
    PERFORM "quotes"."chain_piece"(NEW.organization_id, 'original', NEW.id, "quotes"."ledger_payload_original"(NEW), false);
  ELSIF TG_TABLE_NAME = 'payment_entries' THEN
    IF NOT NEW.is_demo THEN
      PERFORM "quotes"."chain_piece"(
        NEW.organization_id,
        CASE NEW.kind WHEN 'received' THEN 'payment' ELSE 'payment_reversal' END,
        NEW.id,
        "quotes"."ledger_payload_payment"(NEW),
        false
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER invoices_chain AFTER INSERT ON "quotes"."invoices"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."chain_new_piece"();
--> statement-breakpoint
CREATE TRIGGER credit_notes_chain AFTER INSERT ON "quotes"."credit_notes"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."chain_new_piece"();
--> statement-breakpoint
CREATE TRIGGER original_documents_chain AFTER INSERT ON "quotes"."original_documents"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."chain_new_piece"();
--> statement-breakpoint
CREATE TRIGGER payment_entries_chain AFTER INSERT ON "quotes"."payment_entries"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."chain_new_piece"();
