-- Lot 73a (PRE-02 ; spécification du lot 73, § 4.1 ; décisions P5 et P6 de Julien du 27/11/2026) : depuis
-- quand un prestataire rattaché est retenu (« retenu le 18 nov. »), au lieu de sa dernière modification.
-- Posé quand il passe à un statut retenu (retained, contract_signed, paid_off), gardé tant qu'il le reste,
-- effacé quand il ne l'est plus : par un déclencheur, pour que toutes les écritures (Retenir, Changer de
-- prestataire, Retenir aussi, choix du client, reprise) suivent la même règle. Nul pour un prestataire
-- retenu avant ce lot : rien n'est reconstruit (P6). Compatible avec l'image précédente (ARC-14).
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "retained_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "event_vendor_candidates_retained_at_idx" ON "events"."event_vendor_candidates" USING btree ("organization_id","retained_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "events"."stamp_candidate_retained_at"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('retained', 'contract_signed', 'paid_off') THEN
    -- Hors des statuts retenus, la date est toujours nulle : une date donnée n'est donc gardée que par
    -- « Annuler », qui remet celle d'avant.
    IF TG_OP = 'INSERT' OR OLD.status NOT IN ('retained', 'contract_signed', 'paid_off') THEN
      NEW.retained_at := coalesce(NEW.retained_at, now());
    ELSE
      NEW.retained_at := coalesce(NEW.retained_at, OLD.retained_at);
    END IF;
  ELSE
    NEW.retained_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "event_vendor_candidates_retained_at" BEFORE INSERT OR UPDATE OF "status", "retained_at" ON "events"."event_vendor_candidates"
  FOR EACH ROW EXECUTE FUNCTION "events"."stamp_candidate_retained_at"();
