-- Lot 51 (JRJ-09 ; D8, ADR 0091) : une échéance de prestataire peut être « à remettre le jour J »
-- (moyen, personne qui remet) ; la remise se pointe dans le mode Jour J (heure, personne, action
-- unique, photo du reçu facultative tenue par le module events) et règle l'échéance. Schéma budget
-- seulement ; colonnes facultatives ou avec valeur par défaut, index et contrainte : compatible avec
-- la version précédente du code (ARC-14).
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handover_on_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handover_method" text;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handover_by" text;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handed_over_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handed_over_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handover_action_id" uuid;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "handover_receipt_photo_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_payments_handover_action_idx" ON "budget"."vendor_payments" USING btree ("organization_id","handover_action_id");--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD CONSTRAINT "vendor_payments_handover_check" CHECK (("budget"."vendor_payments"."handover_method" is null or char_length("budget"."vendor_payments"."handover_method") between 1 and 80) and ("budget"."vendor_payments"."handover_by" is null or char_length("budget"."vendor_payments"."handover_by") between 1 and 120) and (("budget"."vendor_payments"."handed_over_at" is null and "budget"."vendor_payments"."handed_over_by" is null and "budget"."vendor_payments"."handover_action_id" is null) or ("budget"."vendor_payments"."handed_over_at" is not null and "budget"."vendor_payments"."handed_over_by" is not null)));