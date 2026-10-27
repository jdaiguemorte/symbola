"use server";

// EVT-06 — le marié coche ou décoche une de ses tâches.
import { revalidatePath } from "next/cache";
import { ClientAccessDeniedError, setClientTaskDone } from "@/modules/events/service";
import { getClientAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export async function toggleClientTaskAction(formData: FormData): Promise<void> {
  const auth = await getClientAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return;
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await setClientTaskDone(auth.user.organizationId, auth.user.id, taskId, formData.get("done") === "true");
  } catch (error) {
    if (!(error instanceof ClientAccessDeniedError)) throw error;
  }
  revalidatePath(`/espace/${eventId}`);
}
