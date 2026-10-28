"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { saveImportMapping, type ColumnChoiceInput, type MappingError } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "../../access";

export type ColumnsFormState = { errors?: string[] };

// IMP-02 — enregistrement des correspondances validées, corrigées ou ignorées.
export async function saveColumnsAction(_prevState: ColumnsFormState, formData: FormData): Promise<ColumnsFormState> {
  const t = await getTranslations("Import");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { errors: [t("unauthenticated")] };
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return { errors: [t("importNotFound")] };

  const columnCount = Number(formData.get("columnCount") ?? 0);
  if (!Number.isInteger(columnCount) || columnCount < 0 || columnCount > 500) return { errors: [t("importNotFound")] };
  const choices: ColumnChoiceInput[] = Array.from({ length: columnCount }, (_, columnIndex) => ({
    columnIndex,
    target: String(formData.get(`target-${columnIndex}`) ?? "none"),
    confirmed: formData.get(`confirm-${columnIndex}`) === "on",
  }));
  const headers = formData.getAll("header").map(String);
  const columnName = (columnIndex: number) => headers[columnIndex] || t("unnamedColumn", { number: columnIndex + 1 });

  const { sql, db } = createAppConnection();
  let result;
  try {
    result = await saveImportMapping(db, { organizationId: auth.user.organizationId, importId, choices });
  } finally {
    await sql.end();
  }

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
  redirect(`/import/${importId}`);
}
