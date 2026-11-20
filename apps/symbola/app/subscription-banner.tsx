// Lot 54 (HUB-27, DOC-06 ; ADR 0101) — bandeau de l'abonnement, en tête de chaque écran de l'équipe :
// les jours d'essai qui restent, la lecture seule de fin d'essai, une résiliation en cours, le
// stockage à 80 % et plus (puis plein, avec la date du refus des dépôts). Rien sans abonnement ni
// quand le libre-service est fermé à l'organisation. Le lien vers « Mon abonnement » pour la
// Propriétaire seulement.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { daysBeforeDeletion, getStorageQuota, getSubscription, isFeatureEnabled } from "@/modules/hub/service";

type Notice = { tone: "info" | "attention" | "critical"; text: string; action: "choose" | "open" };

export async function SubscriptionBanner({ organizationId, isOwner }: { organizationId: string; isOwner: boolean }) {
  const db = appDatabase();
  if (!(await isFeatureEnabled(db, organizationId, "subscription_self_service"))) return null;
  const now = new Date();
  const [subscription, quota] = await Promise.all([getSubscription(db, organizationId), getStorageQuota(db, organizationId, now)]);
  if (!subscription) return null;
  const t = await getTranslations("SubscriptionBanner");
  const locale = (await getLocale()) as Locale;
  const date = (value: Date | null) => (value ? formatDateTime(value, locale) : "");
  const notices: Notice[] = [];
  if (subscription.status === "trial" && subscription.trialEndsAt) {
    // Jours entiers qui restent (0 le dernier jour), à Paris.
    const days = daysBeforeDeletion(subscription.trialEndsAt, now);
    notices.push({ tone: days <= 7 ? "attention" : "info", text: t("trial", { days, date: date(subscription.trialEndsAt) }), action: "choose" });
  } else if (subscription.status === "read_only") {
    notices.push({ tone: "critical", text: t("readOnly"), action: "choose" });
  } else if (subscription.status === "cancelled" && subscription.cancelEffectiveAt && !subscription.endedAt) {
    notices.push({ tone: "attention", text: t("cancelled", { date: date(subscription.cancelEffectiveAt) }), action: "open" });
  }
  if (quota?.blocked) notices.push({ tone: "critical", text: t("quotaBlocked"), action: "open" });
  else if (quota?.uploadsBlockedFrom) notices.push({ tone: "critical", text: t("quotaFull", { date: date(quota.uploadsBlockedFrom) }), action: "open" });
  else if (quota && quota.percent !== null && quota.alertedPercents.length > 0) notices.push({ tone: "attention", text: t("quotaAlert", { percent: quota.percent }), action: "open" });
  if (notices.length === 0) return null;
  return (
    <aside className="subscription-banner" aria-label={t("label")} data-tone={notices.some((notice) => notice.tone === "critical") ? "critical" : notices.some((notice) => notice.tone === "attention") ? "attention" : "info"}>
      <div>
        {notices.map((notice) => (
          <p key={notice.text}>{notice.text}</p>
        ))}
      </div>
      {isOwner ? (
        <Link className="button-ghost" href="/parametres/abonnement">
          {notices.some((notice) => notice.action === "choose") ? t("choose") : t("open")}
        </Link>
      ) : null}
    </aside>
  );
}
