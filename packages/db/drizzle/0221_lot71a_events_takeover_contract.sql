-- Lot 71a (C-53 ; spécification du lot 71, § 4.2 ; décisions I1 et I2 de Julien du 27/11/2026) : le
-- contrat d'un prestataire retenu par une reprise, tel que la planner l'a déclaré (« signed »,
-- « unsigned », « unknown ») ; nul hors reprise. Un tel prestataire ne devient jamais d'office une
-- relance « Contrat de … à faire signer » ; « signed » pose aussi le statut « contract_signed ».
-- Compatible avec l'image précédente : une colonne facultative et sa contrainte (ARC-14).
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "takeover_contract" text;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_takeover_contract_check" CHECK ("events"."event_vendor_candidates"."takeover_contract" is null or "events"."event_vendor_candidates"."takeover_contract" in ('signed', 'unsigned', 'unknown'));
