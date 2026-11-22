-- Lot 65g (HUB-14, BUD-04 ; recette staging du 22/11/2026) : un import lancé depuis un évènement (tâches,
-- lignes de budget) garde cet évènement ; toutes ses lignes y vont, sans colonne pour le désigner.
-- Schéma hub seulement ; colonne facultative ajoutée : compatible avec l'image précédente (ARC-14).
ALTER TABLE "hub"."imports" ADD COLUMN "target_event_id" uuid;