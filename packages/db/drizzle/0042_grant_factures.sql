-- Row-Level Security et immuabilité des factures et avoirs (DEV-04,
-- CLAUDE.md §2.4 et §5 : une facture émise est immuable, correction par
-- avoir). Le rôle applicatif n'a jamais le droit UPDATE sur ces tables, et
-- un trigger refuse toute modification ou suppression — sauf la suppression
-- d'un document d'essai guidé (is_demo, ADR 0008), purgé avec l'essai.
ALTER TABLE "quotes"."invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."invoices"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "quotes"."invoices" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."credit_notes"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "quotes"."credit_notes" TO symbola_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_issued_document_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_demo THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'document émis immuable (%) : correction par avoir', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER invoices_immutable BEFORE UPDATE OR DELETE ON "quotes"."invoices"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."forbid_issued_document_change"();
--> statement-breakpoint
CREATE TRIGGER credit_notes_immutable BEFORE UPDATE OR DELETE ON "quotes"."credit_notes"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."forbid_issued_document_change"();
