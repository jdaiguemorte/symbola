import type { RejectionReason } from "@/lib/import/gaps";

// Motif lisible d'une ligne rejetée (écran et CSV), dans la langue de la planner.
export function reasonText(t: (key: string, values?: Record<string, string>) => string, reason: RejectionReason): string {
  if (reason.code === "event_not_found") return t("rowError.event_not_found");
  // Lot 14c : fiche PDF refusée à la lecture (motif dans la valeur).
  if (reason.code === "sheet_rejected") return t(`sheetRejection.${reason.value}`);
  const field = t(`field.${reason.fieldKey}`);
  return reason.value ? t(`rowError.${reason.code}`, { field, value: reason.value }) : t(`rowError.${reason.code}`, { field, value: "" });
}
