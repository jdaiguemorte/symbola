// Lot 53 (HUB-15, UX-16) — la cloche de la barre du haut : le nombre de notifications non lues du compte
// connecté, et le lien vers le centre. Une panne de lecture n'empêche jamais l'écran de s'afficher.
import Link from "next/link";
import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { countUnreadNotifications } from "@/modules/hub/service";

export async function NotificationBell({ organizationId, userId }: { organizationId: string; userId: string }) {
  const t = await getTranslations("Notifications");
  const count = await countUnreadNotifications(organizationId, userId).catch(() => 0);
  return (
    <Link href="/notifications" className="notification-bell" aria-label={t("bell.unread", { count })}>
      <Bell aria-hidden="true" size={20} strokeWidth={1.75} />
      {count > 0 ? <span className="notification-count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
