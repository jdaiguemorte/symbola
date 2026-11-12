"use server";

// Lot 26a (UX-11) — actions du portail d'un lien personnel : cocher une tâche
// « mariés » (rubrique Rétroplanning), fermer la session sur cet appareil.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { closeLinkSession, LinkAccessDeniedError, setLinkTaskDone } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { clearLinkSessionCookie, currentLinkAccess, getLinkSessionToken } from "@/lib/link-session";

export async function toggleLinkTaskAction(formData: FormData): Promise<void> {
  const access = await currentLinkAccess();
  if (!access || !(await isEventsModuleEnabled(access.organizationId))) return;
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(taskId)) return;
  try {
    await setLinkTaskDone(access.organizationId, access.linkId, taskId, formData.get("done") === "true");
  } catch (error) {
    if (!(error instanceof LinkAccessDeniedError)) throw error;
  }
  revalidatePath("/portail");
}

// Ferme la session de lien de ce navigateur ; le lien lui-même reste valable.
export async function closeLinkSessionAction(): Promise<void> {
  const token = await getLinkSessionToken();
  if (token) await closeLinkSession(token);
  await clearLinkSessionCookie();
  redirect("/lien?ferme=1");
}
