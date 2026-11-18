"use server";

// Lot 53 (HUB-15, UX-16) — centre de notifications : ouvrir une notification la marque lue puis mène à
// l'écran où agir ; « Tout marquer comme lu ». Seules les notifications du compte connecté, dans son
// organisation : une autre n'existe pas pour lui (SEC-12, SEC-13).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";

export async function openNotificationAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const id = String(formData.get("notificationId") ?? "");
  const notification = await markNotificationRead(auth.user.organizationId, auth.user.id, id);
  revalidatePath("/notifications");
  // Le chemin vient de la base, vérifié à l'écriture (chemin interne de l'app seulement).
  redirect(notification && /^\/[^/\\]/.test(notification.href) ? notification.href : "/notifications");
}

export async function markAllReadAction(): Promise<void> {
  const auth = await requirePlanner();
  await markAllNotificationsRead(auth.user.organizationId, auth.user.id);
  revalidatePath("/notifications");
}
