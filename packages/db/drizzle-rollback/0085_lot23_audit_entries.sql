-- Annulation de 0085 (lot 23, ADR 0060) : journal d'audit commun. Ses lignes
-- sont perdues : lancer après une sauvegarde (runbook de restauration, § 4 bis).
-- 0086 doit avoir été annulée avant (elle recopie hub.audit_log).
DROP TABLE "core"."audit_entries";
--> statement-breakpoint
DROP FUNCTION "core"."forbid_audit_entry_change"();
