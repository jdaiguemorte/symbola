// Lot 53 (HUB-15, UX-16 ; D3 ; ADR 0095) — centre de notifications : ce qui s'est passé et ce qui attend,
// une ligne par fait ; chaque notification dit quoi et quelle action, et mène à l'écran où agir.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { eventNames, listEvents } from "@/modules/events/service";
import { isModuleEnabled, listNotifications, notificationActionLabel, notificationText, notificationTypeLabel } from "@/modules/hub/service";
import { appDatabase } from "@symbola/db/client";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { markAllReadAction, openNotificationAction } from "./actions";

export default async function NotificationsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Notifications");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const notifications = await listNotifications(organizationId, auth.user.id);
  const names = (await isModuleEnabled(appDatabase(), organizationId, "events"))
    ? new Map((await listEvents({ organizationId })).map((event) => [event.id, eventNames(event.clients)]))
    : new Map<string, string>();
  const unread = notifications.some((notification) => notification.readAt === null);
  return (
    <main>
      <div className="page-header">
        <h1>{t("center.title")}</h1>
        <Link href="/parametres/notifications" className="button-link">
          {t("center.settings")}
        </Link>
      </div>
      <ScreenHelp title={tHelp("notifications.title")} body={tHelp("notifications.body")} />
      <p>{t("center.intro")}</p>
      {unread ? (
        <form action={markAllReadAction}>
          <button type="submit" className="button-secondary">
            {t("center.markAll")}
          </button>
        </form>
      ) : null}
      {notifications.length === 0 ? (
        <p className="empty-state">{t("center.empty")}</p>
      ) : (
        <ul className="notification-list" aria-label={t("center.listLabel")}>
          {notifications.map((notification) => {
            const event = notification.eventId ? names.get(notification.eventId) : null;
            return (
              <li key={notification.id} className="notification-item" data-unread={notification.readAt === null ? "true" : undefined}>
                <div className="notification-body">
                  <p className="notification-kind">
                    {notificationTypeLabel(notification.type, locale)}
                    {notification.readAt === null ? <span className="badge badge-terracotta">{t("center.unread")}</span> : null}
                  </p>
                  <p className="notification-text">{notificationText(notification, locale)}</p>
                  <p className="notification-meta">{[event, formatDateTime(new Date(notification.createdAt), locale)].filter(Boolean).join(" · ")}</p>
                </div>
                <form action={openNotificationAction} className="notification-action">
                  <input type="hidden" name="notificationId" value={notification.id} />
                  <button type="submit">{notificationActionLabel(notification.type, locale)}</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
