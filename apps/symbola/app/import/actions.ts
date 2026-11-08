"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { cancelImport, retryImportJob, startEventSheetsImport, startImport, type ImportRejectionReason } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { saveColumnsIfNothingToDecide } from "@/lib/import/columns";
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
  // Lot 14c (IMP-08) : une ou plusieurs fiches événement PDF.
  if (entityType === "event_sheets") {
    const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return { error: t("missingFile") };
    const db = appDatabase();
    const started = await startEventSheetsImport(db, {
      organizationId,
      userId: auth.user.id,
      files: await Promise.all(files.map(async (entry) => ({ fileName: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) }))),
    });
    if (started.status === "rejected") return { error: t(started.reason === "too_many_files" ? "rejectedTooManySheets" : "missingFile") };
    revalidatePath("/import");
    redirect(`/import/${started.importId}`);
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("missingFile") };

  const db = appDatabase();
  const result = await startImport(db, {
    organizationId,
    userId: auth.user.id,
    entityType,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });

  if (result.status === "rejected") {
    // Journalisé sans le nom du fichier ni son contenu (CLAUDE.md §5).
    console.warn("import refusé", { organizationId, reason: result.reason, hint: result.hint });
    const reason = t(REJECTION_MESSAGES[result.reason]);
    return { error: result.hint ? `${reason} ${t(HINT_MESSAGES[result.hint])}` : reason };
  }
  // Lot 16 (IMP-11) : rien à décider sur les colonnes, l'étape est faite d'office.
  await saveColumnsIfNothingToDecide(organizationId, result.importId);
  revalidatePath("/import");
  redirect(`/import/${result.importId}`);
}

export async function cancelImportAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;

  const db = appDatabase();
  await cancelImport(db, auth.user.organizationId, importId);
  revalidatePath("/import");
  redirect("/import");
}

// Lot 15 (IMP-10) — relancer un traitement de fond en échec (lecture des
// fiches, placement sur la carte) : il reprend là où il s'était arrêté.
export async function retryImportJobAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  if (!isValidId(importId) || !isValidId(jobId)) return;
  const db = appDatabase();
  await retryImportJob(db, auth.user.organizationId, jobId);
  revalidatePath(`/import/${importId}`);
  revalidatePath(`/import/${importId}/journal`);
}
