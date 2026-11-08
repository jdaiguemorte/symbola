"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { MappingError } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { saveColumnDecisions, type ColumnDecision } from "@/lib/import/columns";
import { getImportWizard, importStepHref } from "@/lib/import/wizard";
import { isValidId } from "../../access";

export type ColumnsFormState = { errors?: string[] };

// IMP-02 — enregistrement des correspondances. Lot 16 (IMP-11) : chaque colonne
// devient un champ, reste en champ libre ou est ignorée, en une fois ; puis
// l'assistant passe à l'étape suivante (`nextImportStep`).
export async function saveColumnsAction(_prevState: ColumnsFormState, formData: FormData): Promise<ColumnsFormState> {
  const t = await getTranslations("Import");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { errors: [t("unauthenticated")] };
  const organizationId = auth.user.organizationId;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return { errors: [t("importNotFound")] };

  const columnCount = Number(formData.get("columnCount") ?? 0);
  if (!Number.isInteger(columnCount) || columnCount < 0 || columnCount > 500) return { errors: [t("importNotFound")] };
  const decisions: ColumnDecision[] = Array.from({ length: columnCount }, (_, columnIndex) => ({
    columnIndex,
    target: String(formData.get(`target-${columnIndex}`) ?? "").slice(0, 80) || "none",
    confirmed: formData.get(`confirm-${columnIndex}`) === "on",
  }));
  const headers = formData.getAll("header").map(String);
  const columnName = (columnIndex: number) => headers[columnIndex] || t("unnamedColumn", { number: columnIndex + 1 });

  const result = await saveColumnDecisions(organizationId, importId, decisions);
  if (result.status === "not_found") return { errors: [t("importNotFound")] };
  if (result.status === "invalid") {
    const message = (error: MappingError) => {
      switch (error.code) {
        case "unknown_field":
          return t("mappingUnknownField", { column: columnName(error.columnIndex) });
        case "duplicate_field":
          return t("mappingDuplicateField", { column: columnName(error.columnIndex), field: t(`field.${error.fieldKey}`) });
        case "low_confidence_not_confirmed":
          return t("mappingLowConfidence", { column: columnName(error.columnIndex), field: t(`field.${error.fieldKey}`) });
        case "missing_required":
          return t("mappingMissingRequired", { field: t(`field.${error.fieldKey}`) });
      }
    };
    return { errors: result.errors.map(message) };
  }
  const wizard = await getImportWizard(organizationId, importId);
  redirect(wizard ? importStepHref(importId, wizard.next) : "/import");
}
