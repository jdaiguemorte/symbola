-- Annulation de 0215 (lot 70a) : la table des valeurs d'avant disparaît. Acceptée : elle ne garde que dix
-- minutes de quoi « Annuler » ; au pire, un « Annuler » en cours ne répond plus.
DROP TABLE IF EXISTS "events"."task_change_snapshots";
