-- Annulation de 0095 (lot 24a, DAT-01) : index sur organization_id du schéma core.
-- Aucune donnée touchée.
DROP INDEX IF EXISTS "core"."domain_events_organization_idx";
