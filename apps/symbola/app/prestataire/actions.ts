"use server";

// Lot 34b (CHR-02, D12) — le prestataire coche une tâche qui lui est confiée, depuis son espace
// ouvert par son lien personnel. Contrôles côté serveur : session du lien, module Évènements ; le
// service vérifie que la tâche est de son événement et qu'elle lui est confiée.
import { revalidatePath } from "next/cache";
import { LinkAccessDeniedError, setVendorLinkTaskDone } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { currentLinkAccess } from "@/lib/link-session";

export async function toggleVendorTaskAction(formData: FormData): Promise<void> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "vendor" || !(await isEventsModuleEnabled(access.organizationId))) return;
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(taskId)) return;
  try {
    await setVendorLinkTaskDone(access.organizationId, access.linkId, taskId, formData.get("done") === "true");
  } catch (error) {
    if (!(error instanceof LinkAccessDeniedError)) throw error;
  }
  revalidatePath("/prestataire");
}
