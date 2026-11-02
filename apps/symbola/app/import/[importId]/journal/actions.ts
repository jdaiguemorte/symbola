"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { undoImport } from "@/lib/import/apply";
import { isValidId } from "../../access";

// IMP-05 — annulation d'un import confirmé. Les éléments modifiés à la main
// depuis ne sont annulés que si la planner a coché leur confirmation.
export async function undoImportAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;
  const forceItemIds = formData
    .getAll("forceItemId")
    .map(String)
    .filter((id) => isValidId(id));

  const result = await undoImport({ organizationId: auth.user.organizationId, userId: auth.user.id, importId, forceItemIds });
  revalidatePath("/import");
  if (result.status !== "done") redirect(`/import/${importId}/journal`);
  const { undone, kept_modified: keptModified, kept_in_use: keptInUse } = result.outcomes;
  redirect(`/import/${importId}/journal?annule=${undone}&gardes=${keptModified}&utilises=${keptInUse}`);
}
