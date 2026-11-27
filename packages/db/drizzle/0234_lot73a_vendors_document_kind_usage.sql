-- Lot 73a (PRE-05 ; spécification du lot 73, § 4.1 ; décisions P3 et P4 de Julien du 27/11/2026) : le nom
-- court d'une nature de pièce (« Assurance », en tête de son état dans une ligne), sans genre grammatical,
-- et la nature « demandée d'habitude » à un nouveau prestataire. Les natures de départ les reçoivent du
-- fichier vendor-document-kinds.json quand elles sont posées ; aucune étape de données (P6). Paramétrage de
-- l'organisation, aucune donnée personnelle. Compatible avec l'image précédente (ARC-14).
ALTER TABLE "vendors"."vendor_document_kinds" ADD COLUMN "short_label" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_document_kinds" ADD COLUMN "requested_by_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_document_kinds" ADD CONSTRAINT "vendor_document_kinds_short_label_check" CHECK ("vendors"."vendor_document_kinds"."short_label" is null or (char_length("vendors"."vendor_document_kinds"."short_label") between 1 and 40 and "vendors"."vendor_document_kinds"."short_label" !~ '[[:cntrl:]]'));