"use server";

// Lot 53 (HUB-15, UX-16, ARC-09 ; D1, D2, D4) — réglages des notifications de la personne connectée :
// chaque sorte par canal, récapitulatif, plages de silence, appareils abonnés au push. Toute entrée est
// validée par le module hub (Zod) ; un compte ne règle jamais que les siens (SEC-12).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from "@symbola/contracts";
import {
  NotificationInputError,
  pushToUser,
  removePushDevice,
  saveNotificationSettings,
  savePushSubscription,
  setNotificationPreference,
} from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";

export type NotificationFormState = { error?: string; success?: boolean };

export async function savePreferencesAction(_prev: NotificationFormState, formData: FormData): Promise<NotificationFormState> {
  const auth = await requirePlanner();
  for (const type of NOTIFICATION_TYPES) {
    for (const channel of NOTIFICATION_CHANNELS) {
      await setNotificationPreference(auth.user.organizationId, auth.user.id, { type, channel, enabled: formData.get(`pref:${type}:${channel}`) === "on" });
    }
  }
  revalidatePath("/parametres/notifications");
  return { success: true };
}

function minutesOf(value: FormDataEntryValue | null): number {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

export async function saveScheduleAction(_prev: NotificationFormState, formData: FormData): Promise<NotificationFormState> {
  const auth = await requirePlanner();
  const t = await getTranslations("Notifications");
  try {
    await saveNotificationSettings(auth.user.organizationId, auth.user.id, {
      digestEnabled: formData.get("digestEnabled") === "on",
      digestHour: Number(formData.get("digestHour")),
      quietEnabled: formData.get("quietEnabled") === "on",
      quietStartMinute: minutesOf(formData.get("quietStart")),
      quietEndMinute: minutesOf(formData.get("quietEnd")),
      quietSundays: formData.get("quietSundays") === "on",
      dayOfOverride: formData.get("dayOfOverride") === "on",
    });
  } catch (error) {
    if (error instanceof NotificationInputError) return { error: t("settings.invalid") };
    throw error;
  }
  revalidatePath("/parametres/notifications");
  return { success: true };
}

export type PushActionResult = { ok: boolean };

// L'abonnement du navigateur (PushSubscription.toJSON()) et un nom d'appareil lisible.
export async function subscribePushAction(subscription: unknown, deviceLabel: string): Promise<PushActionResult> {
  const auth = await requirePlanner();
  try {
    await savePushSubscription(auth.user.organizationId, auth.user.id, subscription, String(deviceLabel ?? ""));
  } catch (error) {
    if (error instanceof NotificationInputError) return { ok: false };
    throw error;
  }
  revalidatePath("/parametres/notifications");
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<PushActionResult> {
  const auth = await requirePlanner();
  await removePushDevice(auth.user.organizationId, auth.user.id, { endpoint: String(endpoint ?? "") });
  revalidatePath("/parametres/notifications");
  return { ok: true };
}

export async function removeDeviceAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  await removePushDevice(auth.user.organizationId, auth.user.id, { id: String(formData.get("deviceId") ?? "") });
  revalidatePath("/parametres/notifications");
}

// Un essai sur les appareils de la personne, sans donnée personnelle.
export async function testPushAction(): Promise<PushActionResult> {
  const auth = await requirePlanner();
  const t = await getTranslations("Notifications");
  const sent = await pushToUser(auth.user.organizationId, auth.user.id, { title: t("push.testTitle"), body: t("push.testBody"), url: "/notifications", tag: "test" });
  return { ok: sent > 0 };
}
