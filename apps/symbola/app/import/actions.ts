"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { cancelImport, startImport, type ImportRejectionReason } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { availableImportEntityTypes, isValidId, parseEntityType } from "./access";

export type StartImportFormState = { error?: string };

const REJECTION_MESSAGES: Record<ImportRejectionReason, string> = {
  empty: "rejectedEmpty",
  too_large: "rejectedTooLarge",
  too_many_rows: "rejectedTooManyRows",
  too_many_columns: "rejectedTooManyColumns",
  unsupported_format: "rejectedUnsupported",
  malformed: "rejectedMalformed",
  infected: "rejectedInfected",
};

const HINT_MESSAGES = {
  xls: "rejectedHintXls",
  ods: "rejectedHintOds",
  xlsm: "rejectedHintXlsm",
  encrypted: "rejectedHintEncrypted",
  binary: "rejectedHintBinary",
} as const;

// IMP-01 — étape « fichier » : type d'éléments choisi, fichier reçu, analysé
// par l'antivirus et lu ; l'import en cours s'ouvre sur l'étape suivante.
export async function startImportAction(_prevState: StartImportFormState, formData: FormData): Promise<StartImportFormState> {
  const t = await getTranslations("Import");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;

  const entityType = parseEntityType(String(formData.get("entityType") ?? ""));
  if (!entityType || !(await availableImportEntityTypes(organizationId)).includes(entityType)) {
    return { error: t("missingEntityType") };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("missingFile") };

  const { sql, db } = createAppConnection();
  let result;
  try {
    result = await startImport(db, {
      organizationId,
      userId: auth.user.id,
      entityType,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } finally {
    await sql.end();
  }

  if (result.status === "rejected") {
    // Journalisé sans le nom du fichier ni son contenu (CLAUDE.md §5).
    console.warn("import refusé", { organizationId, reason: result.reason, hint: result.hint });
    const reason = t(REJECTION_MESSAGES[result.reason]);
    return { error: result.hint ? `${reason} ${t(HINT_MESSAGES[result.hint])}` : reason };
  }
  revalidatePath("/import");
  redirect(`/import/${result.importId}`);
}

export async function cancelImportAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;

  const { sql, db } = createAppConnection();
  try {
    await cancelImport(db, auth.user.organizationId, importId);
  } finally {
    await sql.end();
  }
  revalidatePath("/import");
  redirect("/import");
}
