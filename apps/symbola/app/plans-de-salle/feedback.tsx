// Lot 60 — retour d'une action des plans de salle, porté par l'adresse (?ok=… ou ?erreur=…) : un
// message traduit, annoncé ; jamais une donnée.
import { getTranslations } from "next-intl/server";

const OK = new Set(["space", "removed", "background", "background_removed", "calibrated", "renamed", "published", "names", "saved_to_venue", "tables", "type_added", "type_saved"]);
const ERRORS = new Set([
  "name",
  "size",
  "elements",
  "too_many_elements",
  "fixtures",
  "vendor",
  "fixture_link",
  "element_type",
  "calibration",
  "background_type",
  "background_size",
  "background_infected",
  "background_storage_full",
  "no_tables",
  "no_source",
  "stale",
  "not_found",
  "guests_not_ready",
  "seating_too_many_tables",
  "seating_capacity",
  "seating_table_name",
]);

export async function Feedback({ query }: { query: { ok?: string; erreur?: string; ajoutees?: string; ignorees?: string } }) {
  const t = await getTranslations("Floorplans");
  if (query.erreur && ERRORS.has(query.erreur)) {
    return (
      <p role="alert" className="plan-error">
        {t(`errors.${query.erreur}` as "errors.name")}
      </p>
    );
  }
  if (query.ok && OK.has(query.ok)) {
    const added = Number.parseInt(query.ajoutees ?? "0", 10) || 0;
    const skipped = Number.parseInt(query.ignorees ?? "0", 10) || 0;
    return (
      <p role="status" className="plan-ok">
        {t(`ok.${query.ok}` as "ok.space", { added, skipped })}
      </p>
    );
  }
  return null;
}
