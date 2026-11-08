"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appDatabase } from "@symbola/db/client";
import { cancelImport, retryImportJob } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "./access";

export type StartImportFormState = { error?: string };

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
