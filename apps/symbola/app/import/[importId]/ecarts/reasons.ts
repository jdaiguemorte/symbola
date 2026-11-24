import type { RejectionReason } from "@/lib/import/gaps";

// Motif lisible d'une ligne rejetée (écran et CSV), dans la langue de la planner.
export function reasonText(t: (key: string, values?: Record<string, string>) => string, reason: RejectionReason): string {
  if (reason.code === "event_not_found") return t("rowError.event_not_found");
  // Lot 14c : fiche PDF refusée à la lecture (motif dans la valeur).
  if (reason.code === "sheet_rejected") return t(`sheetRejection.${reason.value}`);
  // Lot 36b (D11) : ligne écartée selon une colonne (son intitulé, la valeur de la cellule).
  if (reason.code === "excluded_by_filter") return t("rowError.excluded_by_filter", { field: reason.fieldKey ?? "", value: reason.value || t("rowsEmptyValue") });
  const field = t(`field.${reason.fieldKey}`);
  // Lot 67a (HUB-14 ; R03) : la colonne du fichier à remplir, puis le champ de Symbola.
  if (reason.code === "required_missing" && reason.column) return t("rowError.required_missing_column", { column: reason.column, field });
  return reason.value ? t(`rowError.${reason.code}`, { field, value: reason.value }) : t(`rowError.${reason.code}`, { field, value: "" });
}
