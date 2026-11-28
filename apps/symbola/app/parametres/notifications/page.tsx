// Lot 53 (HUB-15, UX-16, ARC-09 ; D1, D2, D4 ; ADR 0095) — « Notifications » des Paramètres : les
// réglages de la personne connectée (chaque membre a les siens).
// Lot 74h (D7, G8 ; page 30) : au patron d'un écran de réglage. L'en-tête commun (« Pour vous seule ») ;
// chaque réglage s'enregistre seul ; « Notifications push sur cet appareil » devient « Ce téléphone ».
import { SettingsHeader } from "@/app/ui/settings-header";
import { savedIndicatorLabels, settingsScopeLine } from "@/lib/settings/settings-header-texts";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES, type NotificationChannel } from "@symbola/contracts";
import { starterNotifications } from "@symbola/starter-templates";
import { getNotificationPreferences, getNotificationSettings, listPushDevices, notificationTypeLabel, pushPublicKey } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { removeDeviceAction } from "./actions";
import { PreferencesForm, ScheduleForm } from "./notification-forms";
import { PushDevice } from "./push-device";

export default async function NotificationSettingsPage() {
  const auth = await requirePlanner();
  const { organizationId, id: userId } = auth.user;
  const t = await getTranslations("Notifications");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const format = await getFormatter();
  const [preferences, settings, devices] = await Promise.all([getNotificationPreferences(organizationId, userId), getNotificationSettings(organizationId, userId), listPushDevices(organizationId, userId)]);
  const starter = starterNotifications();
  const rows = NOTIFICATION_TYPES.map((type) => ({
    type,
    label: notificationTypeLabel(type, locale),
    immediate: starter.types[type]?.immediate ?? false,
    channels: Object.fromEntries(NOTIFICATION_CHANNELS.map((channel) => [channel, preferences.find((preference) => preference.type === type && preference.channel === channel)?.enabled ?? false])) as Record<NotificationChannel, boolean>,
  }));
  const tPattern = await getTranslations("SettingsPattern");
  const [saved, scope] = await Promise.all([savedIndicatorLabels(), settingsScopeLine({ scope: "personal", editors: "self", saving: "auto", isOwner: auth.user.role === "owner" })]);
  const thisPhone = tPattern("notifications.thisPhone");
  return (
    <main className="stack">
      <SettingsHeader title={tMenu("rubrics.notifications.label")} hint={tPattern("headers.notifications")} scope={scope} />
      <ScreenHelp title={tHelp("notificationSettings.title")} body={tHelp("notificationSettings.body")} />
      <section className="card" aria-labelledby="notification-types-title">
        <h2 id="notification-types-title">{t("settings.typesTitle")}</h2>
        <PreferencesForm rows={rows} saved={saved} pushLabel={thisPhone} />
      </section>
      <section className="card">
        <ScheduleForm settings={settings} saved={saved} />
      </section>
      <section className="card" aria-labelledby="push-title">
        <h2 id="push-title">{thisPhone}</h2>
        <PushDevice publicKey={pushPublicKey()} />
        <h3>{t("push.devicesTitle")}</h3>
        {devices.length === 0 ? (
          <p>{t("push.devicesEmpty")}</p>
        ) : (
          <ul className="device-list">
            {devices.map((device) => (
              <li key={device.id}>
                <span>
                  {device.label} · {t("push.deviceSince", { date: format.dateTime(new Date(device.createdAt), { dateStyle: "long", timeZone: "Europe/Paris" }) })}
                </span>
                <form action={removeDeviceAction}>
                  <input type="hidden" name="deviceId" value={device.id} />
                  <button type="submit" className="button-secondary" aria-label={t("push.removeLabel", { device: device.label })}>
                    {t("push.remove")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
